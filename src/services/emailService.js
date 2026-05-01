'use strict';

const axios = require('axios');
const db = require('../config/db');
const { renderTemplate } = require('../utils/templateRenderer');
const { ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

const ALLOWED_SENDERS = ['support@chativa.pro', 'contact@chativa.pro'];
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Build a Brevo-compatible API payload.
 * Validates that the sender is one of the two allowed addresses.
 * If templateName is provided, renders the HTML from the template.
 *
 * @param {object} options
 * @param {string} options.to           - Recipient email address
 * @param {string} options.from         - Sender email address (must be in ALLOWED_SENDERS)
 * @param {string} [options.subject]    - Email subject line
 * @param {string} [options.htmlContent] - Raw HTML content (ignored if templateName is set)
 * @param {string} [options.textContent] - Plain-text fallback
 * @param {string} [options.templateName] - Template name to render (without .html extension)
 * @param {object} [options.templateVars] - Variables to pass to the template renderer
 * @returns {{ sender, to, subject, htmlContent, textContent }}
 * @throws {ValidationError} If the sender address is not in ALLOWED_SENDERS
 */
function buildPayload({ to, from, subject, htmlContent, textContent, templateName, templateVars }) {
  if (!ALLOWED_SENDERS.includes(from)) {
    throw new ValidationError(
      `Sender address '${from}' is not permitted. Must be one of: ${ALLOWED_SENDERS.join(', ')}`
    );
  }
  const html = templateName
    ? renderTemplate(templateName, templateVars || {})
    : (htmlContent || '');
  return {
    sender: { email: from },
    to: [{ email: to }],
    subject: subject || '(no subject)',
    htmlContent: html,
    textContent: textContent || '',
  };
}

/**
 * Send an email via the Brevo REST API.
 * Throws on any non-2xx response.
 * Sets err.noRetry = true for permanent 4xx errors (not 429) so Bull won't retry.
 *
 * @param {object} payload - Brevo-compatible payload built by buildPayload()
 * @returns {Promise<{ messageId: string|null }>}
 * @throws On HTTP 4xx (non-429) with err.noRetry = true; on 429/5xx/network errors for Bull retry
 */
async function send(payload) {
  let response;
  try {
    response = await axios.post(BREVO_API_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
      },
      timeout: 10000,
    });
  } catch (err) {
    const status = err.response?.status;
    if (status && status >= 400 && status < 500 && status !== 429) {
      const permanent = new Error(`Brevo permanent error ${status}: ${JSON.stringify(err.response?.data)}`);
      permanent.status = status;
      permanent.noRetry = true;
      throw permanent;
    }
    throw err;
  }
  return { messageId: response.data.messageId || null };
}

/**
 * Enqueue an outbound email job in Bull.
 * Inserts a DB record first (status='pending') so the email exists before the job runs.
 *
 * @param {object} jobData
 * @param {string} jobData.from     - Sender address
 * @param {string} jobData.to       - Recipient address
 * @param {string} [jobData.subject] - Email subject
 * @returns {Promise<{ job: Bull.Job, emailId: number }>}
 */
async function enqueue(jobData) {
  // Lazy require to avoid circular dependency (queue imports emailService)
  const { emailQueue } = require('../queues/index');

  const { from, to, subject } = jobData;
  const account = from.includes('support') ? 'support' : 'contact';

  const { lastInsertRowid: emailId } = await db.run(`
    INSERT INTO emails (sender, recipient, account, subject, direction, status, received_at)
    VALUES (?, ?, ?, ?, 'outbound', 'unread', datetime('now'))
  `, [from, to, account, subject || '(no subject)']);

  const job = await emailQueue.add({ ...jobData, emailId }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30000 },
  });

  await logResult(emailId, 'queued', 'retry', null);
  logger.info('Email enqueued', { emailId, jobId: job.id, to, from });

  return { job, emailId };
}

/**
 * Insert a record into email_logs.
 * providerResponse is JSON-stringified if it is an object.
 *
 * @param {number} emailId          - ID of the related email record
 * @param {string} event            - Event name (e.g. 'queued', 'sent', 'send_failed')
 * @param {string} status           - Status string (e.g. 'retry', 'sent', 'failed')
 * @param {object|string|null} providerResponse - Provider response data (will be JSON-stringified)
 */
async function logResult(emailId, event, status, providerResponse) {
  try {
    await db.run(`
      INSERT INTO email_logs (email_id, event, status, provider_response, logged_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `, [
      emailId,
      event,
      status,
      providerResponse ? JSON.stringify(providerResponse) : null
    ]);
  } catch (err) {
    logger.error('Failed to write email log', { emailId, event, error: err.message });
  }
}

module.exports = { buildPayload, send, enqueue, logResult, renderTemplate };
