'use strict';
const authService = require('../../services/authService');
const logger = require('../../utils/logger');

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  // SameSite=None required for cross-domain (Cloudflare Pages → Railway API)
  // SameSite=Strict is fine for local dev (same origin)
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
  path:     '/api/admin/auth/refresh',
  maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

async function login(req, res, next) {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = await authService.verifyCredentials(username, password);
    if (!user) {
      // Generic message — do not reveal whether username or password was wrong
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken  = authService.issueAccessToken(user);
    const refreshToken = await authService.issueRefreshToken(user.id);

    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
    logger.info('Admin login', { userId: user.id });
    return res.status(200).json({ accessToken });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const rawToken = req.cookies?.refreshToken;
    if (!rawToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const { accessToken, refreshToken } = await authService.rotateRefreshToken(rawToken);

    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
    return res.status(200).json({ accessToken });
  } catch (err) {
    if (err.statusCode === 401) {
      return res.status(401).json({ error: err.message });
    }
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const user = req.user; // set by requireAdmin middleware

    if (user) {
      await authService.revokeSession(user.jti, user.sub, user.exp);
    }

    // Clear the refresh token cookie regardless
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      path:     '/api/admin/auth/refresh',
    });

    logger.info('Admin logout', { userId: user?.sub });
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { login, refresh, logout };
