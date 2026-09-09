
## 7. Deploying to a free live URL (Railway)

Since you don't have a server ready yet, the fastest path to a real live URL is Railway
(free trial credit, no credit card to start). This takes about 10 minutes. I can't create
accounts or deploy on your behalf, but here's exactly what to do:

### Step 1 — Get the code into a GitHub repo
Railway deploys from GitHub. Create a new repo (e.g. `newsletter-app`) at github.com/new,
then from the unzipped project folder:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/newsletter-app.git
git push -u origin main
```

### Step 2 — Create the Railway project
1. Go to railway.app → sign up (GitHub login is easiest) → **New Project**
2. **Deploy from GitHub repo** → select the repo you just pushed
3. Railway detects it's a Node app automatically (via `package.json`) and starts building

### Step 3 — Add a persistent volume (important!)
Without this, your contacts/templates get wiped every time you redeploy.
1. In your Railway project → **+ New** → **Volume**
2. Mount path: `/data`
3. Attach it to your service

### Step 4 — Set environment variables
In your service → **Variables** tab, add everything from `.env.example`:
- `ADMIN_TOKEN`, `ZAPIER_WEBHOOK_SECRET` — long random strings
- `DATA_DIR=/data` — points the database at your volume
- `COMPANY_NAME`, `COMPANY_ADDRESS`
- `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `FROM_EMAIL`, `FROM_NAME`
- `BASE_URL` — leave a placeholder for now, you'll fix it in Step 5

### Step 5 — Get your live URL
1. In your service → **Settings** → **Networking** → **Generate Domain**
2. You'll get something like `newsletter-app-production.up.railway.app`
3. Go back to **Variables** and set `BASE_URL=https://newsletter-app-production.up.railway.app`
   (this is used to build correct unsubscribe links)
4. Redeploy (Railway usually does this automatically when you change a variable)

That's it — `https://your-app.up.railway.app/` is your live admin dashboard, and
`https://your-app.up.railway.app/api/webhooks/listing` is what you give Zapier.

### Moving to your own server later
Nothing here is Railway-specific — the app is a plain Node/Express app. When you do get
your own server, just `git clone`, `npm install`, set `.env` (no `DATA_DIR` needed, or point
it at any folder), and run with `pm2` as described in section 2. Railway is a fine permanent
home too if you don't want to manage a server at all.
