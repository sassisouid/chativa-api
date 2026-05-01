'use strict';

const logger = require('../utils/logger');

/**
 * Mock Redis client for development when Redis is not available.
 * Provides the same interface but stores data in memory.
 */
class MockRedis {
  constructor() {
    this.data = new Map();
    this.connected = true;
    logger.info('Using Mock Redis (in-memory storage)');
  }

  // Basic Redis operations
  async get(key) {
    const item = this.data.get(key);
    if (!item) return null;
    
    // Check expiration
    if (item.expires && Date.now() > item.expires) {
      this.data.delete(key);
      return null;
    }
    
    return item.value;
  }

  async set(key, value, ...args) {
    const item = { value };
    
    // Handle EX (expire in seconds)
    for (let i = 0; i < args.length; i++) {
      if (args[i] === 'EX' && args[i + 1]) {
        item.expires = Date.now() + (parseInt(args[i + 1]) * 1000);
        i++; // Skip the next argument
      } else if (args[i] === 'NX') {
        // Only set if key doesn't exist
        if (this.data.has(key)) {
          return null; // Key exists, don't set
        }
      }
    }
    
    this.data.set(key, item);
    return 'OK';
  }

  async del(key) {
    const existed = this.data.has(key);
    this.data.delete(key);
    return existed ? 1 : 0;
  }

  async ping() {
    return 'PONG';
  }

  async call(...args) {
    const command = args[0].toLowerCase();
    const key = args[1];
    
    switch (command) {
      case 'get':
        return this.get(key);
      case 'set':
        return this.set(key, args[2], ...args.slice(3));
      case 'del':
        return this.del(key);
      case 'ping':
        return this.ping();
      default:
        logger.warn('Mock Redis: Unsupported command', { command, args });
        return 'OK';
    }
  }

  // Event emitter methods (no-op for mock)
  on() {}
  emit() {}
  removeListener() {}
}

module.exports = MockRedis;