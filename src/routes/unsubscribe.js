const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/:token", (req, res) => {
  const contact = db.prepare("SELECT * FROM contacts WHERE unsubscribe_token = ?").get(req.params.token);

  if (!contact) {
    return res.status(404).send("<h1>Link not found</h1><p>This unsubscribe link is invalid or expired.</p>");
  }

  db.prepare("UPDATE contacts SET active = 0, updated_at = datetime('now') WHERE id = ?").run(contact.id);

  res.send(`
    <html>
      <body style="font-family: sans-serif; max-width: 480px; margin: 60px auto; text-align: center;">
        <h2>You've been unsubscribed</h2>
        <p>${contact.email} will no longer receive these emails.</p>
      </body>
    </html>
  `);
});

module.exports = router;
