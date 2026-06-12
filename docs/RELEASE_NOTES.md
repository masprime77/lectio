## Unreleased

- Extracted the bodies of the three mobile add/edit forms into reusable components (`src/add/SemesterFields.tsx`, `CourseFields.tsx`, `ItemFields.tsx`): fields + save logic moved verbatim, taking ids/mode as props instead of route params. The original `semester-form` / `course-form` / `item-form` screens are now thin wrappers (SheetHeader + body) and remain the edit entry points; the item form keeps its Reading | Task switch in create mode only.
- Added a unified "+" add-sheet (`app/add.tsx`, modal at `/add?context=semester|course|item`) for the container objects, with real tabs via `FormTabs`: the Semesters FAB opens it on the Semester tab, the Courses FAB on the Course tab. The "+" never creates individual readings/tasks — on course-detail the FAB now goes straight to the tag manager (`/semester/tags?id=…`; the sheet's `context=item` path replace-forwards there too, so no empty sheet ever shows), while items keep being added from the per-section "+ Add" controls next to the Readings/Tasks headers.
- Header consistency on mobile: the Semesters screen now shows Profile top-left as a drawn person glyph (two accent-colored shapes — no emoji, no icon library) and Edit/Done top-right with the batch Delete (n) control, matching the Courses and Course-detail screens where Edit already sits top-right. The compact "Tags" header button on the Courses screen is kept as the quick entry to the full tag editor.
- Added a per-semester tag editor to the mobile app (`app/semester/tags.tsx`, a modal screen opened from a new "Tags" button in the semester header): Readings/Tasks tabs, each grouped into Pending and Done sections like the desktop's Tags tab. Tags can be added (inline name + swatch form per section), renamed (tap the name, commits on blur), recolored (tap the color dot to open the same fixed 8-color palette as the course form), deleted (behind a confirmation alert; items wearing the tag become ghosts via core, so progress stays stable), and reordered (↑/↓ controls, swap-based within the tag's section). Protected tags (pending/studied) render a static name and can only be recolored — no rename, delete, or reorder controls — mirroring the desktop. All mutations go through the shared `@lectio/core` tag functions (`addTag`/`editTag`/`deleteTag`/`reorderTags`, now declared in the mobile ambient types), so the semester JSON stays byte-compatible with the desktop. No new dependencies.
- Added an in-sheet header to the three mobile add/edit modal sheets (semester, course, reading/task forms) via a new `SheetHeader` component (`src/components/SheetHeader.tsx`, no new dependencies): a circular ✕ close button at the top left (dismisses via `router.back()`, with an accessibility label and pressed feedback) plus the centered sheet title. The native stack header is hidden on these three modal screens so the header sits at the very top of the sheet; on Android the component pads itself below the status bar via the safe-area inset. A grabber-bar-only first iteration was replaced because Android modals aren't natively drag-dismissable — the ✕ gives both platforms an explicit close affordance, while iOS sheets additionally keep their native drag-to-dismiss.
- Added a calendar date entry to the mobile forms via a new reusable `DateField` component (`src/components/DateField.tsx`) backed by `@react-native-community/datetimepicker` (the one new dependency, pinned by `expo install` to the SDK 56 version, Expo Go compatible). A pressable field styled like the existing inputs opens the native picker — a one-shot dialog on Android, an inline picker in a bottom-sheet modal with a Done button on iOS. Dates are formatted with a local-time `toYMD` helper (no `toISOString`, so no off-by-one in negative-offset timezones); the on-disk format stays the exact `YYYY-MM-DD` string the desktop writes.
- The semester form's start date and the item form's task due date now use `DateField` instead of typed `YYYY-MM-DD` TextInputs. The due date keeps its Clear control (now built into `DateField` via `allowClear`, round-tripping to `''` = no due date), and both forms keep their `isValidDate` submit-time guards as a safety net.
- Added a device-local UI preferences module to `@lectio/mobile` (`src/lib/prefs.ts`): a tiny typed AsyncStorage wrapper (keys namespaced `lectio:pref:`) for last-opened semester, Study Mode, sort order, and tutorial-seen — mirroring the desktop's `readPref`/`writePref` semantics (reads never throw, writes fail silently). This is UI state only and never touches the semester JSON or Supabase rows.
- First prefs consumer: the mobile app now reopens the last-opened semester on launch. The semester screen records its id on focus, and the semesters list auto-navigates to it once per app launch (a module-level guard prevents re-jumping when the user deliberately navigates back, and the jump is skipped in batch edit mode). If the recorded semester was deleted, the stale pref is cleared and the list is shown.
- Moved three more pure planner helpers into `@lectio/core/planner-core` (foundation for upcoming mobile features; the desktop keeps its inline copies for now, zero behavior change): `courseBreakdown` (per-course done/total split by readings/tasks, honoring Study Mode and ghost items), `sortedCourses` + the `SORT_ORDERS` list (non-mutating course sorting by progress/alphabetical, with week sorts falling back to A → Z, mirroring the desktop), and `setItemStatus` (assign a tag id directly to a reading/task, clearing any ghost marker). All three are mirrored in the mobile ambient types (`lectio-core.d.ts`) and covered by new `breakdown.test.js` / `sort.test.js` unit suites.
- The new suites also exercise the helpers through core's CommonJS surface (via a small `tests/helpers/require-core.cjs` loader) — the same `require()` path the desktop main process uses — which additionally keeps the v8 coverage accounting for the dual-loaded `planner-core.js` above the enforced thresholds.
- Added a "Reading / Task" tab to the desktop's New/Edit modal (the "+ New" button's dialog), mirroring the mobile add flow: a Reading | Task toggle (Task reveals an optional due-date field), a course selector, week (clamped to the semester's week count) and title; submitting with "Add" appends the item to the currently open semester via core's `addItem` — the same shape as the inline add-rows — then persists and re-renders. With no open semester or no courses the tab shows a hint and disables the submit. The hidden semester fields drop their `required` flags while this tab is active so the form can submit.
- Unified the mobile add flows behind a shared, permanent bottom-right "+" floating action button (`src/components/Fab.tsx`) on the Semesters, Courses, and Course-detail screens — it stays fixed while the content scrolls (lists keep enough bottom padding for the last row to clear it), replacing the previous per-screen "+ New" / "+ Course" pill buttons and adding the missing FAB on course detail.
- Added an add-type tab row (`src/components/FormTabs.tsx`) to the create forms, indicating what is being added: "Semester" on the semester form, "Course" on the course form, and switchable "Reading | Task" tabs on the item form (Reading active by default; selecting Task reveals the due-date field). Edit mode is unchanged and shows no tabs; all field logic and save paths stay in the existing form screens — nothing was duplicated.
- Added semester CRUD to the mobile app: a new modal form screen (`app/semester-form.tsx`) creates and edits semesters (name, start date, weeks — validated, no new dependencies, Expo Go compatible), with slug-based unique ids (`src/lib/semester-id.ts`) mirroring the desktop's `slugify` + collision loop. New semesters get cloned copies of the default reading/task tag arrays; edits keep the existing id and preserve courses and tags.
- Wired the mobile semesters list (`app/index.tsx`) to the new form: a "+ New" header button opens create mode, long-pressing a row offers Edit / Delete (delete behind a confirmation alert), and the list refreshes after each mutation.
- Replaced the bare "No semesters yet." empty state with a real first-run path: "Create your first semester" opens the form, and "Add sample semester" seeds the existing sample via `ensureSeed` (which still no-ops when storage is non-empty).
- Ticked the corresponding "Content editing" items (semester CRUD, first-run path) in `docs/PENDING_FEATURES.md`.
- Added `react-native-gesture-handler` to `@lectio/mobile` (pinned tree-wide to 2.31.2 via the root `overrides`, matching Expo Go SDK 56's native module) and a reusable `SwipeableRow` component (`src/components/SwipeableRow.tsx`); the root layout is wrapped in `GestureHandlerRootView`.
- Swipe actions on mobile: swiping a row left reveals a red Delete action (semesters, courses, and readings/tasks — each behind a confirmation alert); swiping a semester row right reveals a blue Edit action that opens the semester form. The long-press Edit/Delete menu on semesters is kept.
- Batch edit mode on mobile: an Edit header button (top-left on the semesters list; top-right on the courses and course-detail screens, where the back button occupies the left slot) toggles a selection mode with per-row select circles and a "Delete (n)" header action. Course deletion goes through `@lectio/core`'s `deleteCourse`.
- Moved the "+ New" action to a large rounded floating button pinned to the bottom-right of the semesters list (hidden while batch edit mode is active), and replaced the "Sign out" header button with a "Profile" entry opening a new profile screen (`app/profile.tsx`) that shows the signed-in email and the sign-out option (only that, for now).
- Added two pure course helpers to `@lectio/core/planner-core` with unit tests: `editCourseColor` (recolor, returns the course or null) and `reorderCourses` (in-place reorder to a given id order, mirroring `reorderTags`); both are mirrored in the mobile ambient types.
- Added mobile courses CRUD: a new modal course form (`app/semester/course-form.tsx` — one static route taking `id`/`courseId` query params) creates and edits courses with a name field and a fixed 8-color swatch palette (a course's current off-palette color is kept as an extra leading swatch so editing never silently changes it). Saves follow the fresh-load → mutate-via-core → persist pattern.
- Wired the courses list (`app/semester/[id].tsx`): a floating "+ Course" button (matching the semesters screen pattern), swipe right on a course to edit, long-press for an Edit / Move up / Move down / Delete menu (reorder goes through core's `reorderCourses` and persists), and an "Add a course" button in the empty state. Swipe-left delete and batch edit mode were already in place from 7A.
- Added three pure item helpers to `@lectio/core/planner-core` with a new `items.test.js` unit suite: `addItem` (readings get `r-pending`, tasks `t-pending` + `dueDate` defaulting to `''`, matching the desktop's `addRow` shape), `editItem` (patches only provided title/week/dueDate; empty dueDate clears it, tasks only), and `deleteItem`; all three mirrored in the mobile ambient types.
- Added a mobile reading/task form (`app/semester/item-form.tsx` — static modal route taking `id`/`courseId`/`kind`/`itemId` query params): title, week (clamped to the semester's week count), and — for tasks only — an optional `YYYY-MM-DD` due date with a Clear control. Saves follow the fresh-load → mutate-via-core → persist pattern.
- Wired the course detail screen: "+ Add" buttons on the Readings/Tasks section headers (the empty texts are tappable too), long-press an item for Edit / Delete, swipe right to edit, tasks show "due YYYY-MM-DD" under their week line, and single-item deletion now goes through core's `deleteItem`. Tap-to-cycle and the 7A swipe-left delete / batch edit mode are unchanged. With this, Phase 7 is complete: a brand-new account can build a full semester (semester → courses → readings/tasks) entirely on the phone.
- Fixed the PR "Build (macOS, no publish)" CI job: the `--publish never` flag was being lost through the two npm-workspace layers (root alias → workspace script), so electron-builder ran as `--mac never` and failed with "Unknown target: never". The build now invokes the desktop workspace script directly (`npm run build:mac --workspace @lectio/desktop -- --publish never`) so the flag forwards correctly and electron-builder packages the `.dmg`/`.zip` without attempting to publish, dropping the spurious `GH_TOKEN` requirement. Applied the same single-layer fix to `release.yml` (which had the identical latent bug), keeping `--publish always` there for real tagged releases.
- Bumped the GitHub Actions in `ci.yml`/`release.yml` to majors that run on Node.js 24 (`actions/checkout@v6`, `actions/setup-node@v6`, `actions/upload-artifact@v7`), clearing the Node.js 20 deprecation warning.
- Documentation sync: brought `README.md`, `CLAUDE.md`, and the `docs/` files in line with the monorepo + desktop + mobile + Supabase reality (no longer "desktop-only"), de-duplicated the macOS signing prose into `docs/MACOS_SIGNING.md`, fixed stale root-relative paths in the icon/signing docs, and added `docs/PENDING_FEATURES.md` plus a `packages/mobile/README.md`.

### Mobile preparation — Phase 6: Supabase sync

- Added `@supabase/supabase-js` and `react-native-url-polyfill` to `@lectio/mobile`; the Supabase client (`src/supabase/client.ts`) reads `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from env vars and throws a clear error when either is missing. Token auto-refresh is wired to `AppState` so the session refreshes when the app returns to the foreground.
- Added a Supabase storage adapter (`src/storage/supabase-storage.ts`) backed by the `public.semesters` table that satisfies the same `@lectio/core` async storage contract as the device adapter — same method names, same id guard, same "invalid"/"not found" error messages, same `migrateStatusToTagId` on load, validated by `assertStorage`. Row Level Security on the server enforces user isolation; the adapter sets `user_id` on upsert using the composite primary key `(user_id, id)`.
- Added an `AuthProvider` React context (`src/auth/AuthProvider.tsx`) that restores the persisted session via `AsyncStorage` on launch, subscribes to `onAuthStateChange`, and exposes `signIn` / `signUp` / `signOut` to the app.
- Added a sign-in screen (`app/sign-in.tsx`) with email + password fields, "Sign in" and "Create account" buttons, inline error display, and a loading state — no OAuth, no native modules, works in Expo Go.
- Wired the root layout (`app/_layout.tsx`) to show a spinner during session restore, redirect unauthenticated users to `/sign-in`, and redirect back to `/` on sign-in — using `useSegments` + `router.replace` for the Expo Router file-based navigation model.
- Switched the app's active storage from `createDeviceStorage` to `createSupabaseStorage`; `createDeviceStorage` is kept exported as the offline/local fallback for a future offline-mode phase. The first-run seed (`ensureSeed`) is no longer auto-called to avoid silently pushing sample data to every new cloud account.
- Added a "Sign out" header button to the semesters screen; on sign-out, in-memory state is cleared and the auth redirect navigates back to the sign-in screen.
- Added `packages/mobile/.env.example` with placeholder values (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) and added `.env` / `.env.local` to `packages/mobile/.gitignore` (the root `.gitignore` already covers `.env*`). The Supabase adapter contract test is deferred — manual cross-device round-trip and RLS isolation are the verification criteria for this phase.

### Mobile preparation — Phase 5: mobile scaffold + MVP UI

- Scaffolded a new `@lectio/mobile` workspace package: an Expo (SDK 56, React Native 0.85, React 19.2) app using Expo Router (file-based) and TypeScript, runnable in Expo Go with no native/dev-client build. Added a monorepo-aware `metro.config.js` (watches the repo root, resolves the hoisted `@lectio/core` symlink, disables hierarchical lookup) so Metro bundles the shared core.
- Added an on-device storage adapter (`src/storage/device-storage.ts`) backed by `@react-native-async-storage/async-storage` that satisfies the Phase-4 async storage contract — same `migrateStatusToTagId` on load, same id guard (rejects ids not matching `/^[a-zA-Z0-9_-]+$/` with "invalid", missing with "not found"), validated by `assertStorage` — so it behaves identically to the desktop fs adapter.
- Added hand-written ambient types for `@lectio/core` (`types/lectio-core.d.ts`) covering the data shapes and the RN-safe subpaths (`.`, `./planner-core`, `./storage/migrate`, `./storage/contract`); tsconfig `paths` map those specifiers to the declaration file so the symlinked JS package is typed without touching core's published surface. `npx tsc --noEmit` passes. Added a first-run seed (`src/storage/seed.ts`) that saves one realistic sample semester (2 courses with varied readings/tasks) when storage is empty, including the default tag arrays so migration leaves it untouched.
- Added the MVP screens (Expo Router + TypeScript): semesters list → courses list (per-course progress bars from `courseProgress`) → course detail (readings/tasks with their tag name + color dot; tapping an item advances it to the next tag, recomputes progress via core, and persists). All planner math comes from `@lectio/core` — none is reimplemented in the app. Added a minimal light/dark theme (`src/theme.ts`) driven by the OS color scheme.
- Added root convenience scripts (`mobile`, `mobile:ios`, `mobile:android`) delegating to the `@lectio/mobile` workspace.
- The device adapter's contract test was skipped this phase (the reusable suite is Vitest-based and AsyncStorage needs RN-specific mocking that isn't worth standing up yet); it will be contract-tested in a later phase. Core and desktop are unchanged.
- Fixed a launch crash on SDK 56: flattened the `style` arrays on the `Pressable` children of `<Link asChild>` (`StyleSheet.flatten`), which the rewritten Expo Router renders through a `<Slot>` that no longer accepts an array style on its direct child.
- Fixed Android bundling: added `@expo/ui` (required by SDK 56's Expo Router for its native toolbar — `@expo/ui/jetpack-compose` on Android) and its `react-native-reanimated`/`react-native-worklets` peers, pinned tree-wide to the SDK 56 versions via a root `overrides` (`reanimated@4.3.1`, `worklets@0.8.3`) so they dedupe to a single copy and satisfy `expo-modules-core`. Verified bundling and launch on both the iOS simulator and the Android emulator.

### Mobile preparation — Phase 4: storage abstraction

- Extracted `migrateStatusToTagId` from `semester-store.js` into a new platform-agnostic `@lectio/core/storage/migrate` module (depends only on `planner-core`, no `fs`); `semester-store.js` now consumes and re-exports it, keeping its public API and behaviour identical.
- Added `@lectio/core/storage/contract`: the canonical async storage interface (`list`/`get`/`save`/`delete`) documented as a single source of truth, with a `STORAGE_METHODS` list and an `assertStorage()` runtime validator that every platform adapter is checked against.
- Added `@lectio/core/storage/fs` — a filesystem adapter (`createFsStorage(dirOrResolver)`) that satisfies the async contract by wrapping the existing synchronous `semester-store`, accepting a directory string or a `() => dir` resolver (mirroring `ipc-handlers`). Additive only: the desktop, `ipc-handlers.js`, and existing behaviour are unchanged.
- Added a reusable `tests/contract/storage-contract.js` suite (run by `tests/unit/fs-storage.test.js` against the fs adapter) that exercises the full contract — list/get/save/delete, migration on load, missing-id and traversal-id rejection — so the future Supabase adapter can run the same suite.
- Added `./storage/migrate`, `./storage/contract`, and `./storage/fs` subpath exports to `@lectio/core`.

### Mobile preparation — Phase 3: CI monorepo fixes

- Fixed the CI coverage artifact path: the "Upload coverage report" step now uploads from `packages/core/coverage/` (where Vitest writes coverage in the monorepo) instead of the stale root `coverage/`.
- Switched CI installs to `npm ci` for reproducible, lockfile-pinned dependencies, and narrowed the `ci.yml` triggers to push/PR on `main` + `mobile-prep` (keeping `workflow_call` so `release.yml` can require the workflow) instead of running on every push of every branch.
- Added a macOS-only `build-macos` job to `ci.yml` that runs the full prebuild chain (`sync-core` + `bundle-deps`) and electron-builder without `--publish`, so packaging breakage is caught on PRs rather than at tag time. It gates on the `test` job and uploads no artifacts.
- Fixed the `release.yml` "Upload build artifacts" paths (macOS and Windows) to point at `packages/desktop/dist/` (electron-builder's output in the monorepo) instead of the stale root `dist/`.

### Mobile preparation — Phase 2: relocate desktop into @lectio/desktop

- Moved the entire desktop app (`main.js`, `preload.js`, `index.html`, `app.js`, `style.css`, `start.command`, and the `assets/`, `build/`, `semesters/` dirs) from the repo root into `packages/desktop/` via `git mv` to preserve history.
- Rewired the desktop to consume `@lectio/core` directly: `main.js` now requires `@lectio/core/ipc-handlers`, and the three temporary `lib/` re-export shims from Phase 1 (plus the empty `lib/` dir) are removed.
- The sandboxed renderer can't `require()` core, so `scripts/sync-core.js` vendors `planner-core.js` next to `index.html` (on prestart/predev/prebuild, git-ignored); `index.html` loads it via `<script src="planner-core.js">`, a relative path that resolves identically under `npm start` and in the flattened packaged bundle. electron-builder bundles `@lectio/core` as a production dependency for the main process.
- Added `packages/desktop/package.json` (`@lectio/desktop`) carrying the desktop scripts, the Electron dependencies, and the electron-builder `build` block (moved out of the root); its `files` list now bundles the vendored `planner-core.js` instead of `lib/`.
- Made the packaged build work from the npm workspace: pinned `electron` to an exact version (electron-builder can't compute it from a range when the module is hoisted) and added `scripts/bundle-deps.js` (a prebuild step) that seeds `packages/desktop/node_modules` with the production-dependency closure so electron-builder bundles `@lectio/core` + `electron-log` + `electron-updater` into the app instead of running a destructive workspace install. `scripts/clean-deps.js` removes that seed on predev/prestart so dev keeps using the live workspace packages.
- Slimmed the root `package.json` to a thin workspace manager: removed the desktop scripts, the `build` block, the Electron deps, and the `main` field; added `start`/`dev`/`build:mac`/`build:win` scripts that delegate to the `@lectio/desktop` workspace.
- Updated `README.md` and `CLAUDE.md` for the `packages/core` + `packages/desktop` layout (project tree, command paths, data/dev folder locations); `api/`, `scripts/`, `macos-signing/`, and `homebrew/` remain at the repo root.

### Mobile preparation — Phase 1: extract @lectio/core

- Moved the three dual-mode core modules (`planner-core.js`, `semester-store.js`, `ipc-handlers.js`) from the repo-root `lib/` into `packages/core/src/` as the `@lectio/core` package, using `git mv` to preserve history. No logic was changed — the moved files are byte-identical.
- Moved the Vitest suite (`tests/unit/*`, `tests/integration/*`) into `packages/core/tests/` and rewired each test's relative imports from `../../lib/<mod>.js` to `../../src/<mod>.js`.
- Added `packages/core/package.json` (`@lectio/core`) with an `exports` map that preserves the subpath imports the desktop adopts in Phase 2 (`@lectio/core/semester-store`, `@lectio/core/ipc-handlers`), plus `packages/core/vitest.config.mjs` (coverage measured against `src/**`, same 70% line/function thresholds). Removed the now-redundant root `vitest.config.mjs`.
- Delegated the root `test`/`test:watch`/`test:coverage` scripts to the `@lectio/core` workspace.
- Left thin compatibility shims at the old `lib/` paths so the still-rooted desktop keeps running until Phase 2: `semester-store.js`/`ipc-handlers.js` are one-line CommonJS re-exports, and `planner-core.js` is a guarded re-export. Repointed the single `index.html` `<script src>` at `packages/core/src/planner-core.js` (the only renderer edit), since a CommonJS shim cannot serve the browser.

### Mobile preparation — Phase 0: monorepo scaffold + Node 22 baseline

- Introduced npm workspaces at the repo root (`"workspaces": ["packages/*"]`, `"private": true`) and created the empty `packages/core/` and `packages/desktop/` directories (tracked via `.gitkeep`) so the monorepo layout exists before any source moves. No source files were moved — the desktop app builds, runs, and tests exactly as before.
- Bumped the Node baseline to 22: added a root `.nvmrc` pinning Node 22 and an `"engines": { "node": ">=22" }` field in `package.json`.
- Updated CI (`.github/workflows/ci.yml`) and the release workflow (`.github/workflows/release.yml`, both the macOS and Windows jobs) to run on Node 22.
- Updated the stated Node requirement to 22 in `README.md` and `CLAUDE.md`.

## v1.8.8

_Released: 2026-06-04_

- Test release with no functional changes. It exists as a newer self-signed build to update *into* from v1.8.7, verifying end-to-end that macOS auto-update now installs and relaunches (both v1.8.7 and v1.8.8 share the same self-signed certificate, so they have the same designated requirement).

## v1.8.7

_Released: 2026-06-04_

- Fixed macOS auto-update for real. Diagnostics in v1.8.5 confirmed Squirrel.Mac rejected every update because ad-hoc signing gives each build a different designated requirement (`code failed to satisfy specified code requirement(s)`). Builds are now signed with a **persistent self-signed code-signing certificate**, which produces a stable designated requirement (`identifier "com.masprime77.lectio" and certificate leaf = H"…"`), so macOS auto-update installs and relaunches correctly between self-signed builds.
- Added `build/afterPack.js` self-signed signing (env `MAC_SIGN_IDENTITY`, falling back to ad-hoc), a CI keychain-import step in the release workflow (driven by the `MAC_CSC_P12_BASE64` / `MAC_CSC_PASSWORD` secrets), the `scripts/gen-macos-signing-cert.sh` certificate generator, and `docs/MACOS_SIGNING.md`.
- Note: this is not Apple notarization, so the first-launch Gatekeeper prompt remains (handled by the cask / right-click → Open). Updating *into* this first signed build from an older ad-hoc copy still requires a one-time manual reinstall; auto-update works for every release after it.

## v1.8.6

_Released: 2026-06-04_

- Test release with no functional changes. It exists as a newer version to update *into* from v1.8.5, so the v1.8.5 diagnostics (electron-log + inline error surfacing) can capture the exact reason the macOS install/relaunch fails.

## v1.8.5

_Released: 2026-06-04_

- Diagnostic release for the macOS auto-update failure. Added `electron-log` as the `autoUpdater` logger, so the underlying Squirrel.Mac / ShipIt errors are written to `~/Library/Logs/Lectio/main.log` (macOS) / `%APPDATA%\Lectio\logs\main.log` (Windows).
- The update dialog now surfaces auto-update errors inline ("Update failed: …") and re-enables its buttons, instead of leaving a dead "Install & Relaunch" button when an install/relaunch fails.

## v1.8.4

_Released: 2026-06-04_

- Test release that ships no functional changes. Its purpose is to verify the v1.8.3 macOS auto-update fix end-to-end against a real newer release: updating from v1.8.3 should now surface the update dialog, download via the progress bar, and reliably relaunch into v1.8.4 on macOS (and continue to work on Windows).

## v1.8.3

_Released: 2026-06-04_

- Fixed the macOS auto-update never relaunching or applying: `quitAndInstall` closes all windows and calls `app.quit()`, but the unsaved-changes `before-quit` handler could `preventDefault()` and cancel that quit, so Squirrel never swapped the app. The `restart-and-update` handler now allows that quit through, and the renderer flushes pending edits before triggering it.
- Set `autoInstallOnAppQuit = true` as a safety net: a downloaded update now also installs on the next normal quit, so closing and reopening the app picks up the new version even if the explicit relaunch path fails.

## v1.8.2

_Released: 2026-06-04_

- Test release that ships no functional changes; its purpose is to validate the v1.8.1 update flow end-to-end (the `update-available` dialog, the GitHub Release notes panel, the download progress bar, and the reliable relaunch on macOS and Windows) against a real newer release.

## v1.8.1

_Released: 2026-06-04_

- Replaced the auto-update banner with a modal dialog that opens on `update-available`, shows the GitHub Release notes for the new version, and renders a download progress bar.
- When auto-update is off, the dialog lets the user start the download manually via "Download & Install"; when it is on, the download runs in the background and the progress bar shows immediately. After the download completes the primary button becomes "Install & Relaunch".
- Fixed `quitAndInstall` to pass `isSilent` + `isForceRunAfter`, so the update reliably relaunches on macOS and skips the NSIS re-install wizard on Windows.
- Exposed `update-download-progress` and `start-update-download` IPC channels plus `onDownloadProgress`/`startDownload` on the `window.updater` bridge.

## v1.8.0

_Released: 2026-06-03_

- Added IPC handlers for exporting a single course (`export-course`) and a full semester (`export-semester`) to `.lectio.json` files, and for reading a `.lectio.json` file back (`import-file`).
- Added native save/open file-dialog IPC handlers (`show-save-dialog`, `show-open-dialog`) scoped to the `.lectio.json` extension.
- Exposed the new export/import and dialog methods on `window.planner` in the preload bridge.
- Semester export/import now lives in the edit modal footer instead of the header toolbar; the semester selector keeps only the Edit and Delete buttons.
- Export semester writes the full semester (including tag definitions) to a `.lectio.json` file via a native save dialog.
- Import semester reads a `.lectio.json` file and shows a confirmation modal to keep or reset reading/task statuses and, on an id clash, to replace the existing semester or save it as a new one.
- Added drag-and-drop: dropping a `.lectio.json` file onto the window imports it as a semester or a course.
- Added Edit, Export, Import, and Delete icon buttons to each course-column header in Course view.
- Export course writes a single course (without tags) to a `.lectio.json` file via a native save dialog.
- Import course adds a course from a `.lectio.json` file into the current semester with freshly generated ids.
- The header **New** button now opens the create-semester modal directly (no popover).
- The New/Edit modal footer has tab-aware Import/Export buttons: on the Semester tab, Import brings in a full semester and Export (edit mode only) writes the current one; on the Courses tab, Import adds a course to the semester being built or edited; the Tags tab shows neither, since tags can't be imported/exported yet.
- Importing a course from the Courses tab works in both create mode (adds a draft course row, kept with its readings/tasks on save) and edit mode (adds it to the live semester and refreshes the course list).
- Editing the semester from a course column's pencil button or via "+ Add course" now opens the modal on the Courses tab instead of the Semester tab.
- Docs: rewrote the README Features list to match the v1.7.0 feature set (Breakdown panel, focus mode, bulk collapse controls, custom tags, Study Mode, sort control, inline due-date editing, three-tab semester modal, onboarding tour, in-app feedback, per-OS auto-updates).
- Docs: updated the README Download section to use the `Lectio-Setup.exe` artifact name and added the Homebrew one-line install command.
- Docs: added the `icon:win` and `icons` npm scripts to the README icon-build commands.
- Docs: added user stories US-036–US-046 (custom tags, tag management UI, Study Mode, sort control, focus mode, collapsible weeks, breakdown panel, inline due-date editing, onboarding tour, in-app feedback, Windows platform).
- Docs: appended US-036–US-046 to the traceability matrix, corrected the US-036/US-037/US-038 test references to the real test files (`semester-manager.test.js`, `ipc.test.js`, `progress.test.js`, `status.test.js`), and updated the coverage summary to 12 covered / 6 partial / 28 not covered (46 stories).

## v1.7.0

_Released: 2026-06-03_

- Added a "Breakdown" toggle button to the dashboard header that opens an inline panel splitting each course's progress into separate readings and tasks mini-bars with done/total counts, plus a "Total" summary row for the whole semester; the panel respects the current sort order and Study Mode, and the existing progress bars are unchanged.
- Added inline editing of a task's due date directly in the planner: tasks with a date show a clickable "due YYYY-MM-DD" that opens an inline date picker (committing on blur/Enter, cancelling on Escape, clearing the field removes the date), and tasks without one reveal a "＋ date" affordance on row hover to set one.
- Removed the "Reading / Task" quick-add tab from the semester modal (the standalone "Add reading / task" modal is unaffected).
- Renamed the semester modal title in create mode from "Create New Semester" to "New".
- Added an interactive onboarding tour that auto-launches on first run and can be replayed any time from Settings → Start tour: each step spotlights a real UI element with a cutout, shows a titled tooltip, and supports Back/Next/Skip plus keyboard navigation (arrows, Enter, Escape). Steps live in a single `TUTORIAL_STEPS` array so new features only need an entry there (see `docs/TUTORIAL_STEPS.md`).
- Replaced the feedback flow's GitHub redirect with a direct submission to the Vercel `/api/feedback` endpoint, so feedback is sent without leaving the app or needing a GitHub account; the submit button now shows a "Sending…" state, then an in-modal success confirmation, with inline error recovery on failure.

## v1.6.2

_Released: 2026-06-03_

- Added a Windows SmartScreen first-launch warning to the landing page, explaining that the installer is unsigned and describing the "More info → Run anyway" workaround.
- Fixed the broken header logo image: it now points to the always-bundled `assets/icon.png` so it renders in both development and the packaged app.
- Fixed the window being immovable under the `hiddenInset` title bar: the header is now a drag region, with interactive controls opted out so clicks still work.

## v1.6.0

_Released: 2026-06-03_

- Week sections inside each course column (All Courses view) are now collapsible via a chevron toggle; the current week is expanded by default and all others are collapsed, with each section's open/closed state persisted while navigating.
- Added header controls to bulk expand all, collapse all, or expand only the current week; the buttons act on whichever layout is active (Weekly view or All Courses view).
- Course view columns now render at a uniform fixed width (300px) regardless of course name length.
- Long course names are truncated with an ellipsis and reveal the full name via a native tooltip on hover.
- Renamed the header view toggle labels: "Week view" → "Weekly view" and "Course view" → "All Courses" (internal view values unchanged).
- Added a focused single-course mode: clicking a course name in the progress bar isolates that course's column (centred, wider) and dims the other progress rows; clicking it again restores the normal layout.
- Focused mode can also be exited by clicking the empty space around the column or pressing the Esc key.
- Added a global "+ Add" button in the header (shown once a semester is loaded) that opens a modal for adding a reading or task to any course and week of the current semester, with a Reading/Task toggle (Task reveals an optional due-date field) and the current week pre-selected.
- Added a header sort control to order courses by progress (↓/↑) or by their earliest week with content (↑/↓); the choice applies to the progress bars, course columns, and week-view cards, and persists across restarts (localStorage). Sorting is non-destructive — the underlying course order on disk is never changed.
- The sort control bakes a "Sort: " prefix into each option label, so the active mode reads as "Sort: `<mode>`" directly in the select (no separate label element).
- Added alphabetical course sort options (A → Z and Z → A) to the sort control.
- Scoped the progress and alphabetical sorts to the progress bar and All Courses columns only; the Weekly view keeps the original course order for those modes (only week sorts reorder it).
- The Week ↓ sort now also reverses the order of the weeks themselves — weeks render N … 1 in both the Weekly view and inside each All Courses column (Week ↑ stays ascending).
- Week sorts now affect only the order of the weeks (week sections in the Weekly view and within each course column); the progress bar and course-column order fall back to alphabetical (A → Z) instead of ordering courses by their earliest week.
- Replaced the hardcoded reading/task status cycles with a flexible per-semester tag system (data model and core logic): each semester now stores its own `readingTags` and `taskTags`, where every tag has a `section` (`pending`/`done`) that decides whether items count toward course progress. The "pending" and "studied" tags of each kind are protected (cannot be deleted or renamed, but can be recolored). Item statuses now store a tag id rather than a name string.
- Legacy semesters are migrated transparently on load: the default tag sets are added and existing status strings are rewritten to their matching tag ids. (UI for managing tags lands in a later change.)
- The status badge on each reading/task is now a dropdown: clicking it opens a menu of the semester's tags grouped into Pending and Done sections, and picking one assigns that tag to the item.
- The semester editor is now organised into three tabs — Semester, Courses, and Tags — and always opens on the Semester tab.
- The new Tags tab manages each semester's reading and task tags: add a tag to a section, recolor any tag, rename or delete custom tags, and drag to reorder them. Protected tags ("pending"/"studied") keep a locked name, disabled delete, and a fixed position, but can still be recolored.
- Added a Study Mode toggle in the header (persisted across restarts). While on, course progress counts only items tagged "studied" — items with other Done tags no longer contribute — and the button is highlighted; turning it off restores the normal progress calculation.
- While Study Mode is on, the status dropdown gains a distinct green "Studied" shortcut at the bottom for quickly marking an item studied (the studied tag still appears under Done as well).
- Hid the native title-bar text on macOS (`hiddenInset` title bar) so only the traffic-light buttons show, with header padding reserved so content never overlaps them.
- Added a small rounded app logo next to the "Lectio" wordmark in the header.
- Moved theme selection out of the header into the Settings modal as a Light / Dark / Auto segmented control.
- Replaced the floating edit/delete semester icon buttons with a labelled "Edit"/"Delete" group that visually attaches to the semester selector.
- Normalised every interactive header control to a uniform 32px height.
- Merged the "+ Add" and "+ New Semester" header buttons into a single "＋ New" button; the semester modal gains a "Reading / Task" tab for quickly adding a reading or task to the current semester without leaving the modal.
