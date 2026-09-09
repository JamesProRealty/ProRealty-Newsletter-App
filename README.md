# Newsletter App

Receives listing data from Zapier, lets you design newsletters visually and populate them
from that listing data, and stores images and templates for reuse. Runs as a standalone
Node.js app on your own server.

> **Current usage mode:** you're exporting the built HTML and sending through your existing
> CRM's bulk email tool, not sending from this app. That means **you can skip section 3
> (Email sending) and the admin dashboard's campaign/contact features entirely** — you only
> need sections 1, 2, 4, and 5 below (install, run, Zapier, the builder). The email-sending,
> campaign, and contact-management code is still in the app and fully working if you want
> in-app sending again later — it's just not part of your current workflow, so nothing below
> requires it. No `EMAIL_PROVIDER` setup, no sending-domain verification needed for now.

## How it fits together

```
Zapier (new/updated listing in your source system)
   │  POST with x-webhook-secret header
   ▼
POST /api/webhooks/listing   →  stored in SQLite

You (via the visual builder at "/builder")
   1. Drag blocks onto the canvas, or hit "Populate from listing" to auto-fill
      the header, photos, and agents from a real listing
   2. Upload photos (or reuse ones already in the shared library)
   3. Save the design, then hit "Export HTML"
   4. Paste that HTML into your CRM's bulk email tool and send from there

(Optional, not part of your current workflow — still fully built and available if you want it:
Zapier can also sync Rex contacts in via POST /api/webhooks/contact, and the admin dashboard
at "/" can create campaigns and send directly from this app instead of exporting.)
```

## 1. Install

Requires Node.js 18+.

```bash
npm install
cp .env.example .env
```

The visual builder (a separate React app served at `/builder`) comes **pre-built** in this
package — `client/dist/` is already generated and committed, so a plain `npm install` at the
project root is all you need to get running; nothing needs to build on the server.

If you edit the builder's own code later, rebuild it from the project root with:

```bash
npm run rebuild-client
```

> **Why the script isn't called `build`:** some hosting platforms (Railway included) auto-detect
> and run any script literally named `build` during deployment. Since the client is already
> pre-built and committed, we don't want that happening automatically — it's namespaced as
> `rebuild-client` so it only runs when you explicitly ask for it.

Edit `.env`:

- `ADMIN_TOKEN` / `ZAPIER_WEBHOOK_SECRET` — generate long random strings (e.g. `openssl rand -hex 32`).
- `BASE_URL` — the public URL this app will be reachable at. Still worth setting correctly even
  though you're not sending from here — it's used to build the `{{{unsubscribe_url}}}` token
  in exported HTML (your CRM's own unsubscribe handling will likely replace or ignore this).
- `COMPANY_NAME` / `COMPANY_ADDRESS` — used in template defaults; not required for your current workflow.
- Email provider — **skip this**, see section 3 for why it doesn't apply to your current setup.

> **Known dependency advisories:** `npm audit` will flag a moderate issue in Express's
> transitive `qs` dependency (no non-breaking fix available yet) and, inside `client/`, a
> moderate `esbuild` advisory that only affects Vite's local dev server (not your production
> build). Neither is fixed by `npm audit fix` without a major version bump; worth revisiting
> periodically rather than force-upgrading blind before shipping.

## 2. Run

```bash
npm start
```

