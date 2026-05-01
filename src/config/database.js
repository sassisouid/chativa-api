'use strict';

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');
const logger = require('../utils/logger');

const DB_PATH = process.env.DB_PATH || process.env.DATABASE_PATH || path.join(__dirname, '../../../data/chativa.db');

class Database {
  constructor() {
    this.db = null;
    this.isReady = false;
  }

  async init() {
    return new Promise((resolve, reject) => {
      // Ensure the data directory exists
      const dataDir = path.dirname(DB_PATH);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        logger.info('Created data directory', { dir: dataDir });
      }

      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          logger.error('Failed to open database', { error: err.message, path: DB_PATH });
          reject(err);
          return;
        }

        // Enable WAL mode and foreign keys
        this.db.serialize(() => {
          this.db.run('PRAGMA journal_mode = WAL');
          this.db.run('PRAGMA foreign_keys = ON');
          
          this.isReady = true;
          logger.info('Database connection established', { path: DB_PATH });
          resolve();
        });
      });
    });
  }

  // Promisified methods
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ 
            lastID: this.lastID, 
            changes: this.changes,
            lastInsertRowid: this.lastID // For compatibility with better-sqlite3
          });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  exec(sql) {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Transaction support
  async transaction(callback) {
    await this.run('BEGIN TRANSACTION');
    try {
      const result = await callback();
      await this.run('COMMIT');
      return result;
    } catch (err) {
      await this.run('ROLLBACK');
      throw err;
    }
  }

  close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            logger.error('Error closing database', { error: err.message });
          } else {
            logger.info('Database connection closed');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Create singleton instance
const database = new Database();

module.exports = database;