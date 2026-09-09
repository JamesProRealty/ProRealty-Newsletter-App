function requireWebhookSecret(req, res, next) {
  const secret = req.header("x-webhook-secret");
  if (!secret || secret !== process.env.ZAPIER_WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Invalid or missing x-webhook-secret header" });
  }
  next();
}

function requireAdminToken(req, res, next) {
  const token = req.header("x-admin-token") || req.query.token;
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: "Invalid or missing admin token" });
  }
  next();
}

module.exports = { requireWebhookSecret, requireAdminToken };
