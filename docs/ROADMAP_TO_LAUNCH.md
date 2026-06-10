# Lectio — Roadmap to Launch (Mobile complete + Windows + Moodle)

This roadmap turns the current state into a launchable product: a complete mobile
app, a shippable Windows desktop, and Moodle integration. It is organized as
sequential **phases**, each worked on its own branch and merged via PR — the same
discipline used through Phases 0–6.

## Branching model for this stage

Up to now everything integrated into `mobile-prep`. From here, the integration
branch is **`dev`**, with `main` reserved for releases.

- One branch per phase: `feat/<phase-slug>` (or `phaseN-<slug>` to match the
  existing convention), cut from `dev`, PR'd back into `dev`.
- Large phases split into adjacent sub-branches (A/B/C) that PR into a short-lived
  phase branch, which then PRs into `dev` — same as the Phase-3 (CI) pattern.
- `dev` → `main` only at release points, where a tag triggers the release
  pipeline (desktop already; mobile via EAS once set up).
- Keep: Conventional Commits, one concern per commit, append to
  `docs/RELEASE_NOTES.md` under `## Unreleased` in the last commit of each task,
  and keep `docs/PENDING_FEATURES.md` updated (tick items as they land).

Current baseline (verified): monorepo with `@lectio/core`, `@lectio/desktop`
(Electron, fs-storage, feature-complete), `@lectio/mobile` (Expo SDK 56, Expo
Router, TS; email/password auth + Supabase sync; read + tag-cycling only). CI
runs core Vitest + a macOS desktop build. GitHub Actions already on current
majors. `PENDING_FEATURES.md` is the authoritative gap tracker this roadmap
sequences.

---

## Track A — Make the mobile app complete

The mobile app today is read-only apart from tag cycling. These phases bring it
to parity with the desktop's core usefulness. Ordered cheapest-first / highest-
value-first.

### Phase 7 — Mobile content CRUD (the unblocker)
**Why first:** without this the app can't create a first semester; a new account
is a dead end. This is the single biggest usability gap.
- Create / edit / delete **semesters** (name, start date, week count).
- Create / edit / reorder / delete **courses** (name, color).
- Add / rename / retitle / delete **readings & tasks**; set the week; set/clear
  task due dates.
- A real **empty-state** path: "Create your first semester" + optionally a
  "Add sample semester" action wired to the existing `ensureSeed`.
- All mutations go through `@lectio/core` (addCourse, editCourseName,
  deleteCourse, addTag-less item logic, etc.) and persist via `supabase-storage`.
**Sub-branches:** `7a` semesters CRUD → `7b` courses CRUD → `7c` items + due dates.
**Done when:** a new account can build a full semester from scratch on the phone.

### Phase 8 — Account & session UX
- Sign-out polish, password reset (Supabase email flow), email change, account
  deletion (cascade already set on the table).
- Re-enable email confirmation for production (it was disabled for dev) with a
  proper "check your inbox" flow.
- Graceful handling of the Supabase free-tier project-pause case (clear error +
  retry, rather than a crash).

