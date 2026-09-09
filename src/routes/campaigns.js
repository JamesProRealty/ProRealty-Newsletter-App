const express = require("express");
const db = require("../db");
const { requireAdminToken } = require("../middleware/auth");
const { render } = require("../services/templateEngine");
const { sendEmail } = require("../services/email");

const router = express.Router();
router.use(requireAdminToken);

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM campaigns ORDER BY id DESC").all();
  res.json(rows);
});

router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

/**
 * POST /api/campaigns
 * Body: { template_id, listing_id (optional), subject (optional override), extra_data (optional) }
 * Creates a draft campaign. Does NOT send yet - call POST /:id/send to send.
 */
router.post("/", (req, res) => {
  const { template_id, listing_id, subject, extra_data } = req.body || {};
  const template = db.prepare("SELECT * FROM templates WHERE id = ?").get(template_id);
  if (!template) return res.status(400).json({ error: "Invalid template_id" });

  if (listing_id) {
    const listing = db.prepare("SELECT id FROM listings WHERE id = ?").get(listing_id);
    if (!listing) return res.status(400).json({ error: "Invalid listing_id" });
  }

  const activeCount = db.prepare("SELECT COUNT(*) c FROM contacts WHERE active = 1").get().c;

  const info = db
    .prepare(
      "INSERT INTO campaigns (template_id, listing_id, subject, total_recipients) VALUES (?, ?, ?, ?)"
    )
    .run(template_id, listing_id || null, subject || template.subject, activeCount);

  res.status(201).json({ ok: true, campaign_id: info.lastInsertRowid, recipient_count: activeCount });
});

/**
 * POST /api/campaigns/:id/send
 * Sends the campaign to every active contact. Runs synchronously in the background
 * (responds immediately with "sending" status; poll GET /:id for progress).
 */
router.post("/:id/send", async (req, res) => {
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!campaign) return res.status(404).json({ error: "Not found" });
  if (campaign.status === "sending" || campaign.status === "sent") {
    return res.status(400).json({ error: `Campaign already ${campaign.status}` });
  }

  const template = db.prepare("SELECT * FROM templates WHERE id = ?").get(campaign.template_id);
  const listing = campaign.listing_id
    ? db.prepare("SELECT * FROM listings WHERE id = ?").get(campaign.listing_id)
    : null;
  const listingData = listing ? JSON.parse(listing.data) : {};
  const contacts = db.prepare("SELECT * FROM contacts WHERE active = 1").all();

  db.prepare("UPDATE campaigns SET status = 'sending', total_recipients = ? WHERE id = ?").run(
    contacts.length,
    campaign.id
  );
  res.json({ ok: true, status: "sending", recipient_count: contacts.length });

  // Fire-and-forget background send loop (responds above; runs after response is sent)
  const delayMs = Number(process.env.SEND_DELAY_MS || 150);
  let sent = 0;
  let failed = 0;

  for (const contact of contacts) {
    const context = {
      ...listingData,
      first_name: contact.first_name || "there",
      last_name: contact.last_name || "",
      unsubscribe_url: `${process.env.BASE_URL}/unsubscribe/${contact.unsubscribe_token}`,
      company_name: process.env.COMPANY_NAME,
      company_address: process.env.COMPANY_ADDRESS,
    };

    const html = render(template.html, context);
    const subject = render(campaign.subject, context);

    const sendRow = db
      .prepare("INSERT INTO campaign_sends (campaign_id, contact_id, status) VALUES (?, ?, 'pending')")
      .run(campaign.id, contact.id);

    try {
      await sendEmail({ to: contact.email, subject, html });
      db.prepare("UPDATE campaign_sends SET status = 'sent', sent_at = datetime('now') WHERE id = ?").run(
        sendRow.lastInsertRowid
      );
      sent++;
    } catch (err) {
      db.prepare("UPDATE campaign_sends SET status = 'failed', error = ? WHERE id = ?").run(
        err.message,
        sendRow.lastInsertRowid
      );
      failed++;
    }

    db.prepare("UPDATE campaigns SET sent_count = ?, failed_count = ? WHERE id = ?").run(
      sent,
      failed,
      campaign.id
    );

    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }

  db.prepare("UPDATE campaigns SET status = 'sent', sent_at = datetime('now') WHERE id = ?").run(campaign.id);
});

module.exports = router;
