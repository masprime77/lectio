'use strict';
// Parses a captured `lectio://auth-callback...` redirect from a Supabase
// signInWithOAuth() flow, intercepted before Electron's BrowserWindow
// actually tries (and fails) to navigate to it — same technique as
// moodle-sso.js's parseMoodleMobileRedirect, applied to Supabase's two
// possible redirect shapes:
//   - PKCE (default today): `lectio://auth-callback?code=...`
//   - Implicit (older flow, kept as a fallback):
//     `lectio://auth-callback#access_token=...&refresh_token=...`
// Also recognizes an error redirect: `?error=...&error_description=...`.
//
// Dual-mode wrapper so it loads in Node (`require`) and the browser
// (`window.LectioOAuthRedirect`), mirroring moodle-sso.js.
(function (global, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global) global.LectioOAuthRedirect = api;
})(typeof window !== 'undefined' ? window : null, function () {
  // Parses a captured `lectio://auth-callback...` redirect URL (the
  // custom-scheme redirect that never actually loads — the platform layer
  // intercepts it before navigation completes, e.g. Electron's
  // `will-redirect`/`will-navigate`).
  //
  // Returns one of:
  //   { type: 'code', code }
  //   { type: 'tokens', access_token, refresh_token }
  //   { type: 'error', error, errorDescription }
  //   null — not a recognized lectio://auth-callback redirect at all
  // Never throws.
  function parseOAuthRedirect(url) {
    if (typeof url !== 'string') return null;
    const match = /^lectio:\/\/auth-callback(?:[?#](.*))?$/.exec(url.trim());
    if (!match) return null;

    const raw = match[1] || '';
    // Supabase can put the payload in the query string OR the hash
    // fragment depending on flow type — try both, hash takes precedence
    // when both somehow exist since access_token only ever appears there.
    let params;
    try {
      params = new URLSearchParams(raw.replace(/^#/, ''));
    } catch (err) {
      return null;
    }

    const error = params.get('error');
    if (error) {
      return {
        type: 'error',
        error,
        errorDescription: params.get('error_description') || '',
      };
    }

    const code = params.get('code');
    if (code) return { type: 'code', code };

    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (access_token && refresh_token) return { type: 'tokens', access_token, refresh_token };

    return null;
  }

  return {
    parseOAuthRedirect,
  };
});
