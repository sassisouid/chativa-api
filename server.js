'use strict';

// ── 1. Validate env FIRST — before any other module loads ─────────────────────
// Load .env file if present (development convenience — dotenv is optional)
try { require('dotenv').config(); } catch {}

const { validateEnv } = require('./src/config/env');
validateEnv();

// ── 2. Infrastructure: DB (triggers migrations), Redis, Queues ────────────────
const db          = require('./src/config/db');       // opens SQLite + runs migrations
const redis       = require('./src/config/redis');    // connects ioredis
const { emailQueue } = require('./src/queues/index'); // registers Bull worker

const { createApp } = require('./src/app');
const logger = require('./src/utils/logger');

async function start() {
  try {
    // ── 3. Create Express app and mount all routes ──────────────────────────
    const app = createApp();

    const PORT = parseInt(process.env.PORT, 10) || 3001;

    // ── 4. Start listening ──────────────────────────────────────────────────
    app.listen(PORT, '0.0.0.0', () => {
      logger.info('Chativa Email API started', {
        port:       PORT,
        env:        process.env.NODE_ENV || 'development',
        apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${PORT}`,
        frontend:   process.env.FRONTEND_URL || 'http://localhost:8080',
      });

      // Warn if DKIM is not configured in production
      if (process.env.NODE_ENV === 'production' && process.env.DKIM_CONFIGURED !== 'true') {
        logger.warn('DKIM is not configured — outbound emails may fail DMARC checks', {
          hint: 'Set DKIM_CONFIGURED=true after configuring DKIM in Brevo dashboard',
        });
      }
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

start();
