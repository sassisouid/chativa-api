'use strict';
const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const cookieParser = require('cookie-parser');
const logger  = require('./utils/logger');

const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL  || 'https://chativa.pro',
  'https://chativa.pro',
  'https://www.chativa.pro',
  ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:8080', 'http://localhost:3000'] : []),
].filter((v, i, a) => a.indexOf(v) === i); // deduplicate

function createApp() {
  const app = express();

  // ── Security headers ──────────────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc:  ["'self'"],
        styleSrc:   ["'self'", "'unsafe-inline'"],
        imgSrc:     ["'self'", 'data:'],
        connectSrc: ["'self'"],
        frameSrc:   ["'none'"],
        objectSrc:  ["'none'"],
      },
    },
    hsts:       { maxAge: 31536000, includeSubDomains: true },
    frameguard: { action: 'deny' },
    noSniff:    true,
  }));

  // ── CORS ──────────────────────────────────────────────────────────────
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials:    true,
    methods:        ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // ── Cookie parser ─────────────────────────────────────────────────────
  app.use(cookieParser());

  // ── Body parsing (JSON — NOT applied to webhook route) ───────────────
  // The webhook route uses rawBody middleware instead (see routes/webhooks.js)
  app.use((req, res, next) => {
    if (req.path === '/api/webhooks/brevo/inbound') return next();
    express.json({ limit: '1mb' })(req, res, next);
  });

  // ── Request logging (method, path, status, duration) ─────────────────
  app.use((req, res, next) => {
    const startAt = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startAt) / 1e6;
      logger.info('Request', {
        method:     req.method,
        path:       req.path,
        status:     res.statusCode,
        durationMs: Math.round(durationMs),
        ip:         req.ip,
      });
    });
    next();
  });

  // ── HTTPS redirect in production ──────────────────────────────────────
  if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
      if (req.headers['x-forwarded-proto'] === 'http') {
        return res.redirect(301, `https://${req.headers.host}${req.url}`);
      }
      next();
    });
  }

  // ── Routes (mounted after middleware) ─────────────────────────────────
  app.use('/api/health',   require('./routes/health'));
  app.use('/api/contact',  require('./routes/contact'));
  app.use('/api/webhooks', require('./routes/webhooks'));
  app.use('/api/admin',    require('./routes/admin/index'));

  // ── 404 handler ───────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // ── Centralized error handler (must be last) ──────────────────────────
  app.use((err, req, res, _next) => {
    const statusCode    = err.statusCode || 500;
    const isOperational = err.isOperational === true;

    if (statusCode >= 500) {
      logger.error('Unhandled server error', {
        message: err.message,
        stack:   err.stack,
        path:    req.path,
        method:  req.method,
      });
    } else {
      logger.warn('Operational error', { message: err.message, statusCode, path: req.path });
    }

    res.status(statusCode).json({
      error: isOperational ? err.message : 'An unexpected error occurred',
      ...(err.fields ? { fields: err.fields } : {}),
    });
  });

  return app;
}

module.exports = { createApp };
