# Aikya — Production Deploy Runbook (Railway + Vercel)

Recommended stack: **Vercel** (frontend, static + prerendered) · **Railway** (API + MySQL).
The app is split: the browser app calls the API cross-origin via `VITE_API_URL`.

```
   Vercel (frontend, dist/)  ──HTTPS──▶  Railway (Node API)  ──▶  Railway MySQL
        npm run build:seo                node server/index.js
```

Config files already in the repo: `railway.json`, `vercel.json`, `netlify.toml`.

---

## Quick launch: Railway API with SQLite (no separate database)

For an early launch you don't need a MySQL service at all — SQLite on a
persistent volume is enough and removes all database-networking setup. Switch to
MySQL later (see §1) with only an env change; the code is dialect-agnostic.

1. **Add a volume:** API service → **Settings → Volumes → Add Volume**, mount path `/data`.
2. **Set variables** on the API service:
   ```
   NODE_ENV=production
   DB_DIALECT=sqlite
   SQLITE_STORAGE=/data/devops_ai.sqlite
   NODE_OPTIONS=--dns-result-order=ipv4first
   JWT_SECRET=<32-byte hex>
   INTEGRATION_MASTER_KEY=<32-byte hex>
   PLATFORM_ADMIN_EMAILS=you@your-company.com
   CORS_ORIGIN=https://your-frontend.vercel.app
   APP_BASE_URL=https://your-frontend.vercel.app
   EMAIL_USER / EMAIL_PASS / EMAIL_FROM / BUSINESS_INBOX
   GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
   INTEGRATION_GITHUB_CLIENT_ID / INTEGRATION_GITHUB_CLIENT_SECRET
   ```
   Do **not** set `PORT` (Railway injects it). No `MYSQL_*` vars are needed.
3. Deploy. Success in Deploy Logs: `[db] connected on attempt 1` → `Server running in production mode`.

> ⚠️ The `/data` volume is your database. Keep it. Deleting it deletes all data.
> SQLite is single-writer — great for launch, the first thing you outgrow under
> heavy concurrency. That's the moment to move to §1 (MySQL).

---

## 0) Before you start
- Push is done — repo is at `github.com/BarunKrMishra/devops-ai-platform` (`main`).
- Generate two secrets (keep them safe, never commit):
  ```bash
  # JWT_SECRET and INTEGRATION_MASTER_KEY
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

---

## 1) Database + API on Railway
1. Go to **railway.app → New Project → Deploy from GitHub repo** → pick `devops-ai-platform`.
2. In the project, **+ New → Database → MySQL**. Railway provisions it and exposes `MYSQL_URL` (and discrete vars) as reference variables.
3. Open the **API service → Variables** and set (Railway auto-injects `PORT`):

   | Variable | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DB_DIALECT` | `mysql` |
   | `MYSQL_URL` | `${{MySQL.MYSQL_URL}}` (reference the MySQL plugin) |
   | `MYSQL_SSL` | `false` |
   | `JWT_SECRET` | *(your generated 32-byte hex)* |
   | `INTEGRATION_MASTER_KEY` | *(your generated 32-byte hex)* |
   | `PLATFORM_ADMIN_EMAILS` | `you@your-company.com` |
   | `APP_BASE_URL` | `https://your-frontend.vercel.app` |
   | `CORS_ORIGIN` | `https://your-frontend.vercel.app` |
   | `EMAIL_SERVICE` / `EMAIL_USER` / `EMAIL_PASS` / `EMAIL_FROM` / `BUSINESS_INBOX` | your email/SMTP |
   | `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | your GitHub OAuth app |
   | `INTEGRATION_GITHUB_CLIENT_ID` / `INTEGRATION_GITHUB_CLIENT_SECRET` | (same app is fine) |
   | AI keys (`OPENAI_API_KEY` / `ANTHROPIC_API_KEY`) | optional — leave blank until you connect AI |

4. `railway.json` already sets the start command (`node server/index.js`) and health check (`/api/health`). Deploy.
5. Railway gives the API a URL like `https://aikya-api.up.railway.app`. **Copy it.**
6. Migrations run automatically on boot; check the deploy logs for `Server running in production mode`.

> Tip: to skip building the frontend on the API host, set the service **Build Command** to `npm ci --omit=dev`.

---

## 2) Frontend on Vercel
1. **vercel.com → Add New → Project** → import `devops-ai-platform`.
2. Framework preset: **Vite**. `vercel.json` already sets build = `npm run build:seo`, output = `dist`, SPA rewrites, security headers, and the prerender step.
3. **Environment Variables** (Production):

   | Variable | Value |
   |---|---|
   | `VITE_API_URL` | `https://aikya-api.up.railway.app` *(your Railway API URL)* |
   | `VITE_GITHUB_CLIENT_ID` | your GitHub OAuth client id |
   | `VITE_BILLING_ENABLED` | `false` |

4. Deploy. Vercel gives you `https://your-frontend.vercel.app`.
5. **Go back to Railway** and set `APP_BASE_URL` and `CORS_ORIGIN` to this Vercel URL, then redeploy the API.

---

## 3) GitHub OAuth callback URLs
On each GitHub App you use, add callback URLs pointing at the **API** origin:
- `https://aikya-api.up.railway.app/api/auth/github/callback` (login)
- `https://aikya-api.up.railway.app/api/integrations/oauth/github/callback` (integrations)

(OAuth redirect base auto-detects from the request host, so no env change needed.)

---

## 4) First login + clean data
1. Open the Vercel URL → **Login** → register with your `PLATFORM_ADMIN_EMAILS` email → OTP is emailed → you're in, with the **Aikya Admin** button.
2. To launch with a clean, real-only database, run once (locally against the prod DB, or via a Railway one-off shell):
   ```bash
   npm run reset:dev -- --yes
   ```
   Keeps ops-module seeds + platform admins; wipes all test data.

---

## 5) Custom domain + SEO go-live
1. Add your domain in Vercel (Settings → Domains) → follow DNS steps → HTTPS is automatic.
2. Find-and-replace `aikyadevops.netlify.app` → your real domain in: `index.html`, `public/robots.txt`, `public/sitemap.xml`. Commit + push (auto-redeploys).
3. **Google Search Console** → add the domain property → verify → submit `https://your-domain.com/sitemap.xml`.
4. Add a real `public/og-image.png` (1200×630) for social/link previews.

---

## Alternative: Netlify (instead of Vercel)
Everything above applies; `netlify.toml` is preconfigured. Set the same `VITE_*` env vars in **Site settings → Environment**.

## Alternative: single VPS (Docker)
Use the bundled `docker-compose.yml` + `nginx.conf` on a VPS (DigitalOcean/Hetzner) — cheapest, full control, more ops. See `DEPLOYMENT.md`.

---

## Troubleshooting
| Symptom | Fix |
|---|---|
| CORS errors in browser | `CORS_ORIGIN` on Railway must exactly equal your frontend origin (no trailing slash). |
| OTP email not arriving | Check `EMAIL_*` vars; Gmail needs an App Password. |
| `redirect_uri is not associated` | Add the API callback URL to the GitHub App (step 3). |
| API 502 / crash on boot | Check Railway logs; usually a missing `JWT_SECRET`/`INTEGRATION_MASTER_KEY` or bad `MYSQL_URL`. |
| Sub-pages not prerendered | Ensure build command is `npm run build:seo` (not `npm run build`). |
