# Aikya DevOps Platform - Complete Walkthrough (Plain English)

This guide explains the project end-to-end in simple steps. You can share it with anyone and they should be able to follow it without technical background.

---

## 1) What this project is (simple explanation)

Aikya is a DevOps platform. It helps a company:
- Connect their tools (GitHub, GitLab, AWS, Prometheus, Grafana, etc.)
- See live data (deployments, infrastructure status, alerts)
- Manage teams and roles
- Send go-live requests

The project has two parts:
- Frontend (what users see in the browser)
- Backend (the server that handles logins, data, and integrations)

---

## 2) What you need before starting

You need:
- A computer with Node.js 18+ installed (for local dev)
- Git installed
- (Optional) Docker for easy deployment

---

## 3) Files you should know about

- `src/` = frontend code (React)
- `server/` = backend code (Node/Express)
- `.env` = environment settings (secrets and URLs)
- `docker-compose.yml` = starts frontend + backend together
- `nginx.conf` = frontend proxy config for `/api`

---

## 4) Local setup (development)

Time estimate: 5-10 minutes

### Step 1: Download the project
```bash
git clone <your-repo-url>
cd devops-ai-platform
```

### Step 2: Install dependencies
```bash
npm install
```

### Step 3: Create your `.env`
Create a file named `.env` in the project root.

Example:
```
VITE_API_URL=http://localhost:3001
VITE_GITHUB_CLIENT_ID=your_github_client_id

JWT_SECRET=your_jwt_secret
NODE_ENV=development

GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

INTEGRATION_MASTER_KEY=your_master_key
APP_BASE_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
```

### Step 4: Start the app
```bash
npm run dev
```

Open the app:
http://localhost:5173

---

## 5) How login and registration works

Time estimate: 2-3 minutes

1) User opens the login page.
2) If they register:
   - The system creates a new organization for them.
   - An OTP is sent to their email.
   - They must enter OTP to complete registration.
3) If they log in:
   - OTP is sent to email.
   - They must enter OTP to complete login.

Important:
- OTP is required for every login.
- If email is not set properly, OTP email will fail.

---

## 6) How teams and roles work

Roles:
- Manager: can add/remove users, change roles, manage teams
- Admin: similar access to manager
- Developer/User: limited access

Team flow:
1) Manager creates a team.
2) Manager invites people by email.
3) Invited user joins the organization using invite link.
4) Users only see their own organization data (no cross-org data).

---

## 7) Integrations (where live data comes from)

Integrations are how Aikya gets real data.

### CI/CD
- GitHub / GitLab: pipelines + repos
- Jenkins: job runs

### Infrastructure
- AWS / Azure / GCP credentials

### Monitoring
- Prometheus / Datadog / Grafana

### Collaboration
- Slack / PagerDuty alerts

After integration:
- Data only shows if the provider has real metrics.
- If no metrics exist, the UI shows guidance.

---

## 8) Monitoring: what must exist for data to show

### Prometheus (global standard)
Our default queries expect node-exporter metrics:
- `node_cpu_seconds_total`
- `node_memory_MemAvailable_bytes`

If Prometheus is connected but those metrics are missing:
- UI shows "connected but no metrics found"
- It tells you to enable node-exporter

### Grafana
Grafana itself is only a UI.
We show it as "connected", but metrics still come from Prometheus/Datadog.

---

## 9) Dashboard

The dashboard shows a live monitoring snapshot:
- CPU
- Memory
- Uptime
- Response time
- Latest alerts

If integrations are missing, it shows clear guidance instead.

---

## 10) Docker deployment (production style)

Time estimate: 10-15 minutes

### Step 1: Copy env example
```bash
cp .env.example .env
```

### Step 2: Fill required values
```
JWT_SECRET=<generated>
INTEGRATION_MASTER_KEY=<generated>
APP_BASE_URL=http://your-server-ip:2025
CORS_ORIGIN=http://your-server-ip:2025
VITE_API_URL=http://your-server-ip:2025
```

### Step 3: Start containers
```bash
docker-compose up -d --build
```

### Step 4: Open the app
http://your-server-ip:2025

---

## 11) Common problems and fixes

### Problem: 502 Bad Gateway
Cause: API container is crashing.
Fix: Check logs:
```bash
docker-compose logs --tail=200 api
```

### Problem: No monitoring data
Cause: Prometheus connected but no metrics.
Fix: Enable node-exporter and scrape it.

### Problem: OTP emails not sending
Cause: Email credentials wrong.
Fix: Use correct Gmail app password or email provider credentials.

### Problem: GitHub login not working
Cause: Callback URL mismatch.
Fix: Update GitHub OAuth app callback URLs to match your domain.

---

## 12) Quick checklist before going live

- [ ] Set `JWT_SECRET` and `INTEGRATION_MASTER_KEY`
- [ ] Set `APP_BASE_URL` and `CORS_ORIGIN`
- [ ] Test register and login (OTP emails working)
- [ ] Integrations connected and returning data
- [ ] Dashboard shows live metrics

---

## 13) How data stays isolated per business

Each registration creates a new organization.
Every user is tied to exactly one organization.
All data queries are scoped by `organization_id`.

This prevents any data leak across businesses.

---

## 14) Summary (plain English)

- Aikya is a DevOps platform that connects tools and shows live data.
- It uses OTP login for security.
- Each company gets its own private organization.
- You only see data if your tools are connected and sending metrics.
- The dashboard now shows a live monitoring snapshot.

---

If you want, I can also add a one-page PDF version of this guide for sharing.
