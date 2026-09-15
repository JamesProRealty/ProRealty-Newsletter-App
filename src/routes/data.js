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
 * Understands two formats:
 *
 * 1. Rex's own native export (recommended — just export and upload as-is):
 *    address.unit_number / street_number / street_name / suburb_or_town /
 *    locality / state_or_region / postcode, property_category,
 *    listing_category, listing_agents.1.name/email/mobile (and .2. for a
 *    second agent), attr.buildarea/buildarea_unit, attr.landarea/landarea_unit,
 *    listing.price_advertise_as (falls back to price_match_sale / price_match /
 *    price_rent / archive.sale_lease_price if blank), images (comma-separated
 *    URLs).
 *
 * 2. A simpler hand-built format, if you'd rather create the CSV yourself:
 *    address, price, saleOrRental, propertyType, photos (semicolon-separated),
 *    agent_name, agent_role, agent_phone, agent_email, agent_photo,
 *    buildingSize, landSize
 *
 * Whichever columns are present get used — a plain "address" column always
 * wins over Rex's split address.* columns, a plain "price" always wins over
 * Rex's price fields, and so on. Only an address (either form) is required;
 * rows missing it are skipped and reported back to you.
 */
function buildAddressFromParts(row) {
  const unit = (row["address.unit_number"] || "").trim();
  const streetNumber = (row["address.street_number"] || "").trim();
  const streetName = (row["address.street_name"] || "").trim();
  const suburb = (row["address.suburb_or_town"] || row["address.locality"] || "").trim();
  const state = (row["address.state_or_region"] || "").trim();
  const postcode = (row["address.postcode"] || "").trim();

  const streetPart = [unit ? `${unit}/${streetNumber}` : streetNumber, streetName].filter(Boolean).join(" ");
  const localityPart = [suburb, state, postcode].filter(Boolean).join(" ");
  return [streetPart, localityPart].filter(Boolean).join(", ");
}

// Rex splits price across several fields depending on sale/rental/land, and
// "price_advertise_as" is the agent's own chosen display text (often
// literally "Contact Agent" — that's intentional, not a placeholder to work
// around, so it takes priority when present).
function buildPriceFromRexFields(row) {
  const advertiseAs = (row["listing.price_advertise_as"] || "").trim();
  if (advertiseAs) return advertiseAs;
  const numericRaw = (
    row["listing.price_match_sale"] ||
    row["listing.price_match"] ||
    row["listing.price_rent"] ||
    row["archive.sale_lease_price"] ||
    ""
  ).trim();
  if (!numericRaw) return "";
  const num = Number(numericRaw.replace(/[^0-9.]/g, ""));
  if (Number.isNaN(num) || num === 0) return "";
  return `$${num.toLocaleString("en-AU")}`;
}

function buildSaleOrRentalFromRexCategory(row) {
  const category = (row["listing_category"] || "").trim();
  return /rental/i.test(category) ? "Rental" : "Sale";
}

function formatArea(value, unit) {
  const v = (value || "").trim();
  if (!v) return "";
  const u = (unit || "m2").trim();
  return `${v}${u.toLowerCase() === "m2" ? "m²" : ` ${u}`}`;
}

// Rex exports up to two agents as listing_agents.1.* / listing_agents.2.*
// (name/email/mobile only — no role or photo in the export).
function buildAgentsFromRexColumns(row) {
  const agents = [];
  for (const n of [1, 2]) {
    const name = (row[`listing_agents.${n}.name`] || "").trim();
    if (!name) continue;
    agents.push({
      name,
      role: "",
      phone: (row[`listing_agents.${n}.mobile`] || "").trim(),
      email: (row[`listing_agents.${n}.email`] || "").trim(),
      photoSrc: "",
    });
  }
  return agents;
}

router.post("/listings/import-csv", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded (expected field name 'file')" });

  let records;
  try {
    records = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true, bom: true });
  } catch (e) {
    return res.status(400).json({ error: `Couldn't read that as a CSV file: ${e.message}` });
  }

  // Normalise headers to lowercase EXCEPT Rex's dotted/numbered columns, which
  // we need to match case-sensitively against their real export (e.g.
  // "listing_agents.1.name"). Simple hand-built columns stay case-insensitive
  // for convenience.
  const normalised = records.map((row) => {
    const out = {};
    for (const key of Object.keys(row)) {
      const trimmedKey = key.trim();
      out[trimmedKey] = row[key];
      out[trimmedKey.toLowerCase()] = row[key];
    }
    return out;
  });

  const insert = db.prepare("INSERT INTO listings (external_id, data) VALUES (?, ?)");
  const imported = [];
  const skipped = [];

  normalised.forEach((row, i) => {
    const address = (row.address || "").trim() || buildAddressFromParts(row);
    if (!address) {
      skipped.push({ row: i + 2, reason: "Missing address" }); // +2: header row + 1-indexed
      return;
    }

    const agents = (row.agent_name || "").trim()
      ? [{
          name: row.agent_name.trim(),
          role: (row.agent_role || "").trim(),
          phone: (row.agent_phone || "").trim(),
          email: (row.agent_email || "").trim(),
          photoSrc: normalizeUrl((row.agent_photo || "").trim()),
        }]
      : buildAgentsFromRexColumns(row);

    const photos = (row.photos || "")
      .split(";")
      .map((url) => normalizeUrl(url.trim()))
      .filter(Boolean);
    if (photos.length === 0 && row.images) {
      photos.push(...row.images.split(",").map((url) => normalizeUrl(url.trim())).filter(Boolean));
    }

    const listing = {
      saleOrRental: (row.saleorrental || "").trim() || buildSaleOrRentalFromRexCategory(row),
      propertyType: (row.propertytype || "").trim() || (row.property_category || "").trim(),
      address,
      price: (row.price || "").trim() || buildPriceFromRexFields(row),
      buildingSize: (row.buildingsize || "").trim() || formatArea(row["attr.buildarea"], row["attr.buildarea_unit"]),
      landSize: (row.landsize || "").trim() || formatArea(row["attr.landarea"], row["attr.landarea_unit"]),
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
