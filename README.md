# Team Outing Expense Tracker

A practical full-stack application for planning, recording, splitting, approving, settling, exporting, and installing team outing expenses as a mobile-friendly Progressive Web App.

## Recommended production architecture

This version supports both local development and free hosted deployment:

- **Frontend:** React + Vite + Tailwind CSS.
- **Charts:** Recharts.
- **Mobile install:** PWA manifest, service worker, install prompt, icons, mobile-safe UI metadata.
- **Backend:** Node.js + Express REST API.
- **Local storage:** JSON file persistence in `server/data/store.json` for easy local setup.
- **Production storage:** Supabase PostgreSQL through `DATABASE_URL` using the `app_state` JSONB table.
- **Deployment:** Vercel for frontend, Render for backend, Supabase for database, GitHub for source control.
- **Authentication:** Mock roles are represented as admin, member, and finance manager. For real company rollout, replace this with Supabase Auth, Auth0, Clerk, Microsoft Entra ID, or another identity provider.
- **Receipt upload:** Placeholder receipt references are implemented. For production file storage, use Supabase Storage, Cloudinary, or S3-compatible storage.

The calculation-heavy logic lives in `server/src/calculations.js` so the settlement math remains server-authoritative instead of being scattered through the UI like confetti after a budget meeting.

## Features included

- Event setup and editing
- Participant add/remove/update and attendance status
- Budget categories with planned vs actual tracking
- Expense recording with equal, selected, custom, and percentage split support
- Receipt reference placeholder
- Expense approval status
- Dashboard cards and charts
- Participant paid/owed/net balances
- Settlement recommendation algorithm
- Settlement status tracking with transaction reference/proof placeholders
- Notification/reminder placeholder endpoint
- JSON report endpoint and CSV export
- Data validation for required fields, negative amounts, invalid splits, and settled expense edits
- Mock role descriptions for admin, member, and finance manager
- Mobile-installable PWA shell
- Supabase PostgreSQL persistence for free hosted usage

## Project structure

```text
team-outing-expense-tracker/
  .env.example
  package.json
  README.md
  docs/
    database-schema.sql
    free-mobile-pwa-deployment.md
    supabase-app-state-schema.sql
  client/
    index.html
    package.json
    postcss.config.js
    tailwind.config.js
    vercel.json
    vite.config.js
    public/
      manifest.webmanifest
      service-worker.js
      icons/
        icon-192.png
        icon-512.png
    src/
      App.jsx
      main.jsx
      styles.css
  server/
    package.json
    data/
      store.json
    src/
      calculations.js
      calculations.test.js
      index.js
      storage.js
```

## Local setup

### 1. Install dependencies

From the project root:

```bash
npm install
npm run install:all
```

### 2. Run the app locally

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

Backend:

```text
http://localhost:4000/api/health
```

Without `DATABASE_URL`, the backend uses local JSON storage.

## Production setup using free tools

Read the full beginner-friendly guide:

```text
docs/free-mobile-pwa-deployment.md
```

Short version:

1. Push this folder to GitHub.
2. Create a free Supabase project.
3. Copy the Supabase PostgreSQL connection string.
4. Deploy `server` on Render.
5. Add `DATABASE_URL`, `PGSSLMODE=require`, and `CLIENT_URL` to Render.
6. Replace the backend URL in `client/vercel.json`.
7. Deploy `client` on Vercel.
8. Open the Vercel URL on mobile and install it.

## Environment variables

Server:

```text
PORT=4000
CLIENT_URL=http://localhost:5173
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
PGSSLMODE=require
```

Client:

```text
VITE_API_BASE_URL=/api
```

Usually Vercel rewrites `/api/*` to the Render backend, so you do not need to expose the backend URL directly in the client bundle.

## API summary

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Health check and storage mode |
| GET | `/api/bootstrap` | Full app data, dashboard, settlements |
| GET/PUT | `/api/event` | Read/update event |
| GET/POST | `/api/participants` | List/create participants |
| PUT/DELETE | `/api/participants/:id` | Update/delete participant |
| GET/POST | `/api/categories` | List/create budget categories |
| PUT/DELETE | `/api/categories/:id` | Update/delete category |
| GET/POST | `/api/expenses` | List/create expenses |
| PUT/DELETE | `/api/expenses/:id` | Update/delete expenses |
| GET | `/api/dashboard` | Dashboard totals and chart data |
| GET | `/api/settlements` | Generated settlement plan |
| PATCH | `/api/settlements/:id` | Update settlement payment status |
| POST | `/api/notifications/send-preview` | Queue mock reminder |
| GET | `/api/reports` | JSON expense report |
| GET | `/api/reports.csv` | CSV participant contribution export |

## Expense split logic

The backend supports:

1. **Equal split:** Divides amount across selected participants and adjusts the final participant by any rounding difference.
2. **Selected split:** Same as equal split, but explicitly limited to selected participants.
3. **Custom amount split:** Requires custom amounts to equal the expense amount.
4. **Percentage split:** Requires percentages to total 100%.

## Settlement algorithm

The app calculates each participant's net balance:

