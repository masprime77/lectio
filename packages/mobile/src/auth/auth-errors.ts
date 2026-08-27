// Map raw Supabase auth errors to short, human-friendly messages.
// No dependency on supabase-js types beyond `unknown`.

export function friendlyAuthError(err: unknown): string {
  const msg = (err as any)?.message ? String((err as any).message) : '';
  const status = (err as any)?.status as number | undefined;
  const m = msg.toLowerCase();

  // Network / project paused / unreachable (see 8.3 for the pause UX).
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
  if (m.includes('manual linking is disabled'))
    return 'Account linking isn\u2019t turned on for this project yet.';
  if (m.includes('already linked'))
    return 'That account is already linked to a Lectio account \u2014 sign in with it directly instead.';
  if (m.includes('must have at least') && m.includes('identit'))
    return 'You need another way to sign in before removing this one.';
  return msg || 'Something went wrong. Please try again.';
}

// Distinguish "server unreachable / paused" from ordinary auth errors so the UI
// can show a retry state (used by 8.3).
export function isConnectivityError(err: unknown): boolean {
  const m = ((err as any)?.message ? String((err as any).message) : '').toLowerCase();
  return (
    m.includes('network request failed') ||
    m.includes('failed to fetch') ||
    m.includes('fetch') ||
    m.includes('timeout') ||
    m.includes('econnrefused') ||
    m.includes('service unavailable')
  );
}
