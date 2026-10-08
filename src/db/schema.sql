-- ============================================================
-- HEAVYY TOP UP ID — Database schema (SQLite)
-- All catalog & order data lives here. Nothing is hard-coded
-- in the view layer; the UI reads from these tables.
-- ============================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------- Categories ----------
CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  slug        TEXT    NOT NULL UNIQUE,
  icon        TEXT    DEFAULT '',
  sort_order  INTEGER DEFAULT 0,
  status      TEXT    NOT NULL DEFAULT 'active'  -- active | inactive
);

-- ---------- Games ----------
CREATE TABLE IF NOT EXISTS games (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  slug          TEXT    NOT NULL UNIQUE,
  publisher     TEXT    DEFAULT '',
  category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  logo          TEXT    DEFAULT '',
  banner        TEXT    DEFAULT '',
  -- JSON array describing the account fields the user must fill in.
  -- e.g. [{"key":"user_id","label":"User ID","type":"number","required":true,"placeholder":"Contoh: 123456789","hint":"Buka profil di dalam game"}]
  id_fields     TEXT    NOT NULL DEFAULT '[]',
  instructions  TEXT    NOT NULL DEFAULT '',
  -- Whether the supplier exposes a real ID-lookup endpoint for this game
  validation    TEXT    NOT NULL DEFAULT 'unavailable', -- available | unavailable
  status        TEXT    NOT NULL DEFAULT 'active',      -- active | inactive
  popular       INTEGER NOT NULL DEFAULT 0,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Products / denominations ----------
CREATE TABLE IF NOT EXISTS products (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id       INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  denomination  TEXT    DEFAULT '',
  price         INTEGER NOT NULL,          -- sell price in IDR (integer rupiah)
  cost          INTEGER NOT NULL DEFAULT 0,-- supplier cost in IDR
  supplier      TEXT    DEFAULT 'manual',  -- supplier code
  supplier_sku  TEXT    DEFAULT '',
  badge         TEXT    DEFAULT '',        -- e.g. "Populer", "Best Value"
  status        TEXT    NOT NULL DEFAULT 'active', -- active | inactive | out_of_stock
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Payment methods ----------
CREATE TABLE IF NOT EXISTS payment_methods (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  code          TEXT    NOT NULL UNIQUE,
  type          TEXT    DEFAULT 'ewallet', -- ewallet | bank | qris | retail
  logo          TEXT    DEFAULT '',
  fee_percent   REAL    NOT NULL DEFAULT 0,
  fee_fixed     INTEGER NOT NULL DEFAULT 0,
  -- 'configured' means the gateway credentials exist and the method is live.
  -- Anything else is surfaced to the user as "Belum dikonfigurasi".
  config_status TEXT    NOT NULL DEFAULT 'not_configured', -- configured | not_configured
  status        TEXT    NOT NULL DEFAULT 'active',
  sort_order    INTEGER NOT NULL DEFAULT 0
);

-- ---------- Promos ----------
CREATE TABLE IF NOT EXISTS promos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL,
  subtitle    TEXT    DEFAULT '',
  description TEXT    DEFAULT '',
  code        TEXT    DEFAULT '',
  badge       TEXT    DEFAULT '',
  image       TEXT    DEFAULT '',
  link        TEXT    DEFAULT '/game',
  status      TEXT    NOT NULL DEFAULT 'active',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- ---------- FAQ ----------
CREATE TABLE IF NOT EXISTS faqs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  question    TEXT    NOT NULL,
  answer      TEXT    NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  status      TEXT    NOT NULL DEFAULT 'active'
);

-- ---------- Orders ----------
CREATE TABLE IF NOT EXISTS orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id        TEXT    NOT NULL UNIQUE,   -- public order id, e.g. HVY-241008-XXXXXX
  game_id         INTEGER NOT NULL REFERENCES games(id),
  product_id      INTEGER NOT NULL REFERENCES products(id),
  -- snapshot of what was bought (so history survives catalog edits)
  game_name       TEXT    NOT NULL,
  game_slug       TEXT    NOT NULL,
  product_name    TEXT    NOT NULL,
  account_fields  TEXT    NOT NULL DEFAULT '{}', -- JSON {user_id, zone_id, ...}
  email           TEXT    DEFAULT '',
  whatsapp        TEXT    DEFAULT '',
  price           INTEGER NOT NULL,
  admin_fee       INTEGER NOT NULL DEFAULT 0,
  total           INTEGER NOT NULL,
  payment_code    TEXT    DEFAULT '',
  payment_name    TEXT    DEFAULT '',
  -- payment_status: unpaid | paid | expired | cancelled
  payment_status  TEXT    NOT NULL DEFAULT 'unpaid',
  -- topup_status: pending | processing | success | failed | refund
  topup_status    TEXT    NOT NULL DEFAULT 'pending',
  -- derived overall status used by the UI
  status          TEXT    NOT NULL DEFAULT 'pending_payment',
  -- pending_payment | paid | processing | success | failed | cancelled | refund
  note            TEXT    DEFAULT '',
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_whatsapp ON orders(whatsapp);

-- ---------- Order event log (audit trail / timeline) ----------
CREATE TABLE IF NOT EXISTS order_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    TEXT    NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  status      TEXT    NOT NULL,
  message     TEXT    DEFAULT '',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Settings (integration credentials state, etc.) ----------
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT DEFAULT '',
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
