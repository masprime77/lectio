## Unreleased

- Changed (core): a Pomodoro phase no longer transitions on its own when its
  deadline passes. The session shape gained an `awaitingAdvance` flag, and
  `markPhaseComplete()` parks a finished phase in that state so the UI can ask
  before moving on; `isAwaitingAdvance()` reports it. Study-time crediting is
  unchanged — callers still credit at the moment completion is detected.
- Added (core): `confirmAdvance()`, the explicit "user said yes" transition
  (a thin alias of `advanceSession`, which still handles work → short/long
  break, short break → work, and long break → idle, measured from the
  confirmation rather than the missed deadline).
- Fixed (core): `rehydrateSession()` restores a parked session in the same
  awaiting-advance state instead of collapsing an expired break to idle, so
  closing and reopening the app does not skip the confirmation.
- Changed (desktop): a finished focus block or break no longer rolls straight
  into the next phase. The study timer now asks first, in a new modal that
  offers to start the break / next focus block or to stop the timer; the OS
  notification stays a heads-up and no longer decides anything on its own.
  A finished long break ends the cycle with a single "Finish session".
- Changed (desktop): the header timer button gets a third state — an amber,
  gently pulsing "Done" pill (with the course name) while a finished phase
  waits for you, instead of a frozen-looking 00:00. Clicking it reopens the
  question, and the tray reports "Done" in place of the countdown.
- Fixed (desktop): stopping or skipping from the waiting state credits the
  finished block exactly once — the block is credited the moment it completes,
  so the partial-time credit is now skipped there rather than double-counting.
- Changed (desktop): a session parked mid-question survives a restart — the
  app reopens the modal instead of resuming a phase you never confirmed, and
  the 1 Hz repaint tick pauses while nothing is counting down.
- Changed (mobile): a finished focus block or break no longer rolls into the
  next phase on its own. `completePhase` credits the block and parks the
  session, and the "what's next?" alert — start the break / next focus block,
  or stop — is now what performs the transition, instead of a notice shown
  after the fact. A finished long break offers a single "Finish session".
- Changed (mobile): the parked state persists like any other session state, so
  backgrounding, a force-quit, or tapping the OS notification hours later all
  return to the same unanswered question rather than to a phase that moved on
  unseen; the question is re-asked on foreground or by tapping the pill.
- Changed (mobile): the timer FAB gained a third state — an amber "Done" pill
  with a tick, distinct from the running countdown — and the 1 s repaint and
  deadline notification are both skipped while a phase sits parked.
- Fixed (mobile): stopping or skipping from the parked state no longer credits
  the focus block a second time (it is already credited in full the moment it
  completes).

## 1.0.2 — 2026-08-09

- Chore: bumped version to 1.0.1 across the root, desktop, and mobile
  packages, and `packages/mobile/app.json`'s `expo.version`; `@lectio/core`'s
  independent version was left untouched, as was `expo.ios.buildNumber`
  (unset — EAS manages it remotely via `appVersionSource: "remote"` +
  `autoIncrement` on the production build profile).
- Fixed: the Google and Apple sign-in icons were missing on downloaded/
  packaged builds (they only ever showed in dev mode) — their SVG assets
  were never added to electron-builder's packaging whitelist.
- Fixed: the desktop app no longer auto-seeds new installs with the old
  "Dev Test Semester" fixture. The bundled example was replaced with a
  minimal "Example Semester" (`ss2025`), and it's now loaded only when the
  user explicitly clicks "Load example semester" from the empty state.
- Fixed: creating or saving a semester could fail silently (an unhandled
  promise rejection left the "New" modal stuck open with no feedback).
  Errors now surface as a visible alert and the modal stays open with your
  input intact.
- Changed: the onboarding tour grew from 9 to 12 steps, adding coverage for
  the Breakdown panel, focus mode, and in-app feedback; its example-semester
  step now loads the bundled example itself if none exists yet, instead of
  silently skipping.
- Chore: untracked `spikes/moodle-poc/inspect-result.json` (a personal-data
  spike output that predated its `.gitignore` rule) from the repo, and
  removed a developer name from an HTML comment on the public landing page.
- Docs: updated `README.md`, `CLAUDE.md`, and `.github/workflows/ci.yml` to
  reflect the example-semester/tutorial changes above and to drop the
  stale `mobile-prep` branch reference (the active integration branch is
  `dev`).
- Fixed (mobile): on iOS, `number-pad` fields had no way to dismiss the
  keyboard (that keyboard type has no Return/Done key), leaving the Study
  timer sheet, semester/item forms, and the Moodle import triage screen
  stuck open under the keyboard. A shared "Done" accessory bar now closes
  the keyboard from any of these fields; Android is unaffected.
- Fixed (mobile): the "Study timer" and "Studied time" bottom sheets could
  hide their text field behind the keyboard on iOS. Both now use the same
  `KeyboardAvoidingView` pattern already used by the app's full-screen
  forms, keeping the focused field visible.

## 1.0.1 — 2026-08-09

- Changed: restyled the desktop "Continue with Google" / "Continue with
  Apple" buttons as full-width branded pills (14px corner radius, soft
  shadow, circular icon badge) and moved them above the email/password
  form, ahead of an "or continue with email" divider. Google's icon comes
  from Google's official pre-approved brand icon download; Apple's uses
  the logo-only artwork from Apple Design Resources, recolored via a CSS
  mask so the same file works on the button's black (light theme) and
  white (dark theme) variants. No behavior change — same
  `#signin-google`/`#signin-apple` ids and click handlers from the OAuth
  groundwork above.
- Added: groundwork for desktop "Sign in with Google" / "Sign in with Apple".
  `packages/core/src/integrations/oauth-redirect.js`
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
- Added: "Continue with Google" / "Continue with Apple" buttons to the desktop
  sign-in screen, below the existing email/password form. `auth.js`'s new
  `signInWithProvider()` calls Supabase's `signInWithOAuth()` with
  `skipBrowserRedirect`, hands the resulting authorize URL to
  `window.providerAuth.captureRedirect()`, and completes the session via
  `exchangeCodeForSession()` (PKCE) or `setSession()` (implicit) once the
  redirect comes back — mirroring `packages/mobile/src/auth/oauth.ts`'s
  `signInWithProvider()`. A closed popup or provider error surfaces through
  the existing `friendlyAuthError()` path, same as password sign-in.
  Requires a one-time Google/Apple OAuth provider setup in the Supabase
  dashboard before it works end-to-end (see PR description).
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
