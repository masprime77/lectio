# Pending Features

Lectio is an npm-workspaces monorepo with three packages. The **desktop** app
(`@lectio/desktop`, Electron) is the feature-complete reference and persists
each semester as a JSON file via the `fs-storage` adapter. The **mobile** app
(`@lectio/mobile`, Expo / React Native) is an early preview: it signs in with
email/password and reads/writes semesters through Supabase (`supabase-storage`,
Postgres + Row Level Security), with an on-device `device-storage` adapter kept
for a future offline mode. Cross-device **sync is mobile-only so far** — desktop
is not yet wired to Supabase, so it does not sync with mobile or across machines.

This file is the single authoritative tracker for what's missing; it supersedes
any scattered roadmap notes. Checkboxes mark open items.

## Mobile (`@lectio/mobile`)

What the mobile app can do today: sign in / create an account / sign out via
the profile screen (`app/sign-in.tsx`, `app/profile.tsx`), browse semesters and
courses, see per-course progress bars, tap a reading/task to advance its tag
(which recomputes progress and persists to Supabase), create/edit/delete
semesters, create/rename/recolor/reorder/delete courses, and
add/retitle/move/delete readings and tasks including task due dates — a new
account can build a full semester from scratch on the phone. Everything below
is **not** yet possible on mobile.

### Content editing (desktop can, mobile can't)

- [x] Create, edit, or delete **semesters** — the app is read-only over
      semesters apart from tag cycling.
- [x] Create, edit, or reorder **courses** — deleting courses is now possible
      (swipe left or batch edit).
- [x] Add, rename, or retitle **readings/tasks**; set/clear task **due dates**
      — deleting items is now possible (swipe left or batch edit).
- [x] Any first-run path to add a first semester. A brand-new cloud account is
      empty and shows only "No semesters yet." with no add button — `ensureSeed`
      (the sample-semester seeder in `src/storage/seed.ts`) exists but is
      intentionally **not** auto-called, so there's nothing to act on.

### Account

