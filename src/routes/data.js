const express = require("express");
const multer = require("multer");
const { parse } = require("csv-parse/sync");
const db = require("../db");
const { requireAdminToken } = require("../middleware/auth");
const { normalizeUrl } = require("../utils/urls");

const router = express.Router();
router.use(requireAdminToken);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.get("/listings", (req, res) => {
  const rows = db.prepare("SELECT id, external_id, data, created_at FROM listings ORDER BY id DESC LIMIT 100").all();
  res.json(rows.map((r) => ({ ...r, data: JSON.parse(r.data) })));
});

/**
 * DELETE /api/listings/:id
 * Removes a single listing row — useful for clearing out test/duplicate
 * entries, or listings that have since sold/leased.
 */
router.delete("/listings/:id", (req, res) => {
  const existing = db.prepare("SELECT id FROM listings WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  db.prepare("DELETE FROM listings WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

/**
 * POST /api/listings/import-csv
 * multipart/form-data, field name "file". One-time bulk backfill for
 * listings that already existed in Rex before the Zapier webhook was turned
 * on (Zapier only catches new events going forward, not historical ones).
 *
 * Expected CSV columns (header row required, case-insensitive):
 *   address, price, saleOrRental, propertyType, photos,
 *   agent_name, agent_role, agent_phone, agent_email, agent_photo
 *
 * "photos" can hold multiple photo URLs in one cell — separate them with a
 * semicolon (;), e.g. "https://.../1.jpg;https://.../2.jpg". Only "address"
 * is required — everything else is optional and left blank if missing. Each
 * row becomes one listing with at most one agent; if a listing needs
 * multiple agents, add the rest via the builder afterward.
 */
router.post("/listings/import-csv", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded (expected field name 'file')" });

  let records;
  try {
    records = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true });
  } catch (e) {
    return res.status(400).json({ error: `Couldn't read that as a CSV file: ${e.message}` });
  }

  // Normalise headers to lowercase so "Address", "ADDRESS", "address" all work
  const normalised = records.map((row) => {
    const out = {};
    for (const key of Object.keys(row)) out[key.trim().toLowerCase()] = row[key];
    return out;
  });

  const insert = db.prepare("INSERT INTO listings (external_id, data) VALUES (?, ?)");
  const imported = [];
  const skipped = [];

  normalised.forEach((row, i) => {
    const address = (row.address || "").trim();
    if (!address) {
      skipped.push({ row: i + 2, reason: "Missing address" }); // +2: header row + 1-indexed
      return;
    }
    const agents = [];
    if ((row.agent_name || "").trim()) {
      agents.push({
        name: row.agent_name.trim(),
        role: (row.agent_role || "").trim(),
        phone: (row.agent_phone || "").trim(),
        email: (row.agent_email || "").trim(),
        photoSrc: normalizeUrl((row.agent_photo || "").trim()),
      });
    }
    const photos = (row.photos || "")
      .split(";")
      .map((url) => normalizeUrl(url.trim()))
      .filter(Boolean);
    const listing = {
      saleOrRental: (row.saleorrental || "Sale").trim(),
      propertyType: (row.propertytype || "").trim(),
      address,
      price: (row.price || "").trim(),
      photos,
      agents,
    };
    const info = insert.run(null, JSON.stringify(listing));
    imported.push(info.lastInsertRowid);
  });

  res.status(201).json({ ok: true, imported: imported.length, skipped });
});

router.get("/contacts", (req, res) => {
  const total = db.prepare("SELECT COUNT(*) c FROM contacts").get().c;
  const active = db.prepare("SELECT COUNT(*) c FROM contacts WHERE active = 1").get().c;
  const rows = db
    .prepare("SELECT id, email, first_name, last_name, active, created_at FROM contacts ORDER BY id DESC LIMIT 200")
    .all();
  res.json({ total, active, contacts: rows });
});

/**
 * POST /api/dev/seed-listings
 * Inserts a handful of sample listings shaped like what Zapier will eventually
 * push in from Rex, so the builder's "Populate from listing" flow has real
 * rows to test against before the Zapier integration is live. Safe to call
 * more than once — it always adds new rows rather than checking for existing.
 */
