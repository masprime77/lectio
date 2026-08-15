# Enabling email verification

Requiring new accounts to confirm their address is a **Supabase dashboard
setting, not a code change**. Both apps already handle the confirmed and
unconfirmed cases; this document is the checklist for flipping the switch, the
redirect URLs it depends on, what it does to existing accounts, how to test it,
and how to undo it.

Nothing here is needed while the setting is off — that is the current state, and
both apps keep working either way.

## What the apps already do

| | Desktop (`packages/desktop`) | Mobile (`packages/mobile`) |
|---|---|---|
| Sign-up with confirmation pending | `signUp()` in [`auth.js`](../packages/desktop/auth.js) returns `{ needsConfirmation }` (no session + a user), and `setupSignIn()` in [`app.js`](../packages/desktop/app.js) replaces the form with "Check your inbox to confirm &lt;email&gt;" | `signUp()` in [`AuthProvider.tsx`](../packages/mobile/src/auth/AuthProvider.tsx) sets `needsEmailConfirmation`, and [`sign-in.tsx`](../packages/mobile/app/sign-in.tsx) renders the notice |
| Sign-in on an unconfirmed account | "Email not confirmed" opens the same state | same — `signIn()` sets `needsEmailConfirmation` from the error |
| Resend | "Resend email" button → `lectioAuth.resendConfirmation()` | "Resend email" link → `resendConfirmation()` |
| Rate limit | `friendlyAuthError()` → "Too many attempts. Please wait a minute and try again." | same map in [`auth-errors.ts`](../packages/mobile/src/auth/auth-errors.ts) |

Both call `supabase.auth.resend({ type: 'signup', email })`. Neither passes an
`emailRedirectTo`, so **the confirmation link always lands on the project's Site
URL** — see the next section for why that is deliberate.

## Redirect URLs

Supabase Auth → **URL Configuration**.

### Site URL

```
https://masprime77.github.io/lectio/
```

That is the Lectio landing page (GitHub Pages, served from `docs/`). It is
where the browser ends up after Supabase verifies the token.

**The redirect target does not perform the confirmation.** The link in the email
points at `<project>.supabase.co/auth/v1/verify?token=…&type=signup`, which
confirms the account server-side and *then* redirects. So the account is
confirmed even if the user never sees the landing page, and the user's next step
on both platforms is simply to go back to the app and sign in.

**Do not** point the Site URL at `lectio://auth-callback` to "return to the
app". The desktop app does **not** register `lectio://` with the OS — there is
no `setAsDefaultProtocolClient()` in [`main.js`](../packages/desktop/main.js) and
no `protocols` block in the electron-builder config. That scheme is only ever
intercepted *inside the app's own sign-in window*, by
`captureOAuthRedirect()`'s `will-redirect`/`will-navigate` handlers. A mail
client opening it in the system browser reaches nothing.

### Redirect URLs (allow-list)

These are needed by the OAuth and password-reset flows that already exist; the
list is repeated here because enabling confirmation is when a wrong entry starts
hurting.

| Entry | Used by |
|---|---|
| `lectio://auth-callback` | Desktop Google/Apple sign-in — `redirectTo` in `signInWithProvider()` ([`packages/desktop/auth.js`](../packages/desktop/auth.js)), parsed by [`oauth-redirect.js`](../packages/core/src/integrations/oauth-redirect.js) |
| `lectio://**` | Mobile dev/production build — `Linking.createURL('/')` in [`oauth.ts`](../packages/mobile/src/auth/oauth.ts) and `createURL('/sign-in')` in `resetPassword()`. The wildcard covers both the `lectio://sign-in` and `lectio:///sign-in` spellings expo-linking can produce |
| `exp://127.0.0.1:8081/--/**` | Expo Go / `npm run mobile` on the simulator |
| `exp://192.168.*.*:8081/--/**` | Expo Go on a physical device over the LAN (the host is your dev machine's IP; adjust if your network is not `192.168.*`) |

The `lectio` scheme comes from `expo.scheme` in
[`packages/mobile/app.json`](../packages/mobile/app.json) and is the same string
the desktop uses.

### Before you enable it: SMTP

The built-in Supabase email service is a testing convenience, rate-limited to a
couple of messages per hour across the whole project — enough for the manual
test below, not for real sign-ups. Check Authentication → **Rate Limits**, and
configure a custom SMTP provider (Authentication → **Emails** → SMTP Settings)
before letting real users hit it. Every resend spends from the same budget, and
that is what the "Too many attempts" message in both apps is reporting.

## Turning it on

1. Supabase dashboard → Authentication → **Sign In / Providers** → Email.
2. Enable **Confirm email**.
3. Check the template under Authentication → **Emails** → *Confirm signup*. It
   must keep `{{ .ConfirmationURL }}`; the rest of the wording is free.
4. Verify the Site URL and allow-list above.

## Effect on existing accounts

While "Confirm email" is off, Supabase auto-confirms at sign-up: those users
already carry an `email_confirmed_at` timestamp, so **enabling the setting does
not lock them out**. Confirm this before flipping the switch — Authentication →
**Users**, look for users with no confirmation timestamp — because any account
in that state *will* be blocked from signing in afterwards.

- Google/Apple accounts are confirmed by the provider; they are unaffected.
- An account created *after* the switch and never confirmed can sign in only
  after confirming. The user can do it themselves with **Resend email** from
  either app's sign-in screen; you can also do it from the dashboard
  (Authentication → Users → the user → confirm their email).

## Testing

Do this on a throwaway address you control. Real inbox required — the confirm
link is only in the mail.

**Desktop** (`npm start`):

1. Enter a new address + password → **Create account**.
2. The dialog must switch to "Confirm your email" with the address shown, a
   **Resend email** button, and **Back to sign in**.
3. Go back and try to sign in with those credentials: the same state appears,
   led by "Please confirm your email first — check your inbox."
4. Press **Resend email** → "Sent — check your inbox (and your spam folder)."
   Press it repeatedly → "Too many attempts. Please wait a minute and try
   again." in the danger color.
5. Open the link in the mail; the browser lands on the landing page. Return to
   Lectio and sign in — it works, and the app loads normally.

**Mobile** (`npm run mobile`):

1. Same sign-up on the sign-in screen. The notice card appears under the
   password field: "Check your inbox to confirm &lt;email&gt;, then sign in."
   with a **Resend email** link.
2. Signing in before confirming shows the same card plus the error line.
3. **Resend email** shows "Sent — check your inbox (and your spam folder)."
   inside the card; hitting the rate limit shows the "Too many attempts" error.
4. Confirm from the mail, then sign in — the app navigates to the semesters
   list.

Expo Go and a dev build behave identically here: the flow never leaves the app,
so it does not depend on the deep-link round-trip that Google/Apple sign-in
needs.

## Rolling back

1. Authentication → Sign In / Providers → Email → turn **Confirm email** off.
2. New sign-ups get a session immediately again; both apps go straight into the
   app, and the confirm state stays dormant.
3. Accounts created during the window and never confirmed keep their missing
   timestamp. Do not assume they can suddenly sign in — confirm them from
   Authentication → Users (or have the user use **Resend email** while the
   confirm mail still works).

No code deploy is involved in either direction, on either platform.
