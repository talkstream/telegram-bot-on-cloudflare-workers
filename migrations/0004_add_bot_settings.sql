-- Migration: Add bot_settings table for storing bot configuration
-- This table is used to store bot-wide settings like debug level

CREATE TABLE IF NOT EXISTS bot_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add initial settings
INSERT OR IGNORE INTO bot_settings (key, value) VALUES ('debug_level', '0');

-- Add index for quick lookups
CREATE INDEX IF NOT EXISTS idx_bot_settings_key ON bot_settings(key);