```text
net balance = amount paid - amount owed
```

Then it:

1. Sorts debtors by how much they owe.
2. Sorts creditors by how much they should receive.
3. Greedily matches the largest debtor with the largest creditor.
4. Emits simplified payment instructions until balances are cleared.

This produces fewer settlement transactions than asking everyone to pay everyone else, because humanity has already suffered enough through reimbursement threads.

## Mobile install notes

The frontend includes:

- `client/public/manifest.webmanifest`
- `client/public/service-worker.js`
- App icons at 192x192 and 512x512
- Install button in the app header
- iPhone home-screen metadata
- Android install metadata

Android Chrome usually shows **Install app**. iPhone Safari uses **Share > Add to Home Screen**.

## Logic test

```bash
cd server
npm run test:logic
```

## Production caution

This app now supports persistent Supabase PostgreSQL storage, but mock authentication is still not real authentication. For actual company usage, add real login and role-based access before storing sensitive finance data.

## Phase 2 receipt uploads

Phase 2 adds real receipt uploads through Supabase Storage. See:

```text
docs/phase2-receipt-upload.md
```

Add these Render environment variables before testing uploads:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET=receipts
MAX_RECEIPT_BYTES=4194304
```


## Phase 3: Authentication and roles

This version includes Supabase Auth login/signup and role-based API protection. See `docs/phase3-auth-and-roles.md` for deployment steps.

New capabilities:

- Sign up and sign in with Supabase Auth.
- Backend API requests require a valid Supabase access token when `AUTH_REQUIRED=true`.
- First user / existing admin can manage users and roles.
- Admin can manage event, participants, budget, and settlements.
- Finance can approve expenses and update settlements.
- Members can add expenses and upload receipts, but cannot manage all admin settings.


## Phase 4: Multi-Event Management

This version supports multiple outing events. Admin and Finance users can access the Events tab, create/switch events, and keep each outing's participants, budgets, expenses, settlements, notifications, receipts, and reports separate.

After deploying the backend, `/api/health` should include `"multiEvent": "enabled"`.

See `docs/phase4-multi-event-management.md` for the full test checklist.


## Phase 5: PDF Reports

Phase 5 adds authenticated PDF report export using the backend `/api/reports.pdf` endpoint. Reports include event details, budgets, category spending, participant balances, settlements, expenses, receipt references, and the developer signature.

## Phase 6: Notifications and reminders

This version adds event-wise reminder history and optional SMTP email delivery. Admin and Finance users can send reminders to all participants, participants with pending balances, or selected participants. Members cannot access the Notifications tab.

Backend health includes `inAppNotifications` and `emailNotifications` status. Configure SMTP variables in Render to enable real email sending. Without SMTP, reminders are still stored in the app as in-app history.


## Phase 6B: Notification Inbox

Phase 6B adds an in-app inbox in the header with unread counts, mark-as-read actions, and member-safe filtering. Members can see only reminders addressed to them for events where they are tagged as participants, while Admin and Finance can see selected-event reminder history from the inbox.


## Phase 7: Audit Trail and Security Hardening

Phase 7 adds an Admin/Finance-only Audit tab, event-level audit logging, and stronger backend checks for member-owned expense actions. The health endpoint now includes `auditTrail: "enabled"` and `securityHardening: "enabled"`.

See `docs/phase7-audit-security.md` for setup and testing notes.


## Phase 7B: User access and password reset

Adds admin controls to remove or restore user access from the Roles tab, send password reset emails, and lets users reset their password from the sign-in screen. Disabled users are blocked by the backend while audit history is preserved.


## Phase 7B Hotfix: Unassigned User Empty Dashboard

Members with no assigned events can now log in and see a helpful empty dashboard instead of being blocked by an error. Admins can tag the user's login email in an event's Participants tab to grant access to that event.

## Phase 7C: Access Permissions Hotfix

This update makes Event setup and Participant management available only to Admin and Finance users. Members can still view participants and event details, but cannot add participants or change event setup. Backend permissions enforce the same rule.


## Phase 7D: App Icon + Budget Permission Hotfix

This update replaces the PWA app icon with the new Team Outing Expense Tracker design and makes Budget read-only for Members. Admin and Finance users can add, edit, and delete budget categories. Members can view Budget but cannot modify it. Backend category write APIs enforce the same rule.


## Phase 7E: Single account per email

Phase 7E adds duplicate sign-up protection. If a user tries to create an account with an email that already exists, the app redirects them to Sign in and suggests Forgot password if needed.

Health flags:

```json
{
  "duplicateSignupProtection": "enabled",
  "singleAccountPerEmail": "enabled"
}
```

## Phase 8: User Invitations and Event Assignment

Phase 8 adds an invitation workflow in the Roles tab. Admins can invite users by email, assign a role, choose an event, auto-create the participant record, copy a manual invite link, and revoke pending invites. Invite acceptance is tied to the invited email and is recorded in the audit log.

Health flags added:

- `userInvitations: enabled`
- `inviteLinks: manual-copy`
- `inviteAutoParticipantTagging: enabled`
