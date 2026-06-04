# CLAUDE.md

Guidance for AI assistants (and humans) working in this repo.

## What this is

**Lectio** — a native **desktop app for macOS and Windows** (Electron) for
planning a university semester: courses, weekly readings and tasks, status
badges, and per-course progress. Framework-free **vanilla JS** renderer. **No
server and no database** — each semester is a plain JSON file; the Electron main
process reads and writes those files directly via Node's `fs`.

## Commands

```bash
npm install            # install deps
npm start              # run from source (electron .)
npm run dev            # run with DevTools open
npm test               # Vitest suite (run once)
npm run test:coverage  # coverage report (coverage/), thresholds enforced
npm run build:mac      # build .dmg + .zip into dist/ (electron-builder)
npm run build:win      # build NSIS .exe + .zip into dist/ (electron-builder)
npm run icon           # rebuild assets/icon.icns (macOS only: sips + iconutil)
npm run icon:win       # rebuild assets/icon.ico (cross-platform: png-to-ico)
npm run icons          # both icons (icon:win runs anywhere; icon needs macOS)
```

Node 18+ for the app and tests (CI uses Node 20); `icon:win`/`png-to-ico`
need Node 20+. Build each OS's installer on that OS: `.dmg`/`.icns` need
macOS tooling; the `.exe` is produced on Windows in CI. The `.ico` is
cross-platform, so it's generated once and **committed** (`assets/icon.ico`).

## Architecture

Electron, three layers + a shared core:

- **`main.js`** (main process): creates the `BrowserWindow`, builds the app menu
  (incl. File → Save), registers IPC handlers, runs auto-update, and owns the
  unsaved-changes close prompt (`before-quit`).
- **`preload.js`**: exposes three `contextBridge` APIs to the renderer and never
  leaks `ipcRenderer`:
  - `window.planner` — `listSemesters / getSemester / saveSemester / deleteSemester`
  - `window.updater` — auto-update events + `restartAndUpdate`
  - `window.saver` — File→Save trigger, `setDirty`, save-before-quit handshake
- **`index.html` + `app.js` + `style.css`** (renderer): all UI, rendering,
  views, the save system, theme, and session restore. `app.js` is global-scoped
  (not a module); it auto-runs `init()` at the bottom.
- **`lib/`** — pure, DOM/Electron-free logic, imported by both the app (browser
  global) and the tests (CommonJS):
  - `planner-core.js` — status cycles, `courseProgress`, course CRUD, `uid`
    (dual-mode: attaches `window.PlannerCore` in the browser, `module.exports`
    in Node)
  - `semester-store.js` — filesystem read/write/delete (parameterized by dir)
  - `ipc-handlers.js` — `registerIpcHandlers(ipcMain, getDir)`, used by `main.js`

The renderer's `api` object calls `window.planner.*` (IPC) — there is no HTTP.

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
- **Where files live:** dev → project `semesters/`; packaged → per-OS
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

- Vitest tests live in `tests/` and import `lib/` only (Node env). They do **not**
  load `app.js`/`main.js`.
- Coverage thresholds (70% lines/functions) apply to `lib/**` (`vitest.config.mjs`).
- Renderer + Electron-process behaviour (save indicator, IPC, menu, quit prompt,
  session restore) is verified with **hidden-window Electron smoke tests** run
  ad hoc — not part of the CI suite.

## Workflow & conventions

- **Branches:** work on `dev`; `main` is protected (PR required, 0 approvals so
  the owner can self-merge, required checks `Test (macos-latest)` +
  `Test (ubuntu-latest)`, must be up to date, no force-push). Sync `dev` with
  `main` before opening a PR (`git merge origin/main`).
- **Commits:** Conventional-Commits style — `feat:`, `fix:`, `chore:`, `ci:`,
  `docs:`, `test:`, `refactor:`. Small, focused commits.
- **CI/CD:** `.github/workflows/ci.yml` (tests on macOS + Ubuntu) gates
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

- **Signing:** on the free path `build/afterPack.js` signs the bundle — with a
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
  (`build/afterSign.js`).
- **iCloud:** building inside an iCloud-synced folder (e.g. `~/Documents`) can
  re-add xattrs that break local `codesign`; `afterPack` handles this gracefully
  (local copies aren't quarantined, so it's harmless). CI runs in a clean checkout.
- **Windows signing:** Windows builds are **unsigned** (no code-signing cert),
  so a freshly downloaded `.exe` trips **SmartScreen** on first run → *More info
  → Run anyway* (once). The `afterPack`/`afterSign` hooks are macOS-only and
  no-op on Windows (`electronPlatformName !== 'darwin'`).
- **arm64-only macOS build** — no Intel/universal mac build yet (cask has
  `depends_on arch: :arm64`); the Windows target is x64.
- **appId** is `com.masprime77.lectio` in `package.json`; changing it alters the
  bundle id (affects signing/updates and the userData folder location).
- Don't touch the user's `../homebrew-tap` repo unless asked; `sync-tap.sh`
  commits + pushes there.
