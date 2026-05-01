'use strict';

const jwt = require('jsonwebtoken');
const redis = require('../config/redis');
const { AuthError } = require('../utils/errors');

/**
 * Express middleware that enforces admin authentication.
 *
 * Checks:
 *   1. Authorization: Bearer <token> header is present
 *   2. JWT signature and expiry are valid
 *   3. Token role is 'admin'
 *   4. JWT jti is not in the Redis blacklist (i.e. not revoked)
 *
 * On success, attaches the decoded payload to req.user and calls next().
 * On failure, responds with HTTP 401 or 403 as appropriate.
 *
 * @type {import('express').RequestHandler}
 */
async function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || '';
    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer' || !parts[1]) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = parts[1];

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (payload.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Check Redis blacklist for revoked tokens
    const blacklisted = await redis.get(`jti-blacklist:${payload.jti}`);
    if (blacklisted) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    req.user = payload;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireAdmin };
