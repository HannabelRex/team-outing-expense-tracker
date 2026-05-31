# Phase 3: Supabase Auth and Role-Based Access

This phase adds real sign up/sign in using Supabase Auth and protects backend API calls using Supabase access tokens.

## New Render environment variables

Add these to the Render backend service:

```text
AUTH_REQUIRED=true
SUPABASE_ANON_KEY=<your Supabase publishable key, sb_publishable_...>
```

Keep the existing variables:

```text
DATABASE_URL=<Supabase session pooler PostgreSQL URL>
PGSSLMODE=require
NODE_VERSION=20
CLIENT_URL=https://team-outing-expense-tracker.vercel.app
SUPABASE_URL=https://ujkxmbqyjhthodwefgoo.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your sb_secret_... key>
SUPABASE_STORAGE_BUCKET=receipts
MAX_RECEIPT_BYTES=4194304
```

## New Vercel environment variables

Add these to the Vercel frontend project:

```text
VITE_SUPABASE_URL=https://ujkxmbqyjhthodwefgoo.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your Supabase publishable key, sb_publishable_...>
```

After adding Vercel environment variables, redeploy the frontend.

## Supabase settings

For easiest testing:

1. Go to Supabase → Authentication → Providers → Email.
2. Keep Email provider enabled.
3. For quick testing, disable Confirm email.
4. Save.

For real production use, enable Confirm email later.

## Role behavior

- The first authenticated user becomes admin automatically only if no users exist in app data.
- If a user email already exists in the app_state users array, that saved role is reused.
- New authenticated users become members by default.
- Admin can manage event, participants, budget, and user roles.
- Finance can approve/reject expenses and update settlements.
- Members can add expenses and upload receipts. Members can edit/delete only their own expenses.

## Verification

After backend redeploy, visit:

```text
https://team-outing-expense-tracker-api.onrender.com/api/health
```

Expected:

```json
{
  "ok": true,
  "app": "Team Outing Expense Tracker",
  "storage": "postgres",
  "receiptStorage": "configured",
  "auth": "required"
}
```

Then open the Vercel app. You should see a sign-in/sign-up screen.
