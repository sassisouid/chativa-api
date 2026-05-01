'use strict';
const rateLimit = require('express-rate-limit');
const redis = require('../config/redis');
const logger = require('../utils/logger');

// Try to use Redis store, fallback to memory store
let RedisStore;
try {
  ({ RedisStore } = require('rate-limit-redis'));
} catch (err) {
  logger.warn('rate-limit-redis not available, using memory store');
}

function createLimiter({ max, windowMs, keyPrefix }) {
  const config = {
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({ error: 'Too many requests. Please try again later.' }),
  };

  // Use Redis store if available and Redis is connected
  if (RedisStore && redis && typeof redis.call === 'function') {
    try {
      config.store = new RedisStore({
        sendCommand: (...args) => redis.call(...args),
        prefix: keyPrefix,
      });
      logger.info('Using Redis store for rate limiting');
    } catch (err) {
      logger.warn('Failed to create Redis store, using memory store', { error: err.message });
    }
  } else {
    logger.info('Using memory store for rate limiting (Redis not available)');
  }

  return rateLimit(config);
}

module.exports = {
  contactFormLimiter: createLimiter({ max: 5,  windowMs: 15 * 60 * 1000, keyPrefix: 'rl:contact:' }),
  loginLimiter:       createLimiter({ max: 10, windowMs: 15 * 60 * 1000, keyPrefix: 'rl:login:'   }),
};
