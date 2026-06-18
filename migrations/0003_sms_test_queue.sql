CREATE TABLE IF NOT EXISTS sms_test_queue (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);
