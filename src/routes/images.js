const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { nanoid } = require("nanoid");
const db = require("../db");
const { requireAdminToken } = require("../middleware/auth");

const router = express.Router();
router.use(requireAdminToken);

const uploadsDir = path.join(__dirname, "..", "public", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${nanoid(16)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB per file
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

/**
 * GET /api/images
 * Lists every image in the shared library, most recent first.
 */
router.get("/", (req, res) => {
  const rows = db.prepare("SELECT id, name, url, created_at FROM images ORDER BY id DESC").all();
  res.json(rows);
});

/**
 * POST /api/images
 * multipart/form-data, field name "files" (supports multiple).
 * Also accepts a "urls" field (JSON array of external URLs, e.g. from a Zapier
 * listing payload) to register already-hosted photos into the library without
 * re-uploading them.
 */
router.post("/", upload.array("files", 20), async (req, res) => {
  const saved = [];

  for (const file of req.files || []) {
    const url = `/uploads/${file.filename}`;
    const info = db
      .prepare("INSERT INTO images (name, filename, url) VALUES (?, ?, ?)")
      .run(file.originalname, file.filename, url);
    saved.push({ id: info.lastInsertRowid, name: file.originalname, url, created_at: new Date().toISOString() });
  }

  if (req.body?.urls) {
    try {
      const urls = JSON.parse(req.body.urls);
      for (const entry of urls) {
        const externalUrl = typeof entry === "string" ? entry : entry.url;
        const name = typeof entry === "string" ? externalUrl : entry.name || externalUrl;
        if (!externalUrl) continue;
        // Skip if this exact external URL is already registered
        const existing = db.prepare("SELECT id FROM images WHERE url = ?").get(externalUrl);
        if (existing) continue;
        const info = db
          .prepare("INSERT INTO images (name, filename, url) VALUES (?, ?, ?)")
          .run(name, "", externalUrl);
        saved.push({ id: info.lastInsertRowid, name, url: externalUrl, created_at: new Date().toISOString() });
      }
    } catch {
      return res.status(400).json({ error: "urls must be a JSON array" });
    }
  }

  res.status(201).json(saved);
});

/**
 * DELETE /api/images/:id
 * Removes the DB row and, if it's a file we host (not an external URL), the file on disk.
 */
router.delete("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM images WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Not found" });

  if (row.filename) {
    const filePath = path.join(uploadsDir, row.filename);
    fs.unlink(filePath, () => {}); // best-effort; ignore if already gone
  }
  db.prepare("DELETE FROM images WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
