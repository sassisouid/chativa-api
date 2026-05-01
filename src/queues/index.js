'use strict';

const Bull = require('bull');
const redisClient = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Bull requires three separate Redis connections: client, subscriber, and bclient.
 * We create each as a duplicate of the shared ioredis client so they all share
 * the same configuration (maxRetriesPerRequest: null, enableReadyCheck: false).
 */
const emailQueue = new Bull('email-send', {
  createClient(type) {
    switch (type) {
      case 'client':
        return redisClient;
      case 'subscriber':
        return redisClient.duplicate();
      case 'bclient':
        return redisClient.duplicate();
      default:
        return redisClient.duplicate();
    }
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 30000,
    },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

// Register the email worker processor with concurrency 1 (free-tier optimized)
emailQueue.process(1, require('./emailWorker'));

// ── Global event handlers ──────────────────────────────────────────────────

emailQueue.on('completed', (job) => {
  const emailId = job.data && job.data.emailId;
  logger.info('Email job completed', { jobId: job.id, emailId });
});

emailQueue.on('failed', (job, err) => {
  const emailId = job.data && job.data.emailId;
  logger.error('Email job failed', {
    jobId: job.id,
    emailId,
    attempt: job.attemptsMade,
    maxAttempts: job.opts.attempts,
    error: err.message,
  });

  // If all attempts are exhausted, mark the email as permanently failed
  if (job.attemptsMade >= job.opts.attempts) {
    try {
      // Lazy require to avoid circular dependency at module load time
      const emailService = require('../services/emailService');
      emailService.logResult(emailId, 'send_failed', 'failed', {
        error: err.message,
        jobId: job.id,
      });
    } catch (logErr) {
      logger.error('Failed to log permanent email failure', {
        emailId,
        error: logErr.message,
      });
    }
  }
});

module.exports = { emailQueue };
