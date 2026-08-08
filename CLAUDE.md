# CLAUDE.md

Guidance for AI assistants (and humans) working in this repo.

## What this is

**Lectio** — an npm-workspaces monorepo for planning a university semester
(courses, weekly readings and tasks, status badges, per-course progress) that
ships as two apps sharing one core:

- **`@lectio/desktop`** — a native **desktop app for macOS and Windows**
  (Electron, framework-free **vanilla JS** renderer). **No server and no
  database** — each semester is a plain JSON file the Electron main process
  reads/writes directly via Node's `fs` (the `fs-storage` adapter).
- **`@lectio/mobile`** — an **Expo / React Native app for iOS and Android**
  (Expo Router + TypeScript, runs in Expo Go). Semesters sync across devices
  through **Supabase** (Postgres + RLS) behind email/password auth (the
  `supabase-storage` adapter); a `device-storage` adapter (on-device
  AsyncStorage) is kept for a future offline mode.
- **`@lectio/core`** — pure, DOM/Electron-free planner logic plus the async
  **storage contract** and adapters, shared by all of the above.

Sync is currently **mobile-only**: desktop still uses `fs-storage` and is not
wired to Supabase, so cross-device sync works mobile↔mobile. Remaining gaps are
tracked in [`docs/PENDING_FEATURES.md`](docs/PENDING_FEATURES.md).

## Commands

npm-workspaces monorepo. Run these from the **repo root**; `start`/`dev`/`build:*`
delegate to `@lectio/desktop`, `mobile*` to `@lectio/mobile`, and `test*` to
`@lectio/core`:

```bash
npm install            # install deps + link workspaces
npm start              # run desktop from source (→ @lectio/desktop: electron .)
npm run dev            # run with DevTools open
npm run mobile         # run mobile in Expo Go (→ @lectio/mobile: expo start)
npm run mobile:ios     # mobile in the iOS simulator
npm run mobile:android # mobile on the Android emulator
npm test               # Vitest suite (run once, @lectio/core)
npm run test:coverage  # coverage report (coverage/), thresholds enforced
npm run build:mac      # build .dmg + .zip into packages/desktop/dist/ (electron-builder)
npm run build:win      # build NSIS .exe + .zip into packages/desktop/dist/ (electron-builder)
# Mobile typecheck lives in the mobile workspace (no root alias):
npm run typecheck --workspace @lectio/mobile  # tsc --noEmit
# Icon scripts live in the desktop workspace (not delegated from root):
npm run icon --workspace @lectio/desktop      # rebuild assets/icon.icns (macOS only: sips + iconutil)
npm run icon:win --workspace @lectio/desktop  # rebuild assets/icon.ico (cross-platform: png-to-ico)
npm run icons --workspace @lectio/desktop     # both icons (icon:win runs anywhere; icon needs macOS)
```

