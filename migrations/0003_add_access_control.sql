-- Migration number: 0003
-- Created at: 2025-01-19 12:00:00
-- Description: Add access control system with roles and requests

-- User roles table
CREATE TABLE user_roles (
  user_id INTEGER PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('owner', 'admin', 'user')),
  granted_by INTEGER,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (telegram_id),
  FOREIGN KEY (granted_by) REFERENCES users (telegram_id)
);

-- Access requests table
CREATE TABLE access_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  username TEXT,
  first_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_by INTEGER,
  processed_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (telegram_id),
  FOREIGN KEY (processed_by) REFERENCES users (telegram_id)
);

-- Global bot settings (for debug mode and other configurations)
CREATE TABLE bot_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add access field to users table
ALTER TABLE users ADD COLUMN has_access BOOLEAN DEFAULT FALSE;

-- Create indexes for better performance
CREATE INDEX idx_user_roles_role ON user_roles(role);
CREATE INDEX idx_access_requests_status ON access_requests(status);
CREATE INDEX idx_access_requests_user_id ON access_requests(user_id);
CREATE INDEX idx_users_has_access ON users(has_access);

-- Insert default debug setting
INSERT INTO bot_settings (key, value) VALUES ('debug_level', '0');