- **Visual builder**: `http://your-server:3000/builder` — enter your `ADMIN_TOKEN` in the
  top-right field (stored in your browser's localStorage, same idea as the dashboard below).
- **Admin dashboard**: `http://your-server:3000/` — for managing contacts and sending campaigns.
  Enter your `ADMIN_TOKEN` in the top-right box there too.

There's no separate user-account system — the admin token is the only login, so keep it secret
and share it only with people who should be able to manage campaigns and templates.

In production, put this behind a reverse proxy (nginx/Caddy) with HTTPS, and run it under a
process manager like `pm2` or a systemd service so it restarts on crash/reboot:

```bash
npm install -g pm2
pm2 start src/server.js --name newsletter-app
pm2 save
```

## 3. Email sending — you still need an ESP (skip this section for now)

**Not needed for your current setup** — you're exporting HTML and sending through your
existing CRM, so none of this applies right now. Leaving it here for if/when you want
in-app sending again.

Your own server sending raw SMTP to Gmail/Outlook inboxes will get flagged as spam almost
immediately — there's no reputation history, no SPF/DKIM/DMARC alignment, and no bounce
handling. This app doesn't replace that layer; it calls it via API. Two supported options:

**Option A — Resend (recommended, easiest):**
1. Sign up at resend.com, verify your sending domain (adds a few DNS records they give you).
2. Set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY=...`, `FROM_EMAIL=you@yourdomain.com`.

**Option B — Any SMTP provider (Postmark, AWS SES, etc.):**
1. Set `EMAIL_PROVIDER=smtp` and fill in `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`.

Either way, **verify your sending domain** with the provider (SPF + DKIM records) before
sending real volume — this is the single biggest factor in landing in inboxes vs spam.

## 4. Wiring up Zapier

**Listing data → newsletter:**
- Trigger: whatever produces your listing data today.
- Action: "Webhooks by Zapier" → POST
  - URL: `https://your-domain.com/api/webhooks/listing`
  - Headers: `x-webhook-secret: <your ZAPIER_WEBHOOK_SECRET>`
  - Data: map your listing fields (address, price, bedrooms, image URL, etc. — any JSON shape,
    the field names become your template variables)

**Rex contacts → subscriber list** (since Rex has no direct API access right now):
- Trigger: Rex's Zapier integration — "New Contact" / "Updated Contact" (check what triggers
  Rex's Zapier app exposes; most CRMs on Zapier support at least "New Contact").
- Action: "Webhooks by Zapier" → POST
  - URL: `https://your-domain.com/api/webhooks/contact`
  - Headers: `x-webhook-secret: <your ZAPIER_WEBHOOK_SECRET>`
  - Data: `{ "email": "{{contact_email}}", "first_name": "{{contact_first_name}}", "last_name": "{{contact_last_name}}", "action": "add" }`
- If Rex's Zapier app also has a "Contact Deleted" style trigger, repeat with `"action": "remove"`
  so unsubscribed/deleted people don't keep receiving emails.

## 5. The visual builder (`/builder`)

Drag-and-drop editor for designing newsletters: Nav Bar, Header, Text, Image (single or hero +
2 smaller), Button, Agent(s), Divider, Spacer, and Footer blocks, each with font/color/alignment
controls. A few things worth understanding about how it's wired to the backend:

**Image storage.** Uploads go to `POST /api/images` (multipart), get saved to
`src/public/uploads/` on disk, and are tracked in the `images` table. They're served publicly
at `/uploads/<filename>` — no token needed to *view* an image, only to upload/delete via the
API. The "Image library" button in the builder lets you browse and reuse anything already
uploaded, by anyone — it's one shared library, not per-user.

**"Populate from listing."** Pulls a row from the `listings` table (populated by
`POST /api/webhooks/listing` from Zapier — see below) and:
- Sets the Header's title to "For Sale" / "For Lease" and subtitle to the address
- Registers the listing's photos into the shared image library (via URL, not re-uploaded) and
  drops them into the first Image block
- Replaces the Agents block with the listing's actual agent(s)

This bakes real values in as static text — it's for building *this newsletter, right now* for
*this listing*, not a reusable template with live placeholders. If you want a master template
you reuse for every listing instead, use the `{{address}}` / `{{price}}` / `{{first_name}}` /
etc. variable chips directly in text fields — those stay as literal `{{tokens}}` in the saved
HTML and get filled in per-contact at send time by the same Handlebars engine described in
section 6 below (campaigns already do this).

**No real Zapier listings yet?** Click **Populate from listing → Add 3 sample listings** in the
builder, which calls `POST /api/dev/seed-listings` — inserts the same 3 mock listings used
during prototyping directly into the real `listings` table, so you can test the whole flow
before Zapier is connected. Safe to click more than once (just adds more rows); delete extras
straight from the `listings` table if needed, or just ignore them.

**Brand assets (header banners + Property Stats icons).** The Header block's "Branded image"
mode and the Property Stats block's default icons point at real files already included in
`src/public/uploads/` (`brand-header-for-sale.jpg`, `brand-header-for-lease.jpg`, and six
`icon-*.png` files) — these work immediately, no setup needed. To also make them browsable in
the **Image library** picker (e.g. so you can reuse an icon on a different block), click **Image
library → Load brand assets** once, which calls `POST /api/dev/seed-brand-assets`. Safe to click
more than once — it skips anything already registered. If you ever replace these files with your
own versions, keep the same filenames or update the `imageSale`/`imageLease`/`icon*Src` defaults
in `client/src/NewsletterBuilder.jsx` and rebuild the client.

**Saving designs.** "Templates" in the builder saves both the block structure (so you can load
it back in and keep editing) and the rendered HTML (so campaigns can send it) to the same
`templates` table the admin dashboard already uses — a template created in the builder is
immediately available to pick in a campaign.

## 6. Sending — plain HTML templates (legacy path, still supported)

You can also write templates as plain HTML with Handlebars variables directly (skipping the
builder entirely) via the templates API or by hand:

```html
<h1>New listing: {{address}}</h1>
<p>{{currency price}} — {{bedrooms}} bed</p>
<img src="{{image_url}}" />
<p>Hi {{first_name}}, ...</p>
...
<p><a href="{{{unsubscribe_url}}}">Unsubscribe</a></p>
```

Available automatically on every send: `first_name`, `last_name`, `unsubscribe_url`,
`company_name`, `company_address`, plus every field from the linked listing payload.
Helpers: `{{currency price}}` formats a number as AUD, `{{uppercase text}}` uppercases text.

**Always include the unsubscribe link** — see Compliance below.

## 7. Compliance (Australia — Spam Act 2003, plus CAN-SPAM if you ever email US contacts)

This app builds in the minimum technical requirements, but you're responsible for using them:

- **Consent**: only send to people who've consented (Rex contacts should already reflect this —
  worth double-checking with whoever manages Rex).
