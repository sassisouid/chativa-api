'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const redis = require('../config/redis');
const { AuthError } = require('../utils/errors');

/**
 * Verify admin credentials against the database.
 *
 * @param {string} username
 * @param {string} password  — plaintext password from the login request
 * @returns {Promise<object|null>} user row if credentials are valid, null otherwise
 */
async function verifyCredentials(username, password) {
  const user = await db.get('SELECT * FROM admin_users WHERE username = ?', [username]);

  if (!user) {
    return null;
  }

  const match = await bcrypt.compare(password, user.password_hash);
  return match ? user : null;
}

/**
 * Issue a short-lived JWT access token for an admin user.
 *
 * @param {object} user — admin_users row (must have .id)
 * @returns {string} signed JWT
 */
function issueAccessToken(user) {
  const payload = {
    sub: user.id,
    role: 'admin',
    jti: uuidv4(),
  };

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
}

/**
 * Generate a refresh token, store its SHA-256 hash in the database,
 * and return the raw (unhashed) token to the caller.
 *
 * @param {number} userId
 * @returns {Promise<string>} raw refresh token (64 random bytes as hex)
 */
async function issueRefreshToken(userId) {
  const rawToken = crypto.randomBytes(64).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  await db.run(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES (?, ?, datetime('now', '+7 days'))`,
    [userId, tokenHash]
  );

  return rawToken;
}

/**
 * Rotate a refresh token: verify the old one, revoke it, and issue a new pair.
 *
 * @param {string} rawToken — the raw refresh token previously issued to the client
 * @returns {Promise<{ accessToken: string, refreshToken: string }>}
 * @throws {AuthError} if the token is invalid, expired, or already revoked
 */
async function rotateRefreshToken(rawToken) {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const row = await db.get(
    `SELECT * FROM refresh_tokens
     WHERE token_hash = ?
       AND revoked = 0
       AND expires_at > datetime('now')`,
    [tokenHash]
  );

  if (!row) {
    throw new AuthError('Invalid or expired refresh token');
  }

  // Revoke the old token
  await db.run('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?', [row.id]);

  // Fetch the user so we can embed the correct sub in the new access token
  const user = await db.get('SELECT * FROM admin_users WHERE id = ?', [row.user_id]);

  if (!user) {
    throw new AuthError('Invalid or expired refresh token');
  }

  const accessToken = issueAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id);

  return { accessToken, refreshToken };
}

/**
 * Revoke a session by:
 *   1. Adding the JWT's jti to the Redis blacklist (TTL = remaining JWT lifetime)
 *   2. Revoking all active refresh tokens for the user
 *
 * @param {string} jti      — JWT ID claim from the access token
 * @param {number} userId   — admin user ID
 * @param {number} jwtExp   — JWT exp claim (Unix timestamp in seconds)
 * @returns {Promise<void>}
 */
async function revokeSession(jti, userId, jwtExp) {
  const ttl = jwtExp - Math.floor(Date.now() / 1000);

  if (ttl > 0) {
    await redis.set(`jti-blacklist:${jti}`, '1', 'EX', ttl);
  }

  await db.run(
    `UPDATE refresh_tokens SET revoked = 1
     WHERE user_id = ? AND revoked = 0`,
    [userId]
  );
}

module.exports = {
  verifyCredentials,
  issueAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeSession,
};