### Phase 9 — Port deferred desktop features to mobile
Bring the mobile app to feature parity. Each is its own PR; core logic mostly
exists already, so these are mostly UI.
- **Study Mode** toggle (core's `courseProgress(course, semester, true)`).
- **Custom tag editor** — add/rename/delete/reorder/recolor (core: addTag,
  editTag, deleteTag, reorderTags, isProtectedTag); respect protected tags and
  the ghosting behavior on delete.
- **Weekly view** (collapsible week sections, current-week highlight).
- **Dashboard / breakdown** panel.
- **Sort controls** + **focus mode**.
- **Settings screen** (theme override Light/Dark/Auto).
- **Onboarding tour**.
- **Import / export** via the share sheet / document picker (mobile-shaped
  equivalent of the desktop file IPC).
- **In-app feedback** reusing the existing Vercel `api/feedback` endpoint.
**Sub-branches per feature**, all PR'ing into a `phase-9-parity` branch.

### Phase 10 — Mobile quality: tests + CI
- Run `device-storage` and `supabase-storage` against the reusable
  `storage-contract.js` suite (mock AsyncStorage; use a Supabase test
  project/local for the cloud adapter).
- Add a **mobile CI** job: `tsc --noEmit`, lint, unit tests, and (later) an EAS
  build check. Mirror the desktop build-validation pattern.

---

## Track B — Cross-device sync everywhere (incl. desktop)

### Phase 11 — Wire the desktop to Supabase
The headline of the whole monorepo design: desktop uses the **same**
`supabase-storage` adapter (4th use of the Phase-4 contract).
- Decide where the Supabase client lives in Electron (renderer vs main + preload;
  respect contextIsolation/IPC).
- Add a **sign-in screen** on desktop (same email/password).
- **Migration decision (product):** what happens to existing local `fs-storage`
  semesters when a user signs in? Options: keep local + cloud separate, one-time
  "upload my local semesters to the cloud", or cloud-first with local as cache.
  Recommend a one-time, explicit "import local semesters to your account".
- Keep `fs-storage` as an offline fallback.
**Done when:** a semester created on Mac/Windows shows up on the phone and vice
versa — true four-platform sync.

### Phase 12 — Realtime + offline
- **Realtime live-sync** via Supabase `realtime` subscriptions (other devices
  update without a manual reload).
- **Offline mode / conflict resolution:** wire `device-storage` as the offline
  cache and define a merge strategy (last-write-wins via `updated_at` is the
  minimum; document it).

---

## Track C — Moodle integration

Moodle is the LMS most German universities (incl. around Darmstadt) use. The
value: auto-populate a Lectio semester from real course content instead of typing
it. This is the most ambitious track; treat it as its own mini-project with its
own design spike.

**How it maps to Lectio's model (grounding the work):** a Moodle *course* → a
Lectio **course**; Moodle *resources/assignments* under a course → Lectio
**readings/tasks**, bucketed into **weeks** by their section/due date; assignment
**due dates** → task due dates; submission state → could seed tag status. The
target is the exact `Semester` JSON shape the core already uses, so Moodle becomes
"another way to produce a Semester object" — no change to the storage contract.

### Phase 13 — Moodle design spike (decide the integration model)
Pick the access model before building. Options, with trade-offs:
- **(a) Moodle Web Services REST API + user token.** Moodle exposes
  `core_enrol_get_users_courses`, `core_course_get_contents`,
  `mod_assign_get_assignments`, etc. The user pastes a **mobile-app web-service
  token** from their Moodle profile (or you do a token-request login). Cleanest,
  official, read-only. Requires the site to have web services enabled (most do
  for the Moodle mobile app).
- **(b) iCal export.** Moodle can export deadlines as an iCal feed; simplest, but
  only gives calendar events (due dates), not full course structure.
- **(c) Scraping.** Last resort, brittle, avoid.
**Deliverable:** a short decision doc + a throwaway proof-of-concept hitting one
real endpoint with a test token. **Recommend (a)** for full structure, with (b)
as a lightweight fallback for due dates only.

### Phase 14 — Moodle connector in `@lectio/core` (pure, testable)
- A new pure module, e.g. `@lectio/core/integrations/moodle`, that takes raw
  Moodle API responses (fetched by the platform layer) and **maps them to the
  Lectio `Semester` shape**. No network in core — it transforms data, so it's
  unit-testable with fixture JSON, exactly like the rest of core.
- Functions: `mapMoodleCoursesToCourses(...)`,
  `mapMoodleContentToWeeks(...)`, `mergeMoodleIntoSemester(existing, fetched)`
  (so re-syncing updates without clobbering manual edits — a merge, not a
  replace). Add a Vitest suite with real-ish fixtures.

### Phase 15 — Moodle fetch + auth (platform layers)
- A thin network client that calls Moodle Web Services with the user's token and
  feeds responses to the core mapper. Lives in mobile (and later desktop), not in
  core.
- **Secrets:** the Moodle token is sensitive — store it in **Expo SecureStore**
  on mobile (not AsyncStorage/plain), and in the OS keychain on desktop. Never in
  the repo, never in Supabase in plaintext.
- A settings flow: "Connect Moodle" → enter site URL + token → test connection →
  store securely.

### Phase 16 — Moodle sync UX
- "Import from Moodle" → preview the courses/items it will create → confirm →
  `mergeMoodleIntoSemester` → persist via the existing storage adapter (so it
  syncs to all devices through Supabase automatically).
- Re-sync button; show what changed; never overwrite manual edits silently.
- Per-course opt-in (don't import courses the student isn't tracking).

---

## Track D — Release readiness

### Phase 17 — Windows desktop release hardening
The desktop already builds Windows (`build:win`, NSIS) and `release.yml` handles
Windows artifacts. To actually launch:
- **Code signing decision.** Windows SmartScreen warns on unsigned installers.
  Options: ship unsigned + document the "More info → Run anyway" step (free), a
  standard cert (~200 USD/yr, warnings fade with reputation), or an EV cert
  (~300–500 USD/yr, no warnings day one). For launch, unsigned-with-docs is a
  valid start; budget a cert later.
- Test the NSIS installer on a clean Windows VM (install, launch, auto-update via
  electron-updater, uninstall).
- Verify `electron-updater` works for Windows (the update feed/latest.yml paths
  are correct in `packages/desktop/dist/`).
- Update download docs/links for Windows in `README.md`.

### Phase 18 — Mobile distribution (EAS → TestFlight / Play)
- Set up **EAS Build** (managed builds) — this is where you leave Expo Go and
  produce real signed binaries; needed anyway once you add native modules
  (Liquid Glass, OAuth).
- **iOS:** Apple Developer Program (99 USD/yr) → TestFlight beta → App Store.
- **Android:** Google Play (25 USD once) → internal testing → production.
- Add **EAS Update** for OTA JS updates (the mobile equivalent of auto-update).
- App store assets: icon, screenshots, privacy policy (you collect emails +
  semester data via Supabase — a privacy policy is required by both stores and
  by GDPR; data is in the EU region already, which helps).

### Phase 19 — Native polish (optional but high-impact)
- **Liquid Glass / Expo UI** native-material styling on iOS 26+ (with translucent
  fallback for older iOS/Android). Requires the dev build from Phase 18.
- **iPad / tablet layouts** (responsive two-pane).
- **OAuth** (Sign in with Google/Apple) — Apple sign-in is effectively required
  by App Store rules if you offer any third-party login; also needs the dev build.

---

## Suggested order (dependencies honored)

1. **Phase 7** (mobile CRUD) — unblocks everything; the app becomes usable.
2. **Phase 8** (account UX) — needed before real users.
3. **Phase 11** (desktop → Supabase) — delivers true cross-platform sync early;
   high value, and it's "just" the 4th adapter use.
4. **Phase 9** (feature parity) — fill out the mobile app.
5. **Phase 10** (mobile tests/CI) — lock in quality before distribution.
6. **Phase 17** (Windows hardening) — you can launch desktop on Win+Mac here,
   independent of mobile.
7. **Phase 18** (EAS + stores) — launch mobile.
8. **Track C / Phases 13–16** (Moodle) — big differentiator; can run in parallel
   with distribution since core mapping (14) is isolated and testable.
9. **Phase 12** (realtime/offline) and **Phase 19** (native polish) — post-launch
   refinement.

Two natural launch points:
- **Desktop launch (Win + Mac):** after Phase 11 + 17.
- **Mobile launch (iOS + Android):** after Phases 7–10 + 18.
Moodle (13–16) and polish (12, 19) are post-launch unless you want Moodle as a
launch differentiator — in which case slot 13–16 before Phase 18.

---

## Notes & cautions

- **Secrets discipline throughout:** Supabase publishable key in `.env`
  (git-ignored); never the service_role key; Moodle tokens in SecureStore/keychain
  only. A privacy policy is mandatory once you ship auth + cloud data.
- **Supabase free-tier pause:** a project idle 7 days pauses; fine for dev, but
  handle it gracefully (Phase 8) before real users, and consider Pro at launch.
- **Moodle reality check:** integration depends on the specific university's
  Moodle having web services enabled and the API scoped for the user's token.
  Validate against your actual TU/h_da Moodle in the Phase 13 spike before
  committing to the full build.
- Keep `PENDING_FEATURES.md` in sync — tick items as phases land; it and this
  roadmap should agree.
