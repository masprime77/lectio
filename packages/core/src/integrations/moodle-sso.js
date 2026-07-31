'use strict';
// Pure helpers for Moodle's SSO-based "Mobile app" token flow. Formalizes the
// manual DevTools-capture process documented in
// docs/MOODLE_INTEGRATION_SPIKE.md ("Validation status" → "Token: SSO, not
// native Moodle login", and Open risk 5) into two testable functions. No DOM,
// no Electron, no network — this only builds a URL and parses one. The
// platform layer (packages/desktop now, later packages/mobile) is responsible
// for actually opening a browser/window, capturing the redirect, and calling
// parseMoodleMobileRedirect() on it.
//
// Confirmed against two real, separate Moodle instances during manual
// testing: the redirect payload format varies —
// moodle.informatik.tu-darmstadt.de returned a 3-segment payload
// (passport:::wstoken:::privatetoken), while moodle.tu-darmstadt.de (Moodle
// 4.5.12) returned only 2 segments (wstoken:::privatetoken, no passport
// echoed back). parseMoodleMobileRedirect handles both — never assume only
// one shape.
//
// Dual-mode wrapper so it loads in Node (`require`) and the browser
// (`window.LectioMoodleSso`), mirroring integrations/moodle.js and
// integrations/moodle-client.js.
(function (global, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global) global.LectioMoodleSso = api;
})(typeof window !== 'undefined' ? window : null, function () {
  // Builds the URL that kicks off Moodle's "Mobile app" SSO flow:
  // admin/tool/mobile/launch.php. Opening this URL in a real browser/window
  // context (logged into the institution's SSO) eventually redirects to
  // `${urlscheme}://token=<base64>` — that redirect never actually loads
  // (nothing registers the custom scheme in this context), which is exactly
  // what the platform layer intercepts before it "fails".
  function buildLaunchUrl(baseUrl, options) {
    if (!baseUrl) throw new Error('buildLaunchUrl requires a baseUrl.');
    const opts = options || {};
    const service = opts.service || 'moodle_mobile_app';
    const urlscheme = opts.urlscheme || 'moodlemobile';
    // Moodle reflects `passport` back in some versions' redirect payload
    // (see parseMoodleMobileRedirect's 3-segment case) but doesn't validate
    // it against anything — any value works. Random by default; pass one
    // explicitly for deterministic tests.
    const passport = opts.passport !== undefined ? opts.passport : Math.floor(Math.random() * 1e9);
    const url = new URL(`${String(baseUrl).replace(/\/+$/, '')}/admin/tool/mobile/launch.php`);
    url.searchParams.set('service', service);
    url.searchParams.set('passport', String(passport));
    url.searchParams.set('urlscheme', urlscheme);
    return url.toString();
  }

  // Portable base64 -> utf8 decode: Buffer in Node (Electron's main
  // process), atob in browsers/React Native. Mirrors the fetch-detection
  // portability approach already used in moodle-client.js.
  function base64Decode(value) {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(value, 'base64').toString('utf8');
    }
    if (typeof atob !== 'undefined') {
      return atob(value);
    }
    throw new Error('No base64 decoder available in this environment.');
  }

  // Parses a captured `<scheme>://token=<base64>` redirect URL (the
  // custom-scheme redirect that never actually loads — the platform layer
  // intercepts it before navigation completes, e.g. Electron's
  // `will-redirect`/`will-navigate`).
  //
  // The decoded payload is `:::`-joined and its shape varies by Moodle
  // version/config — confirmed against two real instances:
  //   - 2 segments: `wstoken:::privatetoken` (no passport echoed back)
  //   - 3 segments: `passport:::wstoken:::privatetoken`
  // Returns `{ wstoken, privatetoken, passport? }`, or `null` for anything
  // that isn't a well-formed "scheme://token=..." redirect (undecodable
  // base64, unexpected segment count, wrong shape entirely) — never throws.
  function parseMoodleMobileRedirect(url) {
    if (typeof url !== 'string') return null;
    const match = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/token=(.+)$/.exec(url.trim());
    if (!match) return null;

    let payload = match[1];
    try {
      payload = decodeURIComponent(payload);
    } catch (err) {
      // Not URI-encoded (or malformed encoding) — fall back to the raw value.
    }

    let decoded;
    try {
      decoded = base64Decode(payload);
    } catch (err) {
      return null;
    }

    const parts = decoded.split(':::');
    if (parts.length === 2) {
      return { wstoken: parts[0], privatetoken: parts[1] };
    }
    if (parts.length === 3) {
      return { passport: parts[0], wstoken: parts[1], privatetoken: parts[2] };
    }
    return null;
  }

  return {
    buildLaunchUrl,
    parseMoodleMobileRedirect,
  };
});
