'use strict';

/**
 * Bull processor for the 'email-send' queue.
 *
 * emailService is required lazily inside the function body to avoid a
 * circular dependency: emailService imports the queue (queues/index.js),
 * which would import emailWorker at module load time, creating a cycle.
 */
module.exports = async function emailWorker(job) {
  // Lazy require to break circular dependency with emailService
  const emailService = require('../services/emailService');

  const {
    emailId,
    from,
    to,
    subject,
    htmlContent,
    textContent,
    templateName,
    templateVars,
  } = job.data;

  let payload;
  try {
    payload = emailService.buildPayload({
      from,
      to,
      subject,
      htmlContent,
      textContent,
      templateName,
      templateVars,
    });
  } catch (err) {
    // buildPayload validation errors (e.g. invalid sender) are permanent — no retry
    err.noRetry = true;
    throw err;
  }

  let result;
  try {
    result = await emailService.send(payload);
  } catch (err) {
    // Permanent 4xx errors (except 429 Too Many Requests) should not be retried
    const status = err.status || err.statusCode || (err.response && err.response.status);
    if (status && status >= 400 && status < 500 && status !== 429) {
      err.noRetry = true;
      throw err;
    }
    // Transient errors (429, 5xx, network) — let Bull handle retries
    throw err;
  }

  // Success: update email record and log the result
  const db = require('../config/db');
  await db.run(
    `UPDATE emails SET status = 'sent', brevo_message_id = ?, updated_at = datetime('now') WHERE id = ?`,
    [result.messageId || null, emailId]
  );

  await emailService.logResult(emailId, 'sent', 'sent', result);
};
