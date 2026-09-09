const express = require("express");
const db = require("../db");
const { requireAdminToken } = require("../middleware/auth");
const { render } = require("../services/templateEngine");

const router = express.Router();
router.use(requireAdminToken);

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT id, name, subject, created_at, updated_at FROM templates ORDER BY id DESC").all();
  res.json(rows);
});

router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM templates WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json({ ...row, blocks: row.blocks_json ? JSON.parse(row.blocks_json) : null });
});

router.post("/", (req, res) => {
  const { name, subject, html, blocks } = req.body || {};
  if (!name || !subject || !html) {
    return res.status(400).json({ error: "name, subject, and html are required" });
  }
  const info = db
    .prepare("INSERT INTO templates (name, subject, html, blocks_json) VALUES (?, ?, ?, ?)")
    .run(name, subject, html, blocks ? JSON.stringify(blocks) : null);
  res.status(201).json({ ok: true, template_id: info.lastInsertRowid });
});

router.put("/:id", (req, res) => {
  const { name, subject, html, blocks } = req.body || {};
  const existing = db.prepare("SELECT id FROM templates WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });

  db.prepare(
    "UPDATE templates SET name = ?, subject = ?, html = ?, blocks_json = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(name, subject, html, blocks ? JSON.stringify(blocks) : null, req.params.id);
  res.json({ ok: true });
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM templates WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

/**
 * POST /:id/preview
 * Body: { data: {...sample listing/contact fields...} }
 * Renders the template against sample data without sending anything.
 */
router.post("/:id/preview", (req, res) => {
  const template = db.prepare("SELECT * FROM templates WHERE id = ?").get(req.params.id);
  if (!template) return res.status(404).json({ error: "Not found" });

  const context = {
    ...(req.body?.data || {}),
    first_name: req.body?.data?.first_name || "Sample",
    unsubscribe_url: `${process.env.BASE_URL}/unsubscribe/preview-token`,
    company_name: process.env.COMPANY_NAME,
    company_address: process.env.COMPANY_ADDRESS,
  };

  const html = render(template.html, context);
  res.json({ subject: render(template.subject, context), html });
});

module.exports = router;
