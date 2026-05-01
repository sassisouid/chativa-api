'use strict';
const db = require('../config/db');
const redis = require('../config/redis');

async function getHealth(_req, res) {
  const result = {
    status:    'ok',
    db:        'ok',
    redis:     'ok',
    queue:     'ok',
    uptime:    Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };

  // DB check
  try {
    await db.get('SELECT 1');
  } catch (err) {
    result.db     = 'error';
    result.status = 'degraded';
  }

  // Redis check
  try {
    await redis.ping();
  } catch (err) {
    result.redis  = 'error';
    result.status = 'degraded';
  }

  // Queue check (lazy require to avoid circular dep at startup)
  try {
    const { emailQueue } = require('../queues/index');
    const counts = await emailQueue.getJobCounts();
    result.queue = {
      status:    'ok',
      waiting:   counts.waiting,
      active:    counts.active,
      completed: counts.completed,
      failed:    counts.failed,
      delayed:   counts.delayed,
    };
  } catch (err) {
    result.queue  = 'error';
    result.status = 'degraded';
  }

  const httpStatus = result.status === 'ok' ? 200 : 503;
  return res.status(httpStatus).json(result);
}

module.exports = { getHealth };
