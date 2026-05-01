'use strict';
const crypto = require('crypto');

/**
 * Verifies a Brevo webhook HMAC-SHA256 signature using constant-time comparison.
 *
 * @param {Buffer|string} rawBody   - The raw request body bytes
 * @param {string}        signatureHeader - The hex-encoded signature from the request header
 * @param {string}        secret    - The shared webhook secret
 * @returns {boolean} true if the signature is valid, false otherwise
 */
function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = Buffer.from(signatureHeader, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (provided.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(provided, expectedBuf);
}

module.exports = { verifyWebhookSignature };
