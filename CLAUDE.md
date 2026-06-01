# CLAUDE.md

Guidance for AI assistants (and humans) working in this repo.

## What this is

**Semester Planner** — a native **macOS desktop app** (Electron) for planning a
university semester: courses, weekly readings and tasks, status badges, and
per-course progress. Framework-free **vanilla JS** renderer. **No server and no
database** — each semester is a plain JSON file; the Electron main process reads
and writes those files directly via Node's `fs`.

## Commands

```bash
npm install            # install deps
npm start              # run from source (electron .)
npm run dev            # run with DevTools open
npm test               # Vitest suite (run once)
npm run test:coverage  # coverage report (coverage/), thresholds enforced
npm run build:mac      # build .dmg + .zip into dist/ (electron-builder)
npm run icon           # rebuild assets/icon.icns from assets/icon.png
```

Node 18+ (CI uses Node 20). macOS only for building/signing.

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
- **Where files live:** dev → project `semesters/`; packaged →
  `~/Library/Application Support/Semester Planner/semesters/` (seeded from the
  bundled `example.json` on first launch).

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
  builds and publishes the `.dmg`, `.zip`, and `latest-mac.yml` to the GitHub
  Release (draft by default — publish it to make the download link live).
- **Versioning:** semver. New features → minor bump; fixes → patch.
- **Homebrew:** cask at `homebrew/Casks/semester-planner.rb` (installs the
  release `.zip`). After a release, `homebrew/sync-tap.sh` refreshes
  version/sha256 and publishes to `../homebrew-tap`.
- **Icon:** see [`docs/UPDATING_THE_ICON.md`](docs/UPDATING_THE_ICON.md).

## Gotchas

- **Signing:** builds are **ad-hoc signed** (free path) via `build/afterPack.js`,
  not notarized. Downloaded copies are Gatekeeper-quarantined → first launch needs
  right-click → Open or `xattr -dr com.apple.quarantine`. The cask's `postflight`
  does this automatically. Setting `APPLE_TEAM_ID` (+ certs) switches to real
  Developer ID signing + notarization (`build/afterSign.js`).
- **iCloud:** building inside an iCloud-synced folder (e.g. `~/Documents`) can
  re-add xattrs that break local `codesign`; `afterPack` handles this gracefully
  (local copies aren't quarantined, so it's harmless). CI runs in a clean checkout.
- **arm64 only** — no Intel/universal build yet (cask has `depends_on arch: :arm64`).
- **appId** is still the placeholder `com.tu-usuario.semester-planner` in
  `package.json` → renaming it changes the bundle id (affects signing/updates).
- Don't touch the user's `../homebrew-tap` repo unless asked; `sync-tap.sh`
  commits + pushes there.
