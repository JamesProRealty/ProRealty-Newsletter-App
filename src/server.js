require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");

const webhookRoutes = require("./routes/webhooks");
const templateRoutes = require("./routes/templates");
const campaignRoutes = require("./routes/campaigns");
const dataRoutes = require("./routes/data");
const imageRoutes = require("./routes/images");
const unsubscribeRoutes = require("./routes/unsubscribe");

const app = express();
app.use(express.json({ limit: "5mb" }));

// Public
app.use("/unsubscribe", unsubscribeRoutes);
app.get("/health", (req, res) => res.json({ ok: true }));

// Zapier -> app (protected by x-webhook-secret header)
app.use("/api/webhooks", webhookRoutes);

// Admin API (protected by x-admin-token header or ?token=)
app.use("/api/templates", templateRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/images", imageRoutes);
app.use("/api", dataRoutes);

// Uploaded images (served publicly, same as any static asset — no token
// needed to view an image, only to upload/delete via the API above)
const uploadsDir = path.join(__dirname, "public", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

// Visual newsletter builder (React app, built separately — see client/README.md)
const builderDist = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(builderDist)) {
  app.use("/builder", express.static(builderDist));
  app.get("/builder/*", (req, res) => res.sendFile(path.join(builderDist, "index.html")));
} else {
  app.get("/builder", (req, res) => {
    res.status(503).send("Builder isn't built yet — run `npm install && npm run build` inside /client, see client/README.md.");
  });
}

// Simple admin dashboard (contacts/campaigns/templates - static)
app.use("/", express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Newsletter app listening on port ${PORT}`);
  console.log(`Admin dashboard: ${process.env.BASE_URL || "http://localhost:" + PORT}/`);
  console.log(`Newsletter builder: ${process.env.BASE_URL || "http://localhost:" + PORT}/builder`);
  console.log(`Zapier listing webhook: POST ${process.env.BASE_URL || "http://localhost:" + PORT}/api/webhooks/listing`);
  console.log(`Zapier contact webhook: POST ${process.env.BASE_URL || "http://localhost:" + PORT}/api/webhooks/contact`);
});
