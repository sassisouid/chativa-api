PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS emails (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  sender           TEXT    NOT NULL,
  sender_name      TEXT,
  recipient        TEXT    NOT NULL,
  account          TEXT    NOT NULL CHECK(account IN ('support', 'contact')),
  subject          TEXT,
  body_text        TEXT,
  body_html        TEXT,
  direction        TEXT    NOT NULL CHECK(direction IN ('inbound', 'outbound')),
  status           TEXT    NOT NULL DEFAULT 'unread' CHECK(status IN ('unread', 'read', 'replied')),
  read             INTEGER NOT NULL DEFAULT 0 CHECK(read IN (0, 1)),
  deleted          INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN (0, 1)),
  archived         INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0, 1)),
  spam             INTEGER NOT NULL DEFAULT 0 CHECK(spam IN (0, 1)),
  spam_score       REAL    NOT NULL DEFAULT 0,
  thread_id        TEXT,
  brevo_message_id TEXT,
  received_at      DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at       DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_emails_received_at  ON emails(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_sender        ON emails(sender);
CREATE INDEX IF NOT EXISTS idx_emails_read          ON emails(read);
CREATE INDEX IF NOT EXISTS idx_emails_spam          ON emails(spam);
CREATE INDEX IF NOT EXISTS idx_emails_deleted       ON emails(deleted);
CREATE INDEX IF NOT EXISTS idx_emails_archived      ON emails(archived);
CREATE INDEX IF NOT EXISTS idx_emails_thread_id     ON emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_status        ON emails(status);
CREATE INDEX IF NOT EXISTS idx_emails_brevo_msg_id  ON emails(brevo_message_id);

CREATE TABLE IF NOT EXISTS attachments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  email_id     INTEGER NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  filename     TEXT    NOT NULL,
  mime_type    TEXT    NOT NULL,
  size_bytes   INTEGER NOT NULL,
  storage_path TEXT    NOT NULL,
  received_at  DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_attachments_email_id ON attachments(email_id);

CREATE TABLE IF NOT EXISTS email_logs (
  id                INTEGER  PRIMARY KEY AUTOINCREMENT,
  email_id          INTEGER  REFERENCES emails(id) ON DELETE SET NULL,
  event             TEXT     NOT NULL,
  status            TEXT     NOT NULL CHECK(status IN ('sent','failed','retry','delivered','bounced')),
  error_message     TEXT,
  provider_response TEXT,
  logged_at         DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_email_logs_email_id  ON email_logs(email_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_logged_at ON email_logs(logged_at DESC);

CREATE TABLE IF NOT EXISTS admin_users (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  username      TEXT     NOT NULL UNIQUE,
  password_hash TEXT     NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         INTEGER  PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER  NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash TEXT     NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  revoked    INTEGER  NOT NULL DEFAULT 0 CHECK(revoked IN (0, 1)),
  created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id    ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
