'use strict';
const path = require('path');
const fs   = require('fs');
const inboxService = require('../../services/inboxService');
const emailService = require('../../services/emailService');
const db = require('../../config/db');
const { NotFoundError, ValidationError } = require('../../utils/errors');
const { v4: uuidv4 } = require('uuid');

// GET /api/admin/emails
async function listEmails(req, res, next) {
  try {
    const filters = {
      page:      req.query.page,
      limit:     req.query.limit,
      search:    req.query.search,
      spam:      req.query.spam !== undefined ? req.query.spam === 'true' : undefined,
      read:      req.query.read !== undefined ? req.query.read === 'true' : undefined,
      status:    req.query.status,
      archived:  req.query.archived !== undefined ? req.query.archived === 'true' : undefined,
      deleted:   req.query.deleted === 'true',
      thread_id: req.query.thread_id,
    };

    const { sql, params, countSql, countParams } = inboxService.buildInboxQuery(filters);
    const rows  = await db.all(sql, params);
    const { total } = await db.get(countSql, countParams);
    const { unread } = await db.get(
      "SELECT COUNT(*) AS unread FROM emails WHERE read = 0 AND deleted = 0 AND archived = 0"
    );

    return res.status(200).json({
      data: rows,
      meta: {
        total,
        page:  Math.max(parseInt(req.query.page) || 1, 1),
        limit: Math.min(Math.max(parseInt(req.query.limit) || 25, 1), 100),
        unread,
      },
    });
  } catch (err) { next(err); }
}

// GET /api/admin/emails/stats
async function getStats(req, res, next) {
  try {
    const stats = await inboxService.getStats();
    return res.status(200).json(stats);
  } catch (err) { next(err); }
}

// GET /api/admin/emails/:id
async function getEmail(req, res, next) {
  try {
    const result = await inboxService.getEmailWithThread(req.params.id);
    if (!result) throw new NotFoundError('Email');
    await inboxService.markRead(req.params.id);
    return res.status(200).json(result);
  } catch (err) { next(err); }
}

// PATCH /api/admin/emails/:id
async function patchEmail(req, res, next) {
  try {
    const email = await db.get('SELECT id FROM emails WHERE id = ?', [req.params.id]);
    if (!email) throw new NotFoundError('Email');
    await inboxService.patchEmail(req.params.id, req.body);
    return res.status(200).json({ updated: true });
  } catch (err) { next(err); }
}

// DELETE /api/admin/emails/:id
async function deleteEmail(req, res, next) {
  try {
    const email = await db.get('SELECT id FROM emails WHERE id = ?', [req.params.id]);
    if (!email) throw new NotFoundError('Email');
    await inboxService.softDelete(req.params.id);
    return res.status(200).json({ deleted: true });
  } catch (err) { next(err); }
}

// POST /api/admin/emails/:id/reply
async function replyEmail(req, res, next) {
  try {
    const { body: replyBody, subject: replySubject } = req.body || {};
    if (!replyBody || !String(replyBody).trim()) {
      throw new ValidationError('Reply body is required', ['body']);
    }

    const original = await db.get('SELECT * FROM emails WHERE id = ?', [req.params.id]);
    if (!original) throw new NotFoundError('Email');

    const from    = original.account === 'support' ? 'support@chativa.pro' : 'contact@chativa.pro';
    const subject = replySubject || `Re: ${original.subject || '(no subject)'}`;

    const { job, emailId } = await emailService.enqueue({
      from,
      to:           original.sender,
      subject,
      templateName: 'reply',
      templateVars: { body: String(replyBody).trim() },
    });

    // Update reply email with thread_id from original
    await db.run("UPDATE emails SET thread_id = ? WHERE id = ?", [original.thread_id, emailId]);

    // Mark original as replied
    await db.run("UPDATE emails SET status = 'replied', updated_at = datetime('now') WHERE id = ?", [req.params.id]);

    return res.status(202).json({ message: 'Reply enqueued', jobId: job.id });
  } catch (err) { next(err); }
}

// POST /api/admin/emails/compose
async function composeEmail(req, res, next) {
  try {
    const { to, subject, body: bodyContent, from } = req.body || {};
    const errors = [];
    if (!to      || !String(to).trim())              errors.push('to');
    if (!subject || !String(subject).trim())         errors.push('subject');
    if (!bodyContent || !String(bodyContent).trim()) errors.push('body');
    if (errors.length > 0) throw new ValidationError('Validation failed', errors);

    const sender = from || 'contact@chativa.pro';
    const { job, emailId } = await emailService.enqueue({
      from:        sender,
      to:          String(to).trim(),
      subject:     String(subject).trim(),
      htmlContent: String(bodyContent).trim(),
    });

    // Assign a new thread_id for composed emails
    await db.run("UPDATE emails SET thread_id = ? WHERE id = ?", [uuidv4(), emailId]);

    return res.status(202).json({ message: 'Email enqueued', jobId: job.id });
  } catch (err) { next(err); }
}

module.exports = { listEmails, getStats, getEmail, patchEmail, deleteEmail, replyEmail, composeEmail };
