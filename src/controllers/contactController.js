'use strict';
const emailService = require('../services/emailService');
const logger = require('../utils/logger');

async function handleContact(req, res, next) {
  try {
    const { name, email, message } = req.body || {};

    // Validate required fields — all must be non-empty non-whitespace strings
    const errors = [];
    if (!name    || !String(name).trim())    errors.push('name');
    if (!email   || !String(email).trim())   errors.push('email');
    if (!message || !String(message).trim()) errors.push('message');

    if (errors.length > 0) {
      return res.status(422).json({
        error: 'Validation failed',
        fields: errors,
      });
    }

    const trimmedName    = String(name).trim();
    const trimmedEmail   = String(email).trim();
    const trimmedMessage = String(message).trim();
    const receivedAt     = new Date().toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC';

    // Enqueue admin notification to contact@chativa.pro
    await emailService.enqueue({
      from:         'contact@chativa.pro',
      to:           'contact@chativa.pro',
      subject:      `New contact form submission from ${trimmedName}`,
      templateName: 'contact-notification',
      templateVars: {
        name:       trimmedName,
        email:      trimmedEmail,
        message:    trimmedMessage,
        receivedAt,
      },
    });

    // Enqueue confirmation email to the visitor
    await emailService.enqueue({
      from:         'contact@chativa.pro',
      to:           trimmedEmail,
      subject:      'We received your message — Chativa',
      templateName: 'contact-confirmation',
      templateVars: {
        name:    trimmedName,
        message: trimmedMessage,
      },
    });

    logger.info('Contact form submitted', { name: trimmedName, email: trimmedEmail });

    return res.status(202).json({
      message: 'Your message has been received.',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { handleContact };
