## Unreleased

- Changed (desktop): the header toggle now reads **By Week** / **By Type** and
  chooses how each course column is grouped, instead of swapping between two
  different layouts. The course-column board — with its per-course header,
  focus mode, sort order and "+ Add course" column — is now the only layout;
  By Week is exactly what All Courses showed before. The old Weekly view (one
  card per course inside each week) is gone.
- New (desktop): **By Type** groups a course column into two collapsible
  sections, Readings and Tasks, each listing every item of that type across the
  whole semester with its week number on the row. Rows follow the week sort, so
  "Weeks: high to low" reads the list newest-first. Each grouping remembers
  which of its sections you had open, so switching back and forth doesn't
  disturb the other one; "expand current week only" applies to the week
  grouping and is disabled while grouping by type.
- Fixed (desktop): a semester restored with the old saved view lands in a valid
  grouping instead of erroring — both former layouts map to By Week.
- Fixed (desktop): the view no longer jumps when you edit an item. Changing a
  tag, renaming an item, editing a due date, deleting an item, adding one, or
  editing studied time rebuilt the whole planner and threw you back to the top.
  Those edits now hold their place, and scroll is restored for all three
  scrollers — the page, the All Courses board's horizontal scroll, and each
  course column's own scroll — not just the page. Expanded weeks are unaffected
  either way.
- Changed (desktop): changing an item's tag, renaming it, or editing its due
  date now updates just that item instead of re-rendering the planner, so the
  edit lands without the surrounding view flickering.
- Changed (desktop): each week in the Moodle import dialog now picks
  **Skip / Reading / Task** with three segmented buttons instead of a
  drop-down, matching the mobile import screen. The choice is readable without
  opening a menu, and the "All weeks" buttons light up the matching button in
  every row, so a batch change is visible where the decision is made.
- Fixed (mobile): weeks left on **Skip** in the Moodle import screen were still
  imported. The confirm step treated a week with no recorded decision as
  importable while the rows drew it as skipped; both now read the same default,
  so a row that looks skipped is skipped. Leaving every week on Skip explains
  what to do instead of importing nothing under the banner of success, and
  "Import selected" stays disabled until the semester has loaded, so tapping it
  the instant the screen opens can no longer import against an empty decision
  map.
- Fixed (mobile): importing a course from a file no longer silently carries the
  source semester's progress. The import now asks **Reset progress** or **Keep
  progress**, the same choice the semester import offers. Resetting puts every
  reading and task back on its pending tag and clears the task due dates, which
  belonged to the semester the course came from; keeping preserves them. Either
  way the course and its items get fresh ids, so an import still can't collide
  with anything already in the semester.
- Fixed (desktop): upgrading from a pre-cloud version re-opened the "Upload
  local semesters to your account?" offer at **every** launch. "Not now" closed
  the window without recording anything, and once the semesters were already in
  the account every row read "Already in your account" — so a routine offer
  looked like a conflict prompt about an existing semester. Answering it now
  settles it for good.
- Added (desktop): Settings → Profile → **Local semesters**, which re-opens the
  local→cloud upload offer on demand, so declining it is never final. The upload
  is unchanged: it never overwrites or deletes anything, and re-running it just
  skips what is already in the account.
- Fixed (desktop): a semester that is identical locally and in the cloud can no
  longer raise the "Changed on another device" prompt. A save that would write
  exactly what the cloud already holds is recognised as a non-conflict, so
  nothing is written and no choice is asked for — genuine divergences still open
  the prompt as before.
- Fixed (desktop): packaged builds shipped without `moodle.js`,
  `moodle-client.js` and `conflict.js` — three of the six core files the
  renderer loads — because the electron-builder file allowlist had drifted from
  the list `sync-core.js` vendors. Connecting a Moodle account failed with
  "Could not verify the connection: Cannot read properties of undefined
  (reading 'createMoodleClient')", and cloud saves threw on the missing
  conflict detection. All six files are bundled again.
- Changed (desktop): `sync-core` now fails (and with it start/dev/build) when a
  file it vendors is missing from the packaging allowlist, so the two lists
  cannot drift apart unnoticed again.
- Changed (desktop): a missing vendored global now fails loudly instead of
  silently. The Supabase adapter refuses to be constructed without
  `window.PlannerConflict`, and the Moodle entry points check for the Moodle
  globals up front and show a readable message rather than a `TypeError`.

## 1.1.1 — 2026-08-11

- Added (mobile): the course screen's Readings and Tasks sections each gained an
  "Expand all" / "Collapse all" control next to their "+ Add" button — the
  mobile counterpart of the desktop header's bulk expand/collapse chevrons. The
  label reflects the section's current state, the choice persists with the
  per-week open/closed preferences, and the control is hidden for a section with
  fewer than two weeks.

## 1.1.0 — 2026-08-10

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
- Added (desktop): the header timer control now shows how far through the
  current phase you are, as a hairline fill along the bottom edge of the
  button. It freezes with a paused session and reads full for a phase waiting
  to be advanced.
- Added (desktop): a row of dots on the same control — one per focus block in
  the configured cycle (`pomodorosUntilLongBreak`), filled left to right as
  blocks are completed, all lit through the long break, and gone once the
  cycle ends and the session returns to idle.
