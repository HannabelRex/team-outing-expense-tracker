# Invite Signup Existing Account Hotfix

## Purpose

This hotfix fixes the invited-user signup flow so that a pending invitation placeholder in the app state does not block a first-time invited user from creating their Supabase Auth account.

## Issue fixed

When an Admin creates an invite, the app creates a local placeholder user with `accessStatus: invited`. During signup, the frontend checks whether an email already exists before calling Supabase Auth. That check could incorrectly treat invitation-related state as an existing login and redirect the invited user to sign in, even though they are creating their login for the first time.

## Behavior after this hotfix

- Signup from an invite link sends the invite token to `/api/auth/check-email`.
- The backend checks whether the invite token belongs to the same pending invite email.
- If the invite is pending and the local placeholder user is not linked to a Supabase Auth user yet, the email is allowed to continue signup.
- If the email is already linked to a real login account, the user is asked to sign in and accept the invite.
- Invite signup also verifies that the typed email matches the invited email from the invite link.

## Files changed

- `client/src/App.jsx`
- `server/src/index.js`

## Testing

1. Admin creates a new invite for an email that has never signed in.
2. User opens the invite link.
3. User signs up with the invited email.
4. App should not show the premature "account already exists" message.
5. After signup/signin, the invite should be accepted and the user should get event access.
6. If the email truly already has a login account, the app should ask the user to sign in instead.