- **Identification**: every email must clearly identify who sent it — `COMPANY_NAME` /
  `COMPANY_ADDRESS` in `.env` are rendered into every send; make sure your template displays them.
- **Unsubscribe**: every email must have a working unsubscribe link — `{{{unsubscribe_url}}}` is
  auto-generated per contact and instantly deactivates them when clicked.
- **Honour opt-outs promptly**: this app deactivates on click immediately; make sure removals in
  Rex also flow through to `action: "remove"` so the two systems don't drift apart.

## Project structure

```
src/
  server.js              # Express app entry point
  db.js                  # SQLite schema (contacts, listings, templates, images, campaigns, campaign_sends)
  middleware/auth.js      # webhook secret + admin token checks
  services/email.js       # Resend / SMTP sending
  services/templateEngine.js  # Handlebars rendering + helpers
  routes/webhooks.js      # POST /api/webhooks/listing, /api/webhooks/contact  (Zapier → app)
  routes/templates.js     # CRUD for templates (html + blocks)
  routes/campaigns.js     # create + send campaigns
  routes/images.js        # upload/list/delete for the shared image library
  routes/data.js          # listings, contacts, and the dev listing-seed endpoint
  routes/unsubscribe.js   # public unsubscribe link handler
  public/index.html       # admin dashboard (single page, no build step)
  public/uploads/         # uploaded images live here, served at /uploads/*
data/newsletter.db        # SQLite database (created on first run)
client/                   # visual builder — separate React (Vite) app, served at /builder
  src/NewsletterBuilder.jsx
  dist/                   # pre-built output, committed — run `npm run rebuild-client` from the
                           # project root to regenerate after editing the builder's own code
```

## Notes / next steps worth considering

- **Backups**: `data/newsletter.db` is your entire database — back it up regularly. Once you're
  uploading real photos, `src/public/uploads/` needs backing up too (or move to a dedicated
  file host like S3 down the line — the `images` table's `url` column doesn't care where the
  file actually lives).
- **The dev seed endpoints** (`POST /api/dev/seed-listings`, `POST /api/dev/seed-brand-assets`)
  are real and reachable in production, just admin-token-gated like everything else. Fine to
  leave in, but worth knowing they're there — remove the routes in `src/routes/data.js` once
  you're confident you don't need them anymore.
- **Send rate**: `SEND_DELAY_MS` throttles sends to avoid hitting your ESP's rate limit; tune it
  based on your provider's plan.
- **Scale**: SQLite comfortably handles a subscriber list of thousands; if you get into the tens
  of thousands with frequent sends, consider moving to Postgres — the `db.js` queries are plain
  SQL and would port over with minor changes.
- **Open/click tracking**: not included yet — most ESPs (Resend, Postmark) can add this via
  webhooks back into this app if you want it later.
