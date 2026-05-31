# Phase 7B: User Access Removal and Password Reset

This update adds administrator controls for user access and password reset.

## Features

- Admin can remove app access for a user from the Roles tab.
- Disabled users can still exist in Supabase Auth, but the app backend blocks them from loading protected data.
- Admin can restore access for a disabled user.
- Admin can send a password reset email to a user from the Roles tab.
- Users can use Forgot password on the sign-in screen.
- Password reset links redirect back to the app and show a Set new password screen.
- User access removal, restoration, and password reset requests are written to the audit trail.

## Important Supabase setup

For password reset links, configure Supabase Auth URL settings:

- Site URL: https://team-outing-expense-tracker.vercel.app
- Redirect URL: https://team-outing-expense-tracker.vercel.app

Use the actual Vercel URL if different.

## Notes

Remove access is implemented as a soft disable in app_state. This avoids accidental hard deletes and preserves audit history. If you also want to delete the Supabase Auth account entirely, do it manually in Supabase Authentication > Users, but the app does not require that for blocking access.
