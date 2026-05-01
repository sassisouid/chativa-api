'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

/**
 * Runs all pending SQL migrations from the api/migrations/ directory.
 * Migrations are applied in numeric filename order and tracked in the
 * schema_migrations table to ensure idempotency.
 *
 * @param {Database} db - Our custom database wrapper
 */
async function runMigrations(db) {
  // Ensure the tracking table exists
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT (datetime('now'))
    )
  `);

  // Read and sort migration files numerically by filename
  let files;
  try {
    files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  } catch (err) {
    logger.warn('Could not read migrations directory', { dir: MIGRATIONS_DIR, err: err.message });
    return;
  }

  const alreadyApplied = await db.all('SELECT filename FROM schema_migrations');
  const applied = new Set(alreadyApplied.map(row => row.filename));

  for (const filename of files) {
    if (applied.has(filename)) {
      continue;
    }

    const filePath = path.join(MIGRATIONS_DIR, filename);
    const sql = fs.readFileSync(filePath, 'utf8');

    // Apply migration in a transaction
    await db.transaction(async () => {
      await db.exec(sql);
      await db.run('INSERT INTO schema_migrations (filename) VALUES (?)', [filename]);
    });

    logger.info('Applied migration', { filename });
  }
}

module.exports = { runMigrations };
