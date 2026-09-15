const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

// DATA_DIR lets you point the database at a persistent volume on hosts
// (like Railway) where the regular filesystem is wiped on every deploy.
const dataDir = process.env.DATA_DIR || path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "newsletter.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  source TEXT DEFAULT 'rex',
  active INTEGER DEFAULT 1,
  unsubscribe_token TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT,
  data TEXT NOT NULL, -- raw JSON payload from Zapier
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT NOT NULL,
  blocks_json TEXT, -- the visual builder's block structure (design source of truth); html is generated from this
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  filename TEXT NOT NULL, -- on-disk filename under public/uploads
  url TEXT NOT NULL,      -- path the app serves it at, e.g. /uploads/xxxx.jpg
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL,
  listing_id INTEGER,
  subject TEXT NOT NULL,
  status TEXT DEFAULT 'draft', -- draft | sending | sent | failed
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  sent_at TEXT,
  FOREIGN KEY (template_id) REFERENCES templates(id),
  FOREIGN KEY (listing_id) REFERENCES listings(id)
);

CREATE TABLE IF NOT EXISTS campaign_sends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  contact_id INTEGER NOT NULL,
  status TEXT DEFAULT 'pending', -- pending | sent | failed
  error TEXT,
  sent_at TEXT,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (contact_id) REFERENCES contacts(id)
);
`);

// Only enforced when external_id is actually set (a "partial" unique index) —
// listings added manually through the builder, with no external_id at all,
// are exempt and can coexist freely. This is what lets re-importing the same
// CSV, or Zapier re-sending an updated listing, update the existing row
// instead of creating a duplicate. Kept separate from the block above and
// wrapped in try/catch: if any already-duplicated external_id values exist
// from before this feature existed, creating the index would fail — and we'd
// rather the app still start up (without the constraint, logging a warning)
// than crash entirely on deploy. Run the dedupe endpoint (see routes/data.js)
// to clean up old duplicates, then restart, and this will apply successfully.
try {
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_external_id
      ON listings(external_id) WHERE external_id IS NOT NULL;
  `);
} catch (e) {
  console.warn("Could not create unique index on listings.external_id — likely pre-existing duplicate external_ids. Run POST /api/listings/dedupe, then restart the app. Continuing without the constraint for now.", e.message);
}

module.exports = db;