The mobile app needs Supabase env vars: copy `packages/mobile/.env.example` to
`packages/mobile/.env` and set `EXPO_PUBLIC_SUPABASE_URL` +
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` before `npm run mobile`.

Node 22 for the app and tests (CI uses Node 22); `icon:win`/`png-to-ico`
need Node 22. Build each OS's installer on that OS: `.dmg`/`.icns` need
macOS tooling; the `.exe` is produced on Windows in CI. The `.ico` is
cross-platform, so it's generated once and **committed**
(`packages/desktop/assets/icon.ico`).

## Architecture

npm-workspaces monorepo with three packages: `@lectio/core` (`packages/core/`)
holds the shared, Electron-free logic; `@lectio/desktop` (`packages/desktop/`)
is the Electron app; `@lectio/mobile` (`packages/mobile/`) is the Expo app. Both
apps depend on core. The root `package.json` is a thin workspace manager that
delegates scripts. Repo-level concerns (`api/`, `homebrew/`, `macos-signing/`,
`scripts/`) stay at the root.

Desktop has three layers + the shared core:

- **`packages/desktop/main.js`** (main process): creates the `BrowserWindow`,
  builds the app menu (incl. File → Save), registers IPC handlers (via
  `require('@lectio/core/ipc-handlers')`), runs auto-update, and owns the
  unsaved-changes close prompt (`before-quit`).
- **`packages/desktop/preload.js`**: exposes the `contextBridge` APIs to the
  renderer and never leaks `ipcRenderer`:
  - `window.planner` — `listSemesters / getSemester / saveSemester / deleteSemester`
  - `window.updater` — auto-update events + `restartAndUpdate`
  - `window.saver` — File→Save trigger, `setDirty`, save-before-quit handshake
- **`index.html` + `app.js` + `style.css`** (renderer, in `packages/desktop/`):
  all UI, rendering, views, the save system, theme, and session restore. `app.js`
  is global-scoped (not a module); it auto-runs `init()` at the bottom. The
  renderer loads core's `planner-core.js` via `<script src="planner-core.js">`;
  that file is vendored next to `index.html` by `scripts/sync-core.js`
  (prestart/predev/prebuild, git-ignored) so the same relative path resolves
  under `npm start` and in the flattened packaged bundle — the sandboxed renderer
  (`contextIsolation:true`, `nodeIntegration:false`) can't `require()` it.
- **`@lectio/core`** (`packages/core/src/`) — pure, DOM/Electron-free logic,
  imported by the desktop main process (CommonJS), the renderer (browser global),
  and the tests (CommonJS):
  - `planner-core.js` — status cycles, `courseProgress`, course CRUD, `uid`
    (dual-mode: attaches `window.PlannerCore` in the browser, `module.exports`
    in Node)
  - `semester-store.js` — filesystem read/write/delete (parameterized by dir)
  - `ipc-handlers.js` — `registerIpcHandlers(ipcMain, getDir)`, used by `main.js`
  - `storage/` — the async storage layer shared across platforms:
    `contract.js` (the canonical `list`/`get`/`save`/`delete` interface +
    `assertStorage` validator), `migrate.js` (`migrateStatusToTagId`, the
    platform-agnostic legacy→tag-id migration), and `fs-storage.js`
    (`createFsStorage(dirOrResolver)`, used by desktop)

The renderer's `api` object calls `window.planner.*` (IPC) — there is no HTTP.

## Storage contract & adapters

All persistence goes through one async contract — `list()`, `get(id)`,
`save(id, data)`, `delete(id)` — defined in `@lectio/core/storage/contract` and
enforced at construction by `assertStorage`. Every adapter migrates on load
(`migrateStatusToTagId`), guards ids against `[A-Za-z0-9_-]+`, and uses the same
"invalid"/"not found" error messages, so they're drop-in interchangeable:

- **`fs-storage`** (`@lectio/core/storage/fs`) — filesystem, used by desktop via
  `ipc-handlers`.
- **`device-storage`** (`packages/mobile/src/storage/device-storage.ts`) —
  on-device AsyncStorage; the future offline fallback (kept but not the active
  adapter).
- **`supabase-storage`** (`packages/mobile/src/storage/supabase-storage.ts`) —
  the mobile app's **active** adapter; a `public.semesters` JSON-blob table
  keyed by `(user_id, id)` with Row Level Security for per-user isolation.

A reusable contract suite (`packages/core/tests/contract/storage-contract.js`)
exercises the full surface; it runs against `fs-storage` today. The mobile
adapters are not yet wired to it (see `docs/PENDING_FEATURES.md`).

## Mobile (`@lectio/mobile`)

Expo (SDK 56) / React Native + Expo Router (file-based routing) + TypeScript,
runnable in Expo Go (no native/dev-client build). Key pieces:

- **Screens** (`app/`): `sign-in.tsx` (email/password), `index.tsx` (semesters
  list + sign-out), `semester/[id].tsx` (courses with progress bars),
  `semester/[id]/course/[courseId].tsx` (readings/tasks; tap an item to cycle
  its tag and persist). `_layout.tsx` redirects to `/sign-in` until authed.
- **Auth** (`src/auth/AuthProvider.tsx`): Supabase email/password session,
  restored from AsyncStorage, exposing `signIn`/`signUp`/`signOut`.
- **Storage** (`src/storage/index.ts`): returns `supabase-storage` as the
  singleton `storage`; `ensureSeed` exists but is intentionally **not**
  auto-called (so new cloud accounts aren't seeded with sample data).
- All planner math comes from `@lectio/core` (typed via the hand-written
  `types/lectio-core.d.ts` ambient declarations + `tsconfig` `paths`); none is
  reimplemented. `metro.config.js` is monorepo-aware so Metro bundles the
  symlinked core.

## Data model

A semester JSON file (`<id>.json`), where `id` is the filename and must match
`[A-Za-z0-9_-]+` (path-traversal guard):

```jsonc
{
  "id": "ss2025", "name": "Summer Semester 2025",
  "startDate": "2025-04-07",          // ISO date of Monday of week 1
  "weeks": 15,
  "courses": [{
    "id": "course-1", "name": "Algorithms", "color": "#4A90D9",
    "readings": [{ "id": "r-1", "week": 1, "title": "...", "status": "pending" }],
    "tasks":    [{ "id": "t-1", "week": 1, "title": "...", "dueDate": "2025-04-14", "status": "not done" }]
  }]
}
```

- Reading status: `pending → seen → summarized → studied` (cycles).
- Task status: `not done → done → reviewed` (cycles).
- **Where files live:** dev → `packages/desktop/semesters/`; packaged → per-OS
  `app.getPath('userData')`: macOS
  `~/Library/Application Support/Lectio/semesters/`, Windows
  `%APPDATA%\Lectio\semesters\` (seeded from the bundled `example.json` on
  first launch).

## Key behaviours (renderer)

- **Views:** Week view (collapsible weeks) and Course view (columns). Toggle is
  in the header.
- **Save system:** in-memory edits call `persist()` → 500ms debounced
  `flushSave()` (`api.save`), with a header indicator (Saving…/Saved) and an
  Unsaved-changes dot. `saveNow()` is the immediate path (⌘S, File→Save,
  save-before-quit). `markDirty()` reports state to main for the quit prompt.
- **Session restore:** `lastActiveSemesterId` and `lastActiveView` in
  `localStorage`; restored in `init()` with graceful fallbacks.
- **Theme:** Light/Dark/Auto via `data-theme` on `<html>` + an anti-FOUC inline
  script in `index.html`. All colors are CSS variables (`style.css` top block).
- **Add course:** "+ Add course" reuses the semester editor modal (no separate
  flow). Course columns/empty states have low-weight +Reading/+Task buttons.

## Testing

- Vitest tests live in `packages/core/tests/` and import `@lectio/core`'s `src/`
  only (Node env). They do **not** load the desktop `app.js`/`main.js`.
- Coverage thresholds (70% lines/functions) apply to core's `src/**`
  (`packages/core/vitest.config.mjs`).
- Renderer + Electron-process behaviour (save indicator, IPC, menu, quit prompt,
  session restore) is verified with **hidden-window Electron smoke tests** run
  ad hoc — not part of the CI suite.

## Workflow & conventions

- **Branches:** work on a feature/phase branch and PR into the active
  integration branch (currently **`mobile-prep`** for the mobile work), which is
  periodically merged to `main`. `main` is protected (PR required, 0 approvals so
  the owner can self-merge, required checks `Test (macos-latest)` +
  `Test (ubuntu-latest)`, must be up to date, no force-push). Sync your branch
  with its base before opening a PR (`git merge origin/<base>`).
- **Commits:** Conventional-Commits style — `feat:`, `fix:`, `chore:`, `ci:`,
  `docs:`, `test:`, `refactor:`. Small, focused commits.
- **CI/CD:** `.github/workflows/ci.yml` runs on `main` + `mobile-prep` (tests on
  macOS + Ubuntu, plus a macOS packaging build with no publish) and gates
  `release.yml`. Release flow: bump `version` in `package.json` → PR → merge →
  `git tag vX.Y.Z && git push origin vX.Y.Z`. The release workflow runs CI, then
  builds and publishes in two parallel, independent jobs — macOS
  (`.dmg`/`.zip`/`latest-mac.yml`) and Windows (NSIS `.exe`/`.zip`/`latest.yml`) —
  to the GitHub Release (draft by default — publish it to make the download
  links live). The two `latest*.yml` files drive electron-updater per OS.
- **Versioning:** semver. New features → minor bump; fixes → patch.
- **Homebrew:** cask at `homebrew/Casks/lectio.rb` (installs the
  release `.zip`). After a release, `homebrew/sync-tap.sh` refreshes
  version/sha256 and publishes to `../homebrew-tap`.
- **Icon:** see [`docs/UPDATING_THE_ICON.md`](docs/UPDATING_THE_ICON.md).

## Gotchas

- **Signing:** on the free path `packages/desktop/build/afterPack.js` signs the bundle — with a
  **persistent self-signed cert** when the CI secrets `MAC_CSC_P12_BASE64` /
  `MAC_CSC_PASSWORD` are set (release workflow imports them → `MAC_SIGN_IDENTITY`),
  otherwise **ad-hoc**. Neither is notarized, so downloaded copies are
  Gatekeeper-quarantined → first launch needs right-click → Open or
  `xattr -dr com.apple.quarantine` (the cask's `postflight` does this). The
  self-signed cert gives a **stable designated requirement** so Squirrel.Mac
  **auto-update works** between two self-signed builds — ad-hoc cannot
  auto-update (its requirement is pinned to each build's hash). See
  [`docs/MACOS_SIGNING.md`](docs/MACOS_SIGNING.md). Setting `APPLE_TEAM_ID`
  (+ certs) switches to real Developer ID signing + notarization
  (`packages/desktop/build/afterSign.js`).
- **iCloud:** building inside an iCloud-synced folder (e.g. `~/Documents`) can
  re-add xattrs that break local `codesign`; `afterPack` handles this gracefully
  (local copies aren't quarantined, so it's harmless). CI runs in a clean checkout.
- **Windows signing:** Windows builds are **unsigned** (no code-signing cert),
  so a freshly downloaded `.exe` trips **SmartScreen** on first run → *More info
  → Run anyway* (once). The `afterPack`/`afterSign` hooks are macOS-only and
  no-op on Windows (`electronPlatformName !== 'darwin'`).
- **arm64-only macOS build** — no Intel/universal mac build yet (cask has
  `depends_on arch: :arm64`); the Windows target is x64.
- **appId** is `com.masprime77.lectio` in `packages/desktop/package.json` (the
  electron-builder `build` block); changing it alters the bundle id (affects
  signing/updates and the userData folder location). `productName` (`Lectio`)
  there drives the packaged app name / userData folder; in dev (unpackaged) the
  userData folder follows the package `name`, so it differs from the packaged
  `Lectio` path — dev scratch state only, not the shipped app.
- **Packaged build deps (npm workspace):** deps are hoisted to the repo-root
  `node_modules`, so `packages/desktop` has no local `node_modules`.
  electron-builder bundles only `<appDir>/node_modules` and otherwise runs a
  destructive `npm install --omit=dev` that prunes the hoisted root mid-build.
  `prebuild:mac`/`prebuild:win` therefore run `scripts/bundle-deps.js`, which
  seeds `packages/desktop/node_modules` with the production-dependency closure
  (computed by `npm ls`, copied from the hoisted modules) so electron-builder
  skips its install and bundles the right modules; `predev`/`prestart` run
  `scripts/clean-deps.js` to drop that seed so dev uses the live workspace.
  `electron` is **pinned to an exact version** in the desktop `package.json`
  because electron-builder can't derive it from a range when electron is hoisted.
- Don't touch the user's `../homebrew-tap` repo unless asked; `sync-tap.sh`
  commits + pushes there.
