'use strict';

/**
 * Validates that all required environment variables are present.
 * Logs a descriptive error for each missing variable and calls
 * process.exit(1) if any are missing.
 *
 * Supports Railway environment variables and local .env fallbacks.
 */
function validateEnv() {
  const required = [
    'BREVO_API_KEY',
    'JWT_SECRET',
    'WEBHOOK_SECRET',
    'REDIS_URL',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    missing.forEach((key) => {
      console.error(JSON.stringify({
        level: 'error',
        msg: 'Missing required environment variable',
        key,
        hint: `Set ${key} in Railway Variables or your local .env file`,
        ts: new Date().toISOString(),
      }));
    });
    process.exit(1);
  }

  // Defaults for optional variables
  process.env.NODE_ENV      = process.env.NODE_ENV      || 'production';
  process.env.PORT          = process.env.PORT          || '3001';
  process.env.DB_PATH       = process.env.DB_PATH       || process.env.DATABASE_PATH || './data/chativa.db';
  process.env.API_BASE_URL  = process.env.API_BASE_URL  || 'https://api.chativa.pro';
  process.env.FRONTEND_URL  = process.env.FRONTEND_URL  || 'https://chativa.pro';
  process.env.SPAM_THRESHOLD = process.env.SPAM_THRESHOLD || '5';

  if (process.env.NODE_ENV === 'production' && process.env.DKIM_CONFIGURED !== 'true') {
    console.warn(JSON.stringify({
      level: 'warn',
      msg: 'DKIM_CONFIGURED is not set to "true". Outbound emails may fail DMARC checks.',
      hint: 'Configure DKIM DNS records in Brevo dashboard then set DKIM_CONFIGURED=true',
      ts: new Date().toISOString(),
    }));
  }
}

module.exports = { validateEnv };
