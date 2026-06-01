# Phase 7E: Single Account Per Email Hotfix

This hotfix prevents duplicate sign-up attempts with an email address that already exists.

## Behavior

- During Create account, the frontend checks the backend before calling Supabase sign-up.
- If the email already exists in the app user list or Supabase Auth, the user is moved back to Sign in.
- The user sees a clear message: an account already exists and they should sign in or use Forgot password.
- Existing password reset behavior remains available.

## Backend health flags

The health endpoint includes:

```json
{
  "duplicateSignupProtection": "enabled",
  "singleAccountPerEmail": "enabled"
}
```

## Notes

The backend uses the Supabase service role key server-side to check Auth users. Do not expose the service role key in Vercel or frontend code.
