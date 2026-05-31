# Phase 2: Receipt Upload Activation

This phase activates real receipt upload using Supabase Storage.

## What Phase 2 adds

- Upload JPG, PNG, WebP, or PDF receipts from the expense form.
- Store receipt files in a Supabase Storage bucket.
- Save the uploaded receipt URL/path inside the expense record.
- View attached receipts from the expense list.
- Remove the receipt link while editing an expense.
- Backend validation for receipt type and size.

## Supabase setup

1. Open your Supabase project.
2. Go to **Storage**.
3. Click **New bucket**.
4. Bucket name: `receipts`
5. Set the bucket to **Public** for this demo version.
6. Save/create the bucket.

## Get required Supabase values

### SUPABASE_URL

In Supabase:

- Go to **Project Settings**.
- Go to **API**.
- Copy **Project URL**.

It looks like:

```text
https://ujkxmbqyjhthodwefgoo.supabase.co
```

### SUPABASE_SERVICE_ROLE_KEY

In the same **Project Settings → API** screen:

- Copy the **service_role** key.
- Keep it secret.
- Do not add it to GitHub, Vercel frontend code, or screenshots.

## Render environment variables

Add these to your Render backend service:

```text
SUPABASE_URL=https://ujkxmbqyjhthodwefgoo.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_STORAGE_BUCKET=receipts
MAX_RECEIPT_BYTES=4194304
```

Keep your existing variables:

```text
DATABASE_URL=your_session_pooler_connection_string
PGSSLMODE=require
NODE_VERSION=20
CLIENT_URL=https://team-outing-expense-tracker.vercel.app
```

## Render redeploy

After saving environment variables:

```text
Manual Deploy → Deploy latest commit
```

## Health check

Open:

```text
https://team-outing-expense-tracker-api.onrender.com/api/health
```

Expected:

```json
{
  "ok": true,
  "app": "Team Outing Expense Tracker",
  "storage": "postgres",
  "receiptStorage": "configured"
}
```

## App test

1. Open the Vercel app.
2. Go to **Expenses**.
3. Select a JPG, PNG, WebP, or PDF in **Receipt upload**.
4. Wait for upload success.
5. Save the expense.
6. Confirm the expense list shows a clickable receipt link.
7. Click the receipt link and verify the uploaded file opens.

## Limitations

- This phase uses a public Supabase bucket for easier setup.
- For a stricter production setup, make the bucket private and add signed receipt URLs later.
- Receipt delete removes the link from an expense but does not physically delete the old file from storage yet.
