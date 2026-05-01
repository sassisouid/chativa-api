'use strict';
const crypto  = require('crypto');
const path    = require('path');
const fs      = require('fs');
const { verifyWebhookSignature } = require('../utils/hmacVerifier');
const { sanitize }               = require('../utils/htmlSanitizer');
const { sanitizeFilename }       = require('../utils/sanitizeFilename');
const spamService = require('../services/spamService');
const redis   = require('../config/redis');
const db      = require('../config/db');
const logger  = require('../utils/logger');

const ATTACHMENT_WHITELIST  = new Set(['image/jpeg','image/png','image/gif','application/pdf','text/plain']);
const MAX_ATTACHMENT_BYTES  = 10 * 1024 * 1024; // 10 MB
const DEDUP_TTL_SECONDS     = 86400;             // 24 h

async function handleInbound(req, res) {
  // 1. HMAC signature verification (raw body required)
  const rawBody   = req.body; // Buffer from rawBody middleware
  const signature = req.headers['x-brevo-signature'];

  if (!signature || !verifyWebhookSignature(rawBody, signature, process.env.WEBHOOK_SECRET)) {
    logger.warn('Webhook: invalid signature');
    return res.status(200).json({ received: false, reason: 'invalid_signature' });
  }

  // 2. Parse JSON from raw body
  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(200).json({ received: false, reason: 'invalid_json' });
  }

  // 3. Replay guard: timestamp must be <= 300 seconds old
  const now = Math.floor(Date.now() / 1000);
  const ts  = Number(payload.timestamp);
  if (!ts || now - ts > 300) {
    logger.warn('Webhook: replay attack detected', { ts, now, diff: now - ts });
    return res.status(200).json({ received: false, reason: 'replay' });
  }

  // 4. Deduplication via Redis (24h TTL)
  const messageId = payload.MessageID || payload.messageId || null;
  if (messageId) {
    const dedupKey = `webhook:dedup:${messageId}`;
    const isNew    = await redis.set(dedupKey, '1', 'EX', DEDUP_TTL_SECONDS, 'NX');
    if (!isNew) {
      logger.info('Webhook: duplicate ignored', { messageId });
      return res.status(200).json({ received: true, duplicate: true });
    }
  }

  // 5. Extract and normalise fields
  const senderEmail = payload.From?.Address || payload.from?.email || '';
  const senderName  = payload.From?.Name    || payload.from?.name  || '';
  const recipient   = payload.To?.[0]?.Address || payload.to || '';
  const subject     = payload.Subject || payload.subject || '(no subject)';
  const bodyHtml    = sanitize(payload.HtmlBody  || payload.htmlContent || '');
  const bodyText    = payload.TextBody || payload.textContent || '';
  const inReplyTo   = payload.InReplyTo || payload.headers?.['in-reply-to'] || null;
  const account     = recipient.toLowerCase().includes('support') ? 'support' : 'contact';

  // 6. Thread resolution
  const threadId = await resolveThreadId(inReplyTo, db);

  // 7. Insert email record
  const { lastInsertRowid: emailId } = await db.run(`
    INSERT INTO emails
      (sender, sender_name, recipient, account, subject, body_text, body_html,
       direction, status, read, thread_id, brevo_message_id, received_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'inbound', 'unread', 0, ?, ?, datetime('now'))
  `, [senderEmail, senderName, recipient, account, subject, bodyText, bodyHtml, threadId, messageId]);

  // 8. Process attachments
  const attachments = payload.Attachments || payload.attachments || [];
  for (const att of attachments) {
    const mimeType  = att.ContentType || att.contentType || '';
    const sizeBytes = att.ContentLength || att.size || 0;

    if (!ATTACHMENT_WHITELIST.has(mimeType)) {
      logger.warn('Webhook: attachment rejected (MIME)', { mimeType, emailId });
      continue;
    }
    if (sizeBytes > MAX_ATTACHMENT_BYTES) {
      logger.warn('Webhook: attachment rejected (size)', { sizeBytes, emailId });
      continue;
    }

    const safeName   = sanitizeFilename(att.Name || att.filename || 'attachment');
    const uploadDir  = path.resolve(__dirname, '../../../uploads', String(emailId));
    fs.mkdirSync(uploadDir, { recursive: true });
    const storagePath = path.join(uploadDir, safeName);
    fs.writeFileSync(storagePath, Buffer.from(att.Content || att.content || '', 'base64'));

    await db.run(`
      INSERT INTO attachments (email_id, filename, mime_type, size_bytes, storage_path)
      VALUES (?, ?, ?, ?, ?)
    `, [emailId, safeName, mimeType, sizeBytes, `uploads/${emailId}/${safeName}`]);
  }

  // 9. Spam scoring (async, non-blocking — does not delay the 200 response)
  setImmediate(async () => {
    try {
      const { score, signals } = await spamService.score({ sender: senderEmail, subject, bodyText, bodyHtml });
      const threshold = Number(process.env.SPAM_THRESHOLD) || 5;
      await db.run('UPDATE emails SET spam_score = ?, spam = ? WHERE id = ?', [score, score >= threshold ? 1 : 0, emailId]);
      logger.info('Spam scored', { emailId, score, signals });
    } catch (err) {
      logger.error('Spam scoring failed', { emailId, error: err.message });
    }
  });

  return res.status(200).json({ received: true, emailId });
}

async function resolveThreadId(inReplyTo, db) {
  if (inReplyTo) {
    const parent = await db.get('SELECT thread_id FROM emails WHERE brevo_message_id = ?', [inReplyTo]);
    if (parent?.thread_id) return parent.thread_id;
  }
  return crypto.randomUUID();
}

module.exports = { handleInbound };
