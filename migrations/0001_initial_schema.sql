-- resa-massage initial schema
-- All timestamps stored as TEXT (ISO 8601); SQLite has no native datetime type
-- Nullable columns: slots.booking_id (NULL = available), bookings.phone (NULL = deleted per RGPD)

CREATE TABLE IF NOT EXISTS practitioners (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  slot_duration_minutes INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS availability_windows (
  id TEXT PRIMARY KEY,
  practitioner_id TEXT NOT NULL,
  day_date TEXT NOT NULL,   -- YYYY-MM-DD
  start_time TEXT NOT NULL, -- HH:MM (24h)
  end_time TEXT NOT NULL    -- HH:MM (24h)
);

CREATE TABLE IF NOT EXISTS slots (
  id TEXT PRIMARY KEY,
  practitioner_id TEXT NOT NULL,
  day_date TEXT NOT NULL,   -- YYYY-MM-DD
  start_time TEXT NOT NULL, -- HH:MM (24h)
  end_time TEXT NOT NULL,   -- HH:MM (24h)
  booking_id TEXT           -- NULL = available; set to bookings.id when claimed
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  participant_name TEXT NOT NULL,
  phone TEXT,               -- nullable: set to NULL after last SMS confirmed (RGPD FR37)
  practitioner_id TEXT NOT NULL,
  slot_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sms_jobs (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  type TEXT NOT NULL,       -- 'confirmation' | 'reminder' | 'practitioner_trigger'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'sent' | 'cancelled'
  scheduled_at TEXT NOT NULL,  -- ISO 8601: when to send
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sms_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  confirmation_enabled INTEGER NOT NULL DEFAULT 1,         -- 1 = on, 0 = off
  reminder_enabled INTEGER NOT NULL DEFAULT 1,            -- 1 = on, 0 = off
  practitioner_trigger_enabled INTEGER NOT NULL DEFAULT 1  -- 1 = on, 0 = off
);

-- Seed: single sms_config row — all 3 SMS modes enabled by default
-- INSERT OR IGNORE is safe to re-run (idempotent)
INSERT OR IGNORE INTO sms_config (id, confirmation_enabled, reminder_enabled, practitioner_trigger_enabled)
VALUES (1, 1, 1, 1);
