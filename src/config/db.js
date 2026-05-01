'use strict';

const database = require('./database');
const { runMigrations } = require('./migrations');

// Initialize database and run migrations
async function initDatabase() {
  try {
    await database.init();
    await runMigrations(database);
  } catch (err) {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  }
}

// Initialize on module load
initDatabase();

module.exports = database;
