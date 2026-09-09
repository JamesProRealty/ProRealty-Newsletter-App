const express = require("express");
const db = require("../db");
const { requireAdminToken } = require("../middleware/auth");

const router = express.Router();
router.use(requireAdminToken);

router.get("/listings", (req, res) => {
  const rows = db.prepare("SELECT id, external_id, data, created_at FROM listings ORDER BY id DESC LIMIT 100").all();
  res.json(rows.map((r) => ({ ...r, data: JSON.parse(r.data) })));
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
