-- Vitrine xPartner — schema inicial
-- D1: leads validados e eventos de uso (sem dados sensíveis em texto livre)

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  email_domain TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone_e164 TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT,
  offer_id TEXT,
  offer_label TEXT,
  offer_url TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'vitrine',
  page TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  country TEXT,
  city TEXT,
  consent INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'new',
  telegram_sent INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_leads_created ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads (email_normalized);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads (phone_e164);
CREATE INDEX IF NOT EXISTS idx_leads_product ON leads (product_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status, created_at DESC);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  type TEXT NOT NULL,
  product_id TEXT,
  offer_id TEXT,
  meta TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_created ON events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON events (type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_product ON events (product_id);
