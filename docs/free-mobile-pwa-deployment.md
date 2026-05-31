# Free mobile installable deployment guide

This version is designed to run as an installable mobile Progressive Web App using free developer tools.

## Recommended free stack

- GitHub: source code
- Vercel Hobby: React/Vite frontend
- Render free web service: Node/Express backend
- Supabase Free: PostgreSQL persistence

## What users get

- Public URL accessible from mobile or desktop
- Installable app icon on Android and iPhone home screen
- Persistent event, participant, expense, settlement, notification, and report data
- CSV export
- Offline app shell cache for faster reopening

## 1. Push the project to GitHub

```bash
git init
git add .
git commit -m "Mobile PWA production setup"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/team-outing-expense-tracker.git
git push -u origin main
```

## 2. Create Supabase database

1. Create a Supabase account.
2. Create a new project.
3. Go to Project Settings > Database.
4. Copy the connection string URI.
5. Replace `[YOUR-PASSWORD]` with your database password.

You may run `docs/supabase-app-state-schema.sql` in the SQL Editor. The backend also auto-creates this table on first start.

## 3. Deploy backend to Render

Create a Render Web Service from the GitHub repository.

Settings:

| Setting | Value |
| --- | --- |
| Root Directory | `server` |
| Build Command | `npm install` |
| Start Command | `npm start` |

Environment variables:

| Key | Value |
| --- | --- |
| `DATABASE_URL` | Supabase Postgres connection string |
| `CLIENT_URL` | `https://YOUR-VERCEL-APP.vercel.app` initially use `http://localhost:5173` if unknown |
| `PGSSLMODE` | `require` |

After deploy, test:

```text
https://YOUR_RENDER_BACKEND_URL.onrender.com/api/health
```

Expected storage should be `postgres`.

## 4. Connect frontend to backend

Edit `client/vercel.json` and replace:

```text
https://YOUR_RENDER_BACKEND_URL.onrender.com
```

with your actual Render backend URL.

Commit and push:

```bash
git add .
git commit -m "Configure production backend rewrite"
git push
```

## 5. Deploy frontend to Vercel

Create a Vercel project from the same GitHub repository.

Settings:

| Setting | Value |
| --- | --- |
| Framework | Vite |
| Root Directory | `client` |
| Install Command | `npm install` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

After deploy, open the Vercel URL on your phone.

## 6. Update Render CORS

In Render, set:

```text
CLIENT_URL=https://YOUR-VERCEL-APP.vercel.app
```

Then redeploy the backend.

## 7. Install on mobile

### Android Chrome

1. Open the Vercel app URL.
2. Tap the install prompt, or open the three-dot menu.
3. Tap **Install app** or **Add to Home screen**.

### iPhone Safari

1. Open the Vercel app URL in Safari.
2. Tap Share.
3. Tap **Add to Home Screen**.
4. Confirm Add.

## Free-tier notes

Render free web services can sleep after inactivity, so the first request may be slow. Supabase free projects can pause after inactivity. For a real company production app, upgrade the backend/database later. For a team outing demo or small internal app, this stack is a practical free starting point.