- Changed (desktop): both new elements follow the existing phase colour coding
  (blue focus / green break / amber waiting). The control keeps its single
  32px header row — the fill is positioned inside the button rather than
  adding a second row — so the header's alignment is unchanged.
- Added (mobile): the timer pill now shows phase progress as a thin bar under
  the clock, filling as the phase runs down. It freezes while paused and reads
  full on the "Done" pill waiting for confirmation.
- Added (mobile): cycle dots on the pill too — one per focus block in the
  configured cycle, filled as blocks are completed. They stack above the clock
  rather than beside it, so the pill keeps its 56px height and its width still
  follows the clock text; for unusually long cycles (more than 8 blocks) the
  dots are omitted, since a row that wide would distort the pill.
- Changed (mobile): the pill's accessibility label now also announces how many
  focus blocks of the cycle are done; tap-to-pause, long-press-to-skip and the
  stop square are unchanged.
- Added (core): `studyTimeByCourse(semester)` — a pure helper that summarizes
  where a semester's studied time went, returning `{ totalSeconds, courses }`
  where each course carries its id, name, colour, seconds, exact `share` of
  the total and a rounded `percent`. It is the data source for the Study Time
  dashboard panel the apps will add next.
- Note (core): `studyTimeByCourse` omits courses with no tracked time (an
  empty slice is noise in a chart) and sorts the rest most-studied first; a
  semester with no courses, nothing studied, or no semester at all returns
  `{ totalSeconds: 0, courses: [] }`. Because `percent` is rounded per course,
  the percents are labels and can total 99 or 101 — `share` is the exact value.
- Added (desktop): a **Study time** panel, opened from the new chart button on
  the header's timer control. It shows a ring of per-course slices sized by
  each course's share of the semester's tracked time and coloured with the
  course's own accent, the semester total in the middle, and a legend of
  names, hours and percentages. It is a separate panel from the dashboard's
  Breakdown, which is about readings/tasks completion, not hours.
- Added (desktop): while a session is running, the Study time panel can
  re-point it at another course (or at free study) without stopping the clock.
  Mid-block, the minutes already worked are banked to the course that earned
  them — on the same terms as stopping or skipping — and a fresh block starts
  for the new course, so nothing is lost and nothing is counted twice. On a
  break, or on a finished block waiting to be advanced, the switch simply
  changes which course the next block credits.
- Note (desktop): the ring is hand-rolled inline SVG (stroked arcs) in the
  same spirit as the app's `icon()` helper — no charting library was added.
- Added (mobile): a **Study time** bottom sheet (`StudyTimeDashboard`), opened
  from a small chart button above the timer FAB — present in every timer state,
  so it stays reachable while a session runs. It mirrors the desktop panel: a
  ring of per-course slices in each course's colour, the semester total in the
  middle, and a legend of names, hours and percentages.
- Added (mobile): the sheet can re-point a running session at another course
  (or free study) without stopping it. Mid focus block the minutes already
  worked are banked to the course that earned them and a fresh block starts for
  the new one; on a break or a finished block it only changes which course the
  next block credits. This needed one new provider method, `switchCourse`,
  since the crediting has to happen where the session state lives.
- Changed (desktop): the study timer moved out of the header row to a floating
  control pinned to the window's bottom-left corner, keeping its course/phase
  label, its progress bar and dots, and its skip / stop / study-time buttons
  (now round, elevated pills). Its button is slightly taller (36px) than the
  header row allowed.
- Changed (desktop): "New" moved to a floating, icon-only round "+" button in
  the bottom-right corner. The label is dropped in favour of its tooltip and
  aria-label ("New semester"); the click handler is unchanged.
- Added (mobile): the course detail screen groups Readings and Tasks under
  collapsible "Week N" headers with their date ranges, mirroring the desktop
  course view. The Readings/Tasks sections and their "+ Add" controls are
  unchanged; the current week starts open and the rest collapsed.
- Added (mobile): each week section's open/closed state is remembered per
  course, section and week (a new `openCourseWeeks` preference in AsyncStorage),
  so leaving the screen and coming back keeps it as you left it. Only sections
  you have actually toggled are stored — the rest follow the default.
- Note (mobile): items with no week are kept in a trailing "No week" group,
  which starts open since they used to be visible in the flat list. The
  week-asc / week-desc sort orders now set the direction the week *groups* are
  listed in (item order inside a group is untouched, as every item there shares
  one week).
- Fixed (desktop): the onboarding tutorial's copy caught up with the move — it
  no longer tells you to click a "New" label that is now an icon-only "+" in
  the bottom-right, and the study-timer step points at the bottom-left corner
  and mentions the study-time button.
- Note (desktop): both float below modals and the onboarding tutorial's scrim
  (z-index 50 against their 100/300), so every overlay still covers them, and
  the tutorial's `#pomodoro-control` and `#new-btn` steps still spotlight them
  correctly — the spotlight already worked in viewport coordinates, so no
  positioning logic needed changing. Main content gained bottom padding so it
  can always be scrolled clear of both corners.
- Note (mobile): the ring is drawn from plain Views — a circle of small ticks,
  each coloured by the course whose share covers it — because there is no SVG
  library in the package and none was worth adding for one chart. A course with
  less than about 2% of the total is too small for a tick and shows in the
  legend only.

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
