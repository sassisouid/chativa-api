'use strict';

const Redis = require('ioredis');
const MockRedis = require('./mockRedis');
const logger = require('../utils/logger');

let redisClient;

function createRedisClient() {
  const url = process.env.REDIS_URL;

  if (!url) {
    logger.warn('REDIS_URL not set, using Mock Redis');
    return new MockRedis();
  }

  const client = new Redis(url, {
    maxRetriesPerRequest: null,  // required by Bull
    enableReadyCheck: false,     // required by Bull
    connectTimeout: 10000,
    lazyConnect: false,
    retryStrategy(times) {
      if (times > 5) {
        logger.warn('Redis: max retries reached, giving up');
        return null;
      }
      const delay = Math.min(times * 1000, 5000);
      logger.warn('Redis: retrying connection', { attempt: times, delayMs: delay });
      return delay;
    },
  });

  client.on('connect', () => logger.info('Redis connected'));
  client.on('ready',   () => logger.info('Redis ready'));
  client.on('error',   (err) => logger.error('Redis error', { error: err.message, code: err.code }));
  client.on('close',   () => logger.warn('Redis connection closed'));
  client.on('reconnecting', (delay) => logger.warn('Redis reconnecting', { delayMs: delay }));

  return client;
}

redisClient = createRedisClient();

module.exports = redisClient;
