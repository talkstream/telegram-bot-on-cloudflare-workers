-- Migration number: 0002
-- Created at: 2025-07-16 15:00:00

-- Table for Telegram Stars payments
CREATE TABLE telegram_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  telegram_payment_charge_id TEXT UNIQUE NOT NULL,
  invoice_payload TEXT NOT NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('faction_change', 'direct_message')),
  related_entity_id TEXT,
  stars_amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refunded')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_player ON telegram_payments(player_id, created_at);
CREATE INDEX idx_payments_charge_id ON telegram_payments(telegram_payment_charge_id);

-- Table for pending invoices
CREATE TABLE pending_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  invoice_type TEXT NOT NULL CHECK (invoice_type IN ('faction_change', 'direct_message')),
  target_masked_id TEXT,
  target_faction TEXT,
  stars_amount INTEGER NOT NULL,
  invoice_link TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pending_invoices ON pending_invoices(player_id, created_at);
