'use strict';
// Thin auth layer for the renderer — the vanilla counterpart of the mobile
// AuthProvider (packages/mobile/src/auth/AuthProvider.tsx). It wraps
// window.lectioSupabase.auth with the small surface the sign-in gate needs and
// maps raw Supabase errors to friendly messages.
//
// Loaded AFTER supabase-client.js (which sets window.lectioSupabase) and BEFORE
// app.js. Exposes window.lectioAuth.
(function () {
  // Kill switch: forces the app to behave as if email confirmation is not
  // required, regardless of what signUp() reports. Keep this in sync with the
  // Supabase project's "Confirm email" toggle (Authentication → Providers →
  // Email) — this flag only hides the app's own UI states, it does not override
  // Supabase's server-side enforcement. Flip both back on together when ready to
  // re-enable the flow. Exported on window.lectioAuth so app.js gates the
  // confirm-your-email UI off the same constant (one place to flip).
  const EMAIL_CONFIRMATION_UI_ENABLED = false;

  function client() {
    return window.lectioSupabase || null;
  }

  // Current session, or null (also null when the client failed to initialise).
  async function getSession() {
    const c = client();
    if (!c) return null;
    try {
      const { data } = await c.auth.getSession();
      return data.session || null;
    } catch (e) {
      return null;
    }
  }

  // Subscribe to auth changes; returns an unsubscribe function.
  function onAuthChange(cb) {
    const c = client();
    if (!c) return () => {};
    const { data } = c.auth.onAuthStateChange((_event, session) => cb(session));
    return () => data.subscription.unsubscribe();
  }

  async function signIn(email, password) {
    const c = client();
    if (!c) throw new Error('Cannot reach the server. Check your connection and try again.');
    const { error } = await c.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  // Resolves to `{ needsConfirmation }`. When email confirmation is ENABLED in
  // the Supabase project, signUp returns a user but no session (a confirm mail
  // was sent); when DISABLED, a session comes back immediately and the auth
  // listener signs the user straight in. Same check as the mobile
  // AuthProvider's `lastSignUpNeedsConfirmation`. Always reports false while the
  // kill switch above is off, so the caller never opens the confirm state.
  async function signUp(email, password) {
    const c = client();
    if (!c) throw new Error('Cannot reach the server. Check your connection and try again.');
    const { data, error } = await c.auth.signUp({ email, password });
    if (error) throw error;
    return {
      needsConfirmation:
        EMAIL_CONFIRMATION_UI_ENABLED && !!data && !data.session && !!data.user,
    };
  }

  // Re-send the sign-up confirmation mail. Supabase rate-limits this; the
  // "too many attempts" case comes back through friendlyAuthError().
  async function resendConfirmation(email) {
    const c = client();
    if (!c) throw new Error('Cannot reach the server. Check your connection and try again.');
    const { error } = await c.auth.resend({ type: 'signup', email });
    if (error) throw error;
  }

  async function signOut() {
    const c = client();
    if (!c) return;
    const { error } = await c.auth.signOut();
    if (error) throw error;
  }

  // Sends a password-reset code to `email`, if an account exists for it.
  // Supabase deliberately does not reveal whether the address has an account —
  // this resolves the same way either way (to prevent account enumeration), so
  // any UI built on this must phrase the result as "if an account exists…",
  // never as confirmation that one does.
  //
  // No redirectTo is passed: this app uses the OTP-code path, not the
  // magic-link path. A reset link clicked from the user's own mail client is a
  // real OS-level deep link, which would need lectio:// registered as a
  // protocol handler — unlike the OAuth flow, where the app opens the URL in
  // its own BrowserWindow and intercepts it. So the emailed link is never
  // followed and there is no reason to point it anywhere. The Supabase
  // project's "Reset Password" template must include {{ .Token }} for the user
  // to see the code this flow asks them to type.
  async function requestPasswordReset(email) {
    const c = client();
    if (!c) throw new Error('Cannot reach the server. Check your connection and try again.');
    const { error } = await c.auth.resetPasswordForEmail(email);
    if (error) throw error;
  }

  // Verifies the emailed code (establishing a recovery session for `email`)
  // and immediately sets `newPassword`. Note: the moment verifyOtp() resolves,
  // onAuthChange's listener sees a real session and the caller's UI may react
  // to being signed in — independent of, and possibly before, this function's
  // own updateUser() call finishes. That's fine: the user is correctly signed
  // in either way, and if updateUser() rejects (e.g. a too-weak or breached
  // password, if the project has that check enabled), the error still reaches
  // the caller normally.
  async function confirmPasswordReset(email, code, newPassword) {
    const c = client();
    if (!c) throw new Error('Cannot reach the server. Check your connection and try again.');
    const { error: otpErr } = await c.auth.verifyOtp({ email, token: code, type: 'recovery' });
    if (otpErr) throw otpErr;
    const { error: pwErr } = await c.auth.updateUser({ password: newPassword });
    if (pwErr) throw pwErr;
  }

  // Mirror of the mobile AuthProvider account methods (same Supabase calls).
  // Supabase emails the new address; the change applies after the user confirms.
  async function updateEmail(newEmail) {
    const c = client();
    if (!c) throw new Error('Cannot reach the server. Check your connection and try again.');
    const { error } = await c.auth.updateUser({ email: newEmail });
    if (error) throw error;
  }

  // Requires an active session — used from Settings while already signed in.
  async function updatePassword(newPassword) {
    const c = client();
    if (!c) throw new Error('Cannot reach the server. Check your connection and try again.');
    const { error } = await c.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  // Account deletion. The anon key can't delete its own auth user (that needs the
  // service_role key, which never ships), so this runs through the SAME server-side
  // `delete-account` Edge Function the mobile app uses (it holds the service_role
  // key in its own env, verifies the caller's JWT, and deletes that user — their
  // semesters cascade away via the table FK). On success, sign out locally to
  // clear the now-stale session. Mirrors packages/mobile/src/auth/account.ts.
  async function deleteAccount() {
    const c = client();
    if (!c) throw new Error('Cannot reach the server. Check your connection and try again.');
    const { error } = await c.functions.invoke('delete-account');
    if (error) throw error;
    await c.auth.signOut();
  }

  // Browser-based OAuth via Supabase (used for BOTH Google and Apple on
  // desktop — Electron has no native Sign in with Apple bridge, so both
  // providers go through the same signInWithOAuth() + captured-redirect
  // flow, mirroring packages/mobile/src/auth/oauth.ts's signInWithProvider().
  async function signInWithProvider(provider) {
    const c = client();
    if (!c) throw new Error('Cannot reach the server. Check your connection and try again.');

    const redirectTo = 'lectio://auth-callback';
    const { data, error } = await c.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data || !data.url) throw new Error('Could not start sign-in.');

    const result = await window.providerAuth.captureRedirect(data.url);

    if (result.type === 'code') {
      const { error: exErr } = await c.auth.exchangeCodeForSession(result.code);
      if (exErr) throw exErr;
      return;
    }
    if (result.type === 'tokens') {
      const { error: sErr } = await c.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      });
      if (sErr) throw sErr;
      return;
    }
    throw new Error('Sign-in did not return a session.');
  }

  // Links an OAuth identity to the CURRENTLY SIGNED-IN user. Same
  // captured-BrowserWindow flow as signInWithProvider() above — linkIdentity()
  // accepts the same credentials shape as signInWithOAuth() and returns the
  // same { data: { url } } to redirect through, so this reuses
  // window.providerAuth.captureRedirect unchanged. Requires "Enable Manual
  // Linking" to be on in the Supabase project's Auth settings; if it's off,
  // this rejects and friendlyAuthError() below reports that clearly. Requires
  // an active session (always true here — only called from the Profile
  // window).
  async function linkProvider(provider) {
    const c = client();
    if (!c) throw new Error('Cannot reach the server. Check your connection and try again.');

    const redirectTo = 'lectio://auth-callback';
    const { data, error } = await c.auth.linkIdentity({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data || !data.url) throw new Error('Could not start linking.');

    const result = await window.providerAuth.captureRedirect(data.url);

    if (result.type === 'code') {
      const { error: exErr } = await c.auth.exchangeCodeForSession(result.code);
      if (exErr) throw exErr;
      return;
    }
    if (result.type === 'tokens') {
      const { error: sErr } = await c.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      });
      if (sErr) throw sErr;
      return;
    }
    throw new Error('Linking did not complete.');
  }

  // All identities linked to the signed-in user, e.g.
  // [{ provider: 'email', ... }, { provider: 'google', ... }]. Used by the
  // Profile window to show which sign-in methods are active.
  async function listIdentities() {
    const c = client();
    if (!c) return [];
    const { data, error } = await c.auth.getUserIdentities();
    if (error) throw error;
    return (data && data.identities) || [];
  }

  // Unlinks one identity (pass an entry returned by listIdentities()).
  // Supabase itself requires the user to have at least 2 linked identities
  // before it allows removing one — calling this on the last one rejects
  // server-side. The Profile UI also disables the button in that case; this is
  // a second line of defense, not the only guard.
  async function unlinkProvider(identity) {
    const c = client();
    if (!c) throw new Error('Cannot reach the server. Check your connection and try again.');
    const { error } = await c.auth.unlinkIdentity(identity);
    if (error) throw error;
  }

  // Mirror of packages/mobile/src/auth/auth-errors.ts — kept identical by hand so
  // the two apps say the same thing (the desktop must not import from mobile).
  function friendlyAuthError(err) {
    const msg = err && err.message ? String(err.message) : '';
    const status = err && err.status;
    const m = msg.toLowerCase();

    if (m.includes('network request failed') || m.includes('failed to fetch') || m.includes('fetch'))
      return 'Cannot reach the server. Check your connection and try again.';
    if (m.includes('invalid login credentials'))
      return 'Wrong email or password.';
    if (m.includes('email not confirmed'))
      return 'Please confirm your email first — check your inbox.';
    if (m.includes('user already registered') || m.includes('already been registered'))
      return 'That email already has an account. Try signing in.';
    if (m.includes('password should be at least'))
      return 'Password is too short (minimum 6 characters).';
    if (m.includes('unable to validate email') || m.includes('invalid email'))
      return 'That email address looks invalid.';
    if (m.includes('for security purposes') || m.includes('rate limit') || status === 429)
      return 'Too many attempts. Please wait a minute and try again.';
    if ((err && err.code === 'otp_expired') || m.includes('token has expired') || m.includes('otp_expired'))
      return 'That code has expired. Request a new one.';
    if (m.includes('token') && m.includes('invalid'))
      return 'That code isn’t right. Double-check it and try again.';
    if (m.includes('signups not allowed'))
      return 'Account creation is currently disabled.';
    if (m.includes('manual linking is disabled'))
      return 'Account linking isn’t turned on for this project yet.';
    if (m.includes('already linked'))
      return 'That account is already linked to a Lectio account — sign in with it directly instead.';
    if (m.includes('must have at least') && m.includes('identit'))
      return 'You need another way to sign in before removing this one.';
    return msg || 'Something went wrong. Please try again.';
  }

  window.lectioAuth = {
    EMAIL_CONFIRMATION_UI_ENABLED,
    getSession,
    onAuthChange,
    signIn,
    signUp,
    signOut,
    requestPasswordReset,
    confirmPasswordReset,
    resendConfirmation,
    signInWithProvider,
    linkProvider,
    listIdentities,
    unlinkProvider,
    updateEmail,
    updatePassword,
    deleteAccount,
    friendlyAuthError,
  };
})();
