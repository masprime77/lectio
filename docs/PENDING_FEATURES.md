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

- [ ] Account management beyond sign-out — the profile screen
      (`app/profile.tsx`) only offers sign out; no password reset, email
      change, or account deletion (the auth surface is
      `signIn`/`signUp`/`signOut` only).

### Desktop features not yet ported

- [x] **Study Mode** toggle (narrow progress to "studied" items).
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
- [ ] **Onboarding tour**.
- [ ] **Import / export** of semester data.
- [ ] **In-app feedback**.
- [ ] **Settings screen** (theme follows the OS automatically; no in-app choice).
- [ ] **Auto-update** (e.g. Expo OTA / EAS Update).

### Platform polish

- [ ] Native-material polish / Liquid Glass styling (would need a dev build;
      the app currently targets Expo Go with plain React Native components).
- [ ] Tablet / iPad-optimized layouts. Android runs and is validated but is not
      design-tuned.

### Quality

- [ ] Automated tests / CI for mobile. The `device-storage` and
      `supabase-storage` adapters are **not** yet run against the reusable
      storage-contract suite (`packages/core/tests/contract/storage-contract.js`).

## Desktop (`@lectio/desktop`)

The desktop app is feature-complete for its own scope (see
[`README.md`](../README.md) features and [`USER_STORIES.md`](USER_STORIES.md)).
The gaps are all about the new cross-device direction:

- [ ] **Not wired to Supabase.** Desktop uses `fs-storage` only, so it does not
      sync with the mobile app or across machines. (Cross-device sync currently
      works mobile↔mobile.)
- [ ] **No auth/account concept** on desktop — data is local, per-machine.

## Cross-cutting / infra

- [ ] **Mobile CI** — no typecheck / test / EAS pipeline for `@lectio/mobile`
      yet (CI only runs the core Vitest suite and a macOS desktop build).
- [ ] **Storage-contract coverage for the mobile adapters** — run
      `device-storage` and `supabase-storage` against the shared contract suite.
- [ ] **Realtime live-sync** — the Supabase adapter does plain reads/writes; no
      `realtime` subscriptions, so other devices update only on refocus/reload.
- [ ] **Offline mode / conflict resolution** — `device-storage` exists as the
      intended offline fallback but is not wired up; there's no merge strategy.
- [ ] **Desktop → Supabase wiring** — the planned 4th use of the storage
      adapter, to bring desktop into the same sync model as mobile.

## Notes

- This is a living checklist — fold any future "pending/roadmap" notes in here
  rather than scattering them, and replace such notes elsewhere with a pointer
  to this file.
- **Done (not pending):** the GitHub Actions deprecation was already cleared —
  `ci.yml`/`release.yml` run `actions/checkout@v6`, `actions/setup-node@v6`, and
  `actions/upload-artifact@v7` (Node-24 runtime).
