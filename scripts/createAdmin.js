#!/usr/bin/env node
'use strict';

/**
 * CLI script to create an admin user.
 *
 * Usage:
 *   node api/scripts/createAdmin.js <username> <password>
 *
 * The password is hashed with bcrypt at cost 12 before storage.
 */

const path = require('path');

// Load environment variables from api/.env if present
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch {
  // dotenv is optional — env vars may already be set in the environment
}

const bcrypt = require('bcryptjs');
const db = require('../src/config/db');

async function main() {
  const [username, password] = process.argv.slice(2);

  if (!username || !password) {
    console.error('Usage: node createAdmin.js <username> <password>');
    process.exit(1);
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    await db.run(
      'INSERT INTO admin_users (username, password_hash) VALUES (?, ?)',
      [username, passwordHash]
    );

    console.log(`Admin user "${username}" created successfully.`);
  } catch (err) {
    // SQLite UNIQUE constraint violation code
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || (err.message && err.message.includes('UNIQUE constraint failed'))) {
      console.error(`Error: Admin user "${username}" already exists.`);
      process.exit(1);
    }

    console.error('Error creating admin user:', err.message);
    process.exit(1);
  }
}

main();
