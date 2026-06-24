'use strict';
// Thin auth layer for the renderer — the vanilla counterpart of the mobile
// AuthProvider (packages/mobile/src/auth/AuthProvider.tsx). It wraps
// window.lectioSupabase.auth with the small surface the sign-in gate needs and
// maps raw Supabase errors to friendly messages.
//
// Loaded AFTER supabase-client.js (which sets window.lectioSupabase) and BEFORE
// app.js. Exposes window.lectioAuth.
(function () {
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

  async function signUp(email, password) {
    const c = client();
    if (!c) throw new Error('Cannot reach the server. Check your connection and try again.');
    const { error } = await c.auth.signUp({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    const c = client();
    if (!c) return;
    const { error } = await c.auth.signOut();
    if (error) throw error;
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
    if (m.includes('signups not allowed'))
      return 'Account creation is currently disabled.';
    return msg || 'Something went wrong. Please try again.';
  }

  window.lectioAuth = {
    getSession,
    onAuthChange,
    signIn,
    signUp,
    signOut,
    updateEmail,
    updatePassword,
    deleteAccount,
    friendlyAuthError,
  };
})();
