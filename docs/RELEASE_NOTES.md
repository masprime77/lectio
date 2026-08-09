## Unreleased

- Added: groundwork for desktop "Sign in with Google" / "Sign in with Apple"
  (renderer UI lands in a follow-up). `packages/core/src/integrations/oauth-redirect.js`
  parses a captured `lectio://auth-callback` redirect from a Supabase
  `signInWithOAuth()` flow (both the PKCE `?code=` shape and the older
  implicit `#access_token=`/`refresh_token=` shape, plus provider error
  redirects). `packages/desktop/main.js`'s new `captureOAuthRedirect()` opens
  the provider's authorize URL in its own window and intercepts that redirect
  before Electron tries (and fails) to navigate to it — the same technique
  `captureMoodleToken()` already uses for Moodle's SSO flow — exposed to the
  renderer as `window.providerAuth.captureRedirect()`. Desktop uses this same
  browser-based flow for both Google and Apple (no native Apple Authentication
  Services bridge in Electron); Supabase resolves the same account by `sub`
  claim regardless of which flow supplied the identity token, so accounts stay
  shared with the mobile app.
- Fixed: the mobile app crashed instantly on launch whenever
  `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` were
  missing (as in TestFlight build 1.0.0 #3, whose EAS build had neither var
  configured). `packages/mobile/src/supabase/client.ts` threw at module
  scope on import — before `AuthProvider`, before `RootLayout`, before React
  ever mounted, so no error boundary or retry screen could catch it. It now
  exports `isSupabaseConfigured` instead of throwing, and
  `AuthProvider.tsx`'s `loadSession()` short-circuits straight to the
  existing "Can't reach Lectio's servers" retry screen when unconfigured.
- Added: the mobile app now uses the desktop app's icon instead of Expo's
  default. `packages/mobile/assets/icon.png` is generated from
  `packages/desktop/assets/icon.png` with its (fully opaque) alpha channel
  stripped, since iOS App Store binary validation rejects icons that carry
  an alpha channel; `app.json`'s new `icon` field points at it.
- Fixed: `packages/desktop/build/afterSign.js` now fails loudly with an
  actionable error when only some of the five macOS signing secrets
  (`CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_TEAM_ID`, `APPLE_ID`,
  `APPLE_ID_PASSWORD`) are configured, instead of silently attempting to
  notarize an unsigned app and crashing with a cryptic codesign error.
- Fixed: with all five signing secrets set, `afterSign.js` now verifies the
  packaged `.app` actually carries the expected `TeamIdentifier` before calling
  `notarize()`, so a failed certificate import (wrong cert type or mismatched
  `.p12` password) fails with a specific, actionable error instead of crashing
  inside `@electron/notarize`'s codesign check.
- Fixed: the macOS release job never actually signed the app when the Developer
  ID secrets were configured. `.github/workflows/release.yml` pinned
  `CSC_IDENTITY_AUTO_DISCOVERY=false`, which disables electron-builder's macOS
  signing outright (not just its keychain search) and wins over `CSC_LINK`,
  while `afterPack.js` skips signing whenever `CSC_LINK`/`APPLE_TEAM_ID` are
  set — so neither path signed and an ad-hoc bundle reached `afterSign`. The
  flag is now set to `false` only on the free/self-signed path, and the
  self-signed certificate import is skipped when `CSC_LINK` is configured (its
  keychain became the default and could shadow the Developer ID identity).
- Fixed: disabled electron-builder's built-in macOS notarization
  (`"notarize": false` in the desktop `package.json`'s `build.mac` block). It
  activates whenever `APPLE_ID` is set and demands the password in
  `APPLE_APP_SPECIFIC_PASSWORD` rather than the `APPLE_ID_PASSWORD` the
  `afterSign.js` hook uses, failing the build; with signing previously being
  skipped, the release never got far enough to hit it. `afterSign.js` is now the
  single notarization path.
- Fixed: `bundle-deps.js` now skips iCloud's conflict-duplicate directories
  (`vitest 3`, `@vitest/spy 2`) when seeding the production closure. A checkout
  under `~/Documents` accumulates these and npm lists them as extraneous, so a
  **locally** built app bundled dev-only junk (36 modules instead of 18). CI
  checkouts are clean and were never affected — published builds already
  shipped the correct 18-module closure.
- Fixed: `packages/desktop/scripts/bundle-deps.js` now invokes `npm ls` through
  a shell (`execSync` with a fixed command string) instead of spawning the
  binary directly, fixing two consecutive `prebuild:win` failures on Windows —
  `spawnSync npm ENOENT` (npm on PATH is the `npm.cmd` shim) and then
  `spawnSync npm.cmd EINVAL` (since Node's CVE-2024-27980 hardening, spawning a
  `.cmd`/`.bat` without a shell is refused outright).
- Fixed: every packaged release shipped an empty Supabase config, so sign-in
  always failed with "Cannot reach the server." `sync-supabase.js` resolves the
  project URL/key from `EXPO_PUBLIC_SUPABASE_URL` /
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (falling back to the git-ignored
  `packages/mobile/.env`), but the release workflow set neither and CI has no
  `.env` — so the build wrote `{ url: '', anonKey: '' }`, `supabase-client.js`
  set `window.lectioSupabase = null`, and `auth.js` rejected every sign-in.
  Local `npm start` worked only because a developer's own `.env` filled it in.
- Changed: `sync-supabase.js` now exits non-zero when `CI=true` and no Supabase
  URL/key is found, instead of warning and writing an empty config — a release
  that can never sign in now fails the build rather than being published.
  Local (non-CI) runs are unchanged and still warn.
- Changed: the macOS and Windows build steps in `release.yml`, and the
  packaging-sanity build in `ci.yml`, now pass `EXPO_PUBLIC_SUPABASE_URL` and
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from repo secrets. **These two
  secrets must be added to the repository before the next release** — the
  builds fail without them by design (documented in the README's Releasing
  section).

## v1.0.0

_Released: 2026-08-08_

- Official 1.0.0 public launch of Lectio.
- Archived the pre-1.0 development history (tags v1.0.0–v1.9.0) to
  `docs/CHANGELOG_PRE_LAUNCH.md`.
- Reset `version` to `1.0.0` in both the root `package.json` and
  `packages/desktop/package.json` ahead of the public launch.
- Rewrote `docs/GITHUB_RELEASE.md` as the v1.0.0 release description.