- [x] Account management beyond sign-out — the Profile screen
      (`app/profile.tsx`) is now an account hub: **change email** (Supabase
      emails a confirmation to the new address), **change password** (length +
      match validated), **delete account** (via the `delete-account` Supabase
      Edge Function — the anon key can't delete its own auth user), plus sign
      out. Settings links to it rather than duplicating the email/sign-out.
- [x] **Password reset** — a "Forgot password?" flow (`app/forgot-password.tsx`)
      sends a reset email; in-app completion via deep link needs a dev build
      (the email link completes it on web for now).
- [ ] **Email confirmation** — prepared but **not enabled**: `signUp` already
      sets `lastSignUpNeedsConfirmation` and the sign-in screen shows a "check
      your inbox / resend" notice when it flips, but confirmation stays OFF in
      the Supabase console, so the flow is dormant (enable it there to turn on).
- [x] **Graceful free-tier pause / unreachable handling** — at launch a paused
      or offline project shows a "Can't reach Lectio's servers" + Retry state
      instead of an endless spinner (`app/_layout.tsx` + `AuthProvider`'s
      `connectionError`/`retryConnection`), and sign-in shows a friendly
      "server may be paused / you're offline" message.

### Desktop features not yet ported

- [x] **Custom tag editor** — add / rename / delete / reorder / recolor reading
      and task tags (the "+" add-sheet's Tags tab, driven by the shared core
      tag functions).
- [ ] **Weekly view** (collapsible week sections); mobile has only the
      semester → courses → course-detail flow.
- [x] **Dashboard / Breakdown** panel (readings vs tasks mini-bars, totals) —
      per-course Readings/Tasks mini-bars behind a header "Breakdown" toggle on
      the mobile courses screen.
- [x] **Sort controls** (by progress / alphabetical / week).
- [ ] **Focus mode**.
- [x] **Onboarding tour** — a first-run paged walkthrough (`src/tutorial/`)
      shown once after sign-in and replayable from Settings → "Start tutorial".
- [x] **Import / export** of semester data — share a semester or course as a
      `.lectio.json` file (system share sheet) and import one back (document
      picker), using the shared `@lectio/core` envelope so files interchange with
      the desktop. Semester import offers Keep/Reset progress and never
      overwrites (a conflicting id imports as a new id); imported courses get
      fresh ids.
- [x] **In-app feedback** — a Feedback screen (`app/feedback.tsx`) reachable
      from Settings posts to the same Vercel endpoint the desktop uses (which
      files a GitHub issue), with the same `{ type, title, body, version }` body
      and Bug/Feature toggle. No GitHub account needed; no secrets in the app.
- [x] **Settings screen** — a gear in the Semesters header opens a Settings hub
      (`app/settings.tsx`) with an Account row linking to the Profile hub and an
      About section ("Send feedback", "Start tutorial") plus the version line;
      theme still follows the OS automatically (no in-app choice yet).
- [ ] **Auto-update** (e.g. Expo OTA / EAS Update).

### Platform polish

- [ ] Native-material polish / Liquid Glass styling (would need a dev build;
      the app currently targets Expo Go with plain React Native components).
- [ ] Tablet / iPad-optimized layouts. Android runs and is validated but is not
      design-tuned.

### Quality

- [x] Automated tests / CI for mobile. The `device-storage` and
      `supabase-storage` adapters now run against the reusable storage-contract
      suite (`packages/core/tests/contract/storage-contract.js`) under Vitest, and
      a `Mobile (typecheck)` CI job gates the package. (EAS build check deferred to
      Phase 18.)

## Desktop (`@lectio/desktop`)

The desktop app is feature-complete for its own scope (see
[`README.md`](../README.md) features and [`USER_STORIES.md`](USER_STORIES.md)).
The gaps are all about the new cross-device direction:

- [ ] **Not wired to Supabase.** Desktop uses `fs-storage` only, so it does not
      sync with the mobile app or across machines. (Cross-device sync currently
      works mobile↔mobile.)
- [x] **Auth/account on desktop** — the renderer now signs in against the same
      Supabase project as mobile, and **Settings has a Profile/account section**
      (parity with the mobile Profile hub): signed-in email, change email, change
      password (length + match validation), sign out, and **delete account** via
      the shared `delete-account` Edge Function.

## Cross-cutting / infra

- [x] **Mobile CI** — `ci.yml` now typechecks `@lectio/mobile` (the
      `Mobile (typecheck)` job) and runs its Vitest suite via the root `npm test`
      matrix. EAS build pipeline still deferred to Phase 18.
- [x] **Storage-contract coverage for the mobile adapters** — `device-storage`
      and `supabase-storage` now run against the shared contract suite (via
      in-memory AsyncStorage / Supabase-client fakes under Vitest).
- [ ] **Realtime live-sync** — the Supabase adapter does plain reads/writes; no
      `realtime` subscriptions, so other devices update only on refocus/reload.
- [ ] **Offline mode** — `device-storage` exists as the intended offline
      fallback but is not wired up; there's no offline↔cloud merge strategy.
- [x] **Conflict resolution (mobile)** — the Supabase adapter detects cloud
      write conflicts (12.1) and the mobile app now surfaces a resolution dialog
      (Keep my changes / Use the latest / Cancel) routed through one
      conflict-aware save helper, backing up the overwritten remote version on
      "keep" (12.2). The desktop equivalent (12.3) is still pending.
- [ ] **Desktop → Supabase wiring** — the planned 4th use of the storage
      adapter, to bring desktop into the same sync model as mobile.

## Moodle integration (Track C)

Auto-populate a semester from a student's real Moodle courses instead of
typing everything by hand. See `docs/MOODLE_INTEGRATION_SPIKE.md` for the
design decision.

- [x] **Phase 13 — design spike** — decision doc
      (`docs/MOODLE_INTEGRATION_SPIKE.md`) and a throwaway PoC
      (`spikes/moodle-poc/`), **validated live** against
      `moodle.informatik.tu-darmstadt.de` on two contrasting real courses
      (id 10, topic-structured; id 1998, date-range-structured). All Web
      Services calls work; the findings reshaped the Phase 14/16 scope below.
- [ ] **Phase 14 — core mapper** — pure `@lectio/core/integrations/moodle`
      module that is **type-agnostic**: it does *not* classify items as
      readings vs. tasks (that's the user's choice in Phase 16). Its job is
      to keep only `modname` in `resource`/`url`/`folder`, drop anything with
      `visible: 0` or `uservisible: false`, group surviving modules into
      weeks by parsing the section's German date-range name with a fallback
      to raw section order when it doesn't parse, and emit
      `{ name, url, moodleModuleId }` per item (always `module.url`, never
      `contents[].fileurl`, so no token is ever stored in a link). Needs a
      Vitest fixture suite covering both real course shapes.
- [ ] **Phase 15 — fetch + auth (platform layers)** — network client +
      secure token storage (Expo SecureStore on mobile, OS keychain on
      desktop). For TU Darmstadt specifically the token must come from the
      SSO-derived WebView flow (`admin/tool/mobile/launch.php` +
      `moodlemobile://token=` redirect capture) — native `login/token.php`
      does not work against this SSO-backed instance.
- [ ] **Phase 16 — sync UX** — a **per-week triage/import screen**, not a flat
      preview/confirm list: the user reviews the imported items grouped by
      week, picks reading-mode or task-mode, and confirms items per week into
      that type. Plus re-sync and per-course opt-in.

## Notes

- This is a living checklist — fold any future "pending/roadmap" notes in here
  rather than scattering them, and replace such notes elsewhere with a pointer
  to this file.
- **Done (not pending):** the GitHub Actions deprecation was already cleared —
  `ci.yml`/`release.yml` run `actions/checkout@v6`, `actions/setup-node@v6`, and
  `actions/upload-artifact@v7` (Node-24 runtime).
