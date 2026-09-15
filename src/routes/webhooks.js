const express = require("express");
const { nanoid } = require("nanoid");
const db = require("../db");
const { requireWebhookSecret } = require("../middleware/auth");
const { normalizeListingPayload } = require("../utils/urls");

const router = express.Router();
router.use(requireWebhookSecret);

/**
 * POST /api/webhooks/listing
 * Body: any JSON shape describing the listing (address, price, bedrooms, images, etc).
 * Zapier's "Webhooks by Zapier -> POST" action points here whenever a new/updated
 * listing should be turned into a newsletter.
 */
router.post("/listing", (req, res) => {
  const raw = req.body;
  if (!raw || Object.keys(raw).length === 0) {
    return res.status(400).json({ error: "Empty listing payload" });
  }
  const payload = normalizeListingPayload(raw);

  const stmt = db.prepare(
    "INSERT INTO listings (external_id, data) VALUES (?, ?)"
  );
  const info = stmt.run(payload.id || payload.listing_id || null, JSON.stringify(payload));

  res.status(201).json({ ok: true, listing_id: info.lastInsertRowid });
});

/**
 * POST /api/webhooks/contact
 * Body: { email, first_name, last_name, action }
 * action: "add" (default) upserts + activates. "remove" deactivates (soft delete).
 * Point a Zapier "New/Updated Contact in Rex" trigger at this for "add",
 * and a "Deleted Contact in Rex" (or similar) trigger at this with action=remove.
 */
router.post("/contact", (req, res) => {
  const { email, first_name, last_name, action } = req.body || {};
  if (!email) return res.status(400).json({ error: "email is required" });

  const normalizedEmail = String(email).trim().toLowerCase();

  if (action === "remove") {
    db.prepare("UPDATE contacts SET active = 0, updated_at = datetime('now') WHERE email = ?").run(
      normalizedEmail
    );
    return res.json({ ok: true, action: "removed" });
  }

  const existing = db.prepare("SELECT id FROM contacts WHERE email = ?").get(normalizedEmail);

  if (existing) {
    db.prepare(
      "UPDATE contacts SET first_name = ?, last_name = ?, active = 1, updated_at = datetime('now') WHERE email = ?"
    ).run(first_name || null, last_name || null, normalizedEmail);
    return res.json({ ok: true, action: "updated", contact_id: existing.id });
  }

  const info = db
    .prepare(
      "INSERT INTO contacts (email, first_name, last_name, unsubscribe_token) VALUES (?, ?, ?, ?)"
    )
    .run(normalizedEmail, first_name || null, last_name || null, nanoid(32));

  res.status(201).json({ ok: true, action: "created", contact_id: info.lastInsertRowid });
});

module.exports = router;
