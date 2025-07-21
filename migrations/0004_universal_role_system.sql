-- Migration number: 0004
-- Created at: 2025-01-21 15:00:00
-- Description: Update role system to be platform-agnostic

-- Add new columns to user_roles table
ALTER TABLE user_roles ADD COLUMN platform_id TEXT;
ALTER TABLE user_roles ADD COLUMN platform TEXT DEFAULT 'telegram';
ALTER TABLE user_roles ADD COLUMN user_id_new TEXT;

-- Migrate existing data
UPDATE user_roles SET platform_id = CAST(user_id AS TEXT), user_id_new = 'telegram_' || CAST(user_id AS TEXT);

-- Create new user_roles table with proper structure
CREATE TABLE user_roles_new (
  user_id TEXT PRIMARY KEY,
  platform_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('owner', 'admin', 'user')),
  granted_by TEXT,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(platform_id, platform)
);

-- Copy data to new table
INSERT INTO user_roles_new (user_id, platform_id, platform, role, granted_by, granted_at)
SELECT user_id_new, platform_id, platform, role, granted_by, granted_at FROM user_roles;

-- Drop old table and rename new one
DROP TABLE user_roles;
ALTER TABLE user_roles_new RENAME TO user_roles;

-- Create indexes
CREATE INDEX idx_user_roles_role ON user_roles(role);
CREATE INDEX idx_user_roles_platform ON user_roles(platform);
CREATE INDEX idx_user_roles_platform_id ON user_roles(platform_id, platform);

-- Add user_id column to users table for universal ID
ALTER TABLE users ADD COLUMN user_id TEXT;
UPDATE users SET user_id = 'telegram_' || CAST(telegram_id AS TEXT);
CREATE INDEX idx_users_user_id ON users(user_id);