router.post("/dev/seed-listings", (req, res) => {
  const SAMPLE_LISTINGS = [
    {
      saleOrRental: "Sale",
      propertyType: "House",
      address: "24 Seaview Terrace, Glenelg SA 5045",
      price: "$895,000",
      photos: [
        "https://placehold.co/1200x800/D9CBB0/171B21?text=24+Seaview+Tce+-+Front",
        "https://placehold.co/1200x800/D9CBB0/171B21?text=Living+Room",
        "https://placehold.co/1200x800/D9CBB0/171B21?text=Kitchen",
        "https://placehold.co/1200x800/D9CBB0/171B21?text=Backyard",
      ],
      agents: [
        { name: "Jordan Blake", role: "Senior Sales Agent", phone: "0412 345 678", email: "jordan@prorealty.com.au", photoSrc: "https://placehold.co/300x300/EEF0F3/171B21?text=Jordan" },
      ],
    },
    {
      saleOrRental: "Rental",
      propertyType: "Apartment",
      address: "12/88 Hutt Street, Adelaide SA 5000",
      price: "$650 per week",
      photos: [
        "https://placehold.co/1200x800/C7D2CC/171B21?text=88+Hutt+St+-+Front",
        "https://placehold.co/1200x800/C7D2CC/171B21?text=Living+Area",
        "https://placehold.co/1200x800/C7D2CC/171B21?text=Balcony",
      ],
      agents: [
        { name: "Priya Nair", role: "Property Manager", phone: "0498 765 432", email: "priya@prorealty.com.au", photoSrc: "https://placehold.co/300x300/EEF0F3/171B21?text=Priya" },
      ],
    },
    {
      saleOrRental: "Sale",
      propertyType: "Townhouse",
      address: "7 Regent Street, Kensington SA 5068",
      price: "$1,150,000",
      photos: [
        "https://placehold.co/1200x800/CBD0DA/171B21?text=7+Regent+St+-+Front",
        "https://placehold.co/1200x800/CBD0DA/171B21?text=Dining+Room",
        "https://placehold.co/1200x800/CBD0DA/171B21?text=Main+Bedroom",
        "https://placehold.co/1200x800/CBD0DA/171B21?text=Courtyard",
        "https://placehold.co/1200x800/CBD0DA/171B21?text=Rooftop",
      ],
      agents: [
        { name: "Jordan Blake", role: "Senior Sales Agent", phone: "0412 345 678", email: "jordan@prorealty.com.au", photoSrc: "https://placehold.co/300x300/EEF0F3/171B21?text=Jordan" },
        { name: "Priya Nair", role: "Property Manager", phone: "0498 765 432", email: "priya@prorealty.com.au", photoSrc: "https://placehold.co/300x300/EEF0F3/171B21?text=Priya" },
      ],
    },
  ];

  const insert = db.prepare("INSERT INTO listings (external_id, data) VALUES (?, ?)");
  const ids = SAMPLE_LISTINGS.map((listing) => insert.run(null, JSON.stringify(listing)).lastInsertRowid);
  res.status(201).json({ ok: true, inserted: ids.length, listing_ids: ids });
});

/**
 * POST /api/dev/seed-brand-assets
 * Registers the branded header banners and property-stat icons (already
 * placed in src/public/uploads/ at build time) as real rows in the images
 * table, so the builder's defaults point at real hosted files instead of
 * inline base64 — safe to call more than once, it skips any URL already present.
 */
router.post("/dev/seed-brand-assets", (req, res) => {
  const ASSETS = [
    { name: "Header banner — For Sale", url: "/uploads/brand-header-for-sale.jpg" },
    { name: "Header banner — For Lease", url: "/uploads/brand-header-for-lease.jpg" },
    { name: "Lease icon", url: "/uploads/icon-lease.png" },
    { name: "Zoning icon", url: "/uploads/icon-zoning.png" },
    { name: "Parking icon", url: "/uploads/icon-parking.png" },
    { name: "Income icon", url: "/uploads/icon-income.png" },
    { name: "Land area icon", url: "/uploads/icon-land-area.png" },
    { name: "Building area icon", url: "/uploads/icon-building-area.png" },
  ];

  const inserted = [];
  for (const asset of ASSETS) {
    const existing = db.prepare("SELECT id FROM images WHERE url = ?").get(asset.url);
    if (existing) continue;
    const info = db
      .prepare("INSERT INTO images (name, filename, url) VALUES (?, ?, ?)")
      .run(asset.name, "", asset.url);
    inserted.push({ id: info.lastInsertRowid, ...asset });
  }
  res.status(201).json({ ok: true, inserted: inserted.length, images: inserted });
});

module.exports = router;
