'use strict';

const db = require('../config/db');
const { ValidationError } = require('../utils/errors');

/**
 * Builds a fully parameterized SQL query for the inbox.
 * No user value is ever interpolated into the SQL string.
 *
 * @param {object} filters
 * @param {number}  [filters.page=1]
 * @param {number}  [filters.limit=25]
 * @param {string}  [filters.search]
 * @param {boolean} [filters.spam]
 * @param {boolean} [filters.read]
 * @param {string}  [filters.status]
 * @param {boolean} [filters.archived]
 * @param {boolean} [filters.deleted]
 * @param {string}  [filters.thread_id]
 * @returns {{ sql: string, params: any[], countSql: string, countParams: any[] }}
 */
function buildInboxQuery({ page = 1, limit = 25, search, spam, read, status, archived, deleted, thread_id } = {}) {
  const conditions = [];
  const params     = [];

  // Soft-delete exclusion (default: hide deleted unless deleted=true is explicitly passed)
  if (!deleted) {
    conditions.push('deleted = 0');
  }

  // Archived filter (default: exclude archived from main inbox)
  if (archived !== undefined) {
    conditions.push('archived = ?');
    params.push(archived ? 1 : 0);
  } else {
    conditions.push('archived = 0');
  }

  // Spam filter
  if (spam !== undefined) {
    conditions.push('spam = ?');
    params.push(spam ? 1 : 0);
  }

  // Read filter
  if (read !== undefined) {
    conditions.push('read = ?');
    params.push(read ? 1 : 0);
  }

  // Status filter
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  // Full-text search on subject and sender (case-insensitive)
  if (search) {
    conditions.push('(LOWER(subject) LIKE ? OR LOWER(sender) LIKE ?)');
    const term = `%${search.toLowerCase()}%`;
    params.push(term, term);
  }

  // Thread filter
  if (thread_id) {
    conditions.push('thread_id = ?');
    params.push(thread_id);
  }

  const where      = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  // Thread view is chronological (ASC); default inbox is newest-first (DESC)
  const order      = thread_id ? 'ORDER BY received_at ASC' : 'ORDER BY received_at DESC';
  const safeLimit  = Math.min(Math.max(parseInt(limit) || 25, 1), 100);
  const offset     = (Math.max(parseInt(page) || 1, 1) - 1) * safeLimit;

  return {
    sql:         `SELECT * FROM emails ${where} ${order} LIMIT ? OFFSET ?`,
    params:      [...params, safeLimit, offset],
    countSql:    `SELECT COUNT(*) AS total FROM emails ${where}`,
    countParams: params,
  };
}

/**
 * Fetches a single email by id along with its thread siblings and attachment metadata.
 *
 * @param {number|string} id
 * @returns {Promise<{ email: object, thread: object[], attachments: object[] } | null>}
 */
async function getEmailWithThread(id) {
  const email = await db.get('SELECT * FROM emails WHERE id = ?', [id]);
  if (!email) return null;

  const thread = email.thread_id
    ? await db.all('SELECT * FROM emails WHERE thread_id = ? ORDER BY received_at ASC', [email.thread_id])
    : [email];

  const attachments = await db.all(
    'SELECT id, filename, mime_type, size_bytes FROM attachments WHERE email_id = ?',
    [id]
  );

  return { email, thread, attachments };
}

/**
 * Returns aggregate inbox statistics using a single SQLite FILTER query.
 *
 * @returns {Promise<{ total: number, unread: number, spam: number, replied: number, archived: number }>}
 */
async function getStats() {
  return await db.get(`
    SELECT
      COUNT(*)                                              AS total,
      COUNT(*) FILTER (WHERE read = 0 AND archived = 0)    AS unread,
      COUNT(*) FILTER (WHERE spam = 1)                     AS spam,
      COUNT(*) FILTER (WHERE status = 'replied')           AS replied,
      COUNT(*) FILTER (WHERE archived = 1)                 AS archived
    FROM emails
    WHERE deleted = 0
  `);
}

/**
 * Marks an email as read and sets its status to 'read'.
 *
 * @param {number|string} id
 */
async function markRead(id) {
  await db.run(
    "UPDATE emails SET read = 1, status = 'read', updated_at = datetime('now') WHERE id = ?",
    [id]
  );
}

/** Fields that may be updated via patchEmail. */
const PATCHABLE_FIELDS = new Set(['read', 'spam', 'archived']);

/**
 * Updates whitelisted fields on an email record.
 * Automatically keeps `status` in sync when `read` is patched.
 *
 * @param {number|string} id
 * @param {object} fields — only `read`, `spam`, and `archived` are accepted
 * @throws {ValidationError} if no valid fields are provided
 */
async function patchEmail(id, fields) {
  const allowed = Object.entries(fields).filter(([k]) => PATCHABLE_FIELDS.has(k));
  if (allowed.length === 0) {
    throw new ValidationError('No valid fields to update');
  }

  const setClauses = allowed.map(([k]) => {
    // Keep status in sync with the read flag
    if (k === 'read') {
      return `read = ?, status = CASE WHEN ? = 1 THEN 'read' ELSE 'unread' END`;
    }
    return `${k} = ?`;
  });

  const values = allowed.flatMap(([k, v]) => {
    const val = v ? 1 : 0;
    // read needs the value twice: once for the column, once for the CASE expression
    return k === 'read' ? [val, val] : [val];
  });

  await db.run(
    `UPDATE emails SET ${setClauses.join(', ')}, updated_at = datetime('now') WHERE id = ?`,
    [...values, id]
  );
}

/**
 * Soft-deletes an email by setting deleted=1.
 * The row is preserved in the database with all fields intact.
 *
 * @param {number|string} id
 */
async function softDelete(id) {
  await db.run(
    "UPDATE emails SET deleted = 1, updated_at = datetime('now') WHERE id = ?",
    [id]
  );
}

module.exports = {
  buildInboxQuery,
  getEmailWithThread,
  getStats,
  markRead,
  patchEmail,
  softDelete,
};
