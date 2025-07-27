-- Notification preferences table
-- Stores user notification preferences

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id TEXT PRIMARY KEY,
  enabled BOOLEAN DEFAULT TRUE,
  
  -- Category preferences (JSON object)
  -- Example: {"system": true, "transaction": true, "marketing": false}
  categories TEXT DEFAULT '{"system": true, "transaction": true, "balance": true, "service": true}',
  
  -- Quiet hours settings (JSON object)
  -- Example: {"enabled": true, "start": "22:00", "end": "08:00", "timezone": "UTC"}
  quiet_hours TEXT DEFAULT NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_notification_preferences_updated 
ON notification_preferences(updated_at);

-- Notification history table (optional)
-- Tracks sent notifications for audit/debugging
CREATE TABLE IF NOT EXISTS notification_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL UNIQUE,
  recipient_id TEXT NOT NULL,
  template TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL, -- 'sent', 'failed', 'blocked', 'retry'
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for notification history
CREATE INDEX IF NOT EXISTS idx_notification_history_recipient 
ON notification_history(recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_history_status 
ON notification_history(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_history_message 
ON notification_history(message_id);