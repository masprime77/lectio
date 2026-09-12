# Lectio

A minimal app for planning a university semester. Track readings and tasks per
course, per week, with click-to-cycle status badges and per-course progress
bars. Lectio ships as two apps from one monorepo:

- a framework-free **native desktop app** (macOS + Windows) built on
  [Electron](https://www.electronjs.org/) — signed out, each semester is a
  plain JSON file on disk with no database and no server; signed in, the same
  semesters sync through Supabase, and
- a **mobile app** (iOS + Android) built with [Expo](https://expo.dev/) /
  React Native that syncs semesters across devices through
  [Supabase](https://supabase.com/), with email/password, Google or Apple
  sign-in.

Both apps share the same planner logic from the `@lectio/core` workspace, and a
signed-in account sees the same semesters on desktop and mobile alike. The
mobile app still mirrors a subset of the desktop features — see
[`docs/planning/PENDING_FEATURES.md`](docs/planning/PENDING_FEATURES.md) for the gaps.

![CI](https://github.com/masprime77/lectio/actions/workflows/ci.yml/badge.svg)
[![Latest release](https://img.shields.io/github/v/release/masprime77/lectio?label=download)](https://github.com/masprime77/lectio/releases/latest)
![Vanilla JS](https://img.shields.io/badge/frontend-vanilla%20JS-yellow)
![Electron](https://img.shields.io/badge/desktop-electron-47848F)
![Expo](https://img.shields.io/badge/mobile-expo-000020)
![macOS](https://img.shields.io/badge/platform-macOS-lightgrey)
![Windows](https://img.shields.io/badge/platform-Windows-lightgrey)
![iOS](https://img.shields.io/badge/platform-iOS-lightgrey)
![Android](https://img.shields.io/badge/platform-Android-lightgrey)

## Download

**[⬇ Download for macOS (Apple Silicon)](https://github.com/masprime77/lectio/releases/latest/download/Lectio-arm64.dmg)**

That is a permanent link — it always serves the `.dmg` from the **latest**
release. Open it, drag **Lectio** onto Applications, and launch it (see
[First launch on macOS](#first-launch-on-macos-gatekeeper) the first time). You
can also browse the [releases page](https://github.com/masprime77/lectio/releases/latest)
or install via [Homebrew](#install-via-homebrew-tap).

**[⬇ Download for Windows](https://github.com/masprime77/lectio/releases/latest)** —
grab `Lectio-Setup.exe` from the latest release page. Run it and follow
**Next → Next → Install** (see
[First launch on Windows](#first-launch-on-windows-smartscreen) the first time).

Or install on macOS via Homebrew:

```bash
brew tap masprime77/tap && brew install --cask lectio
```

## Features

The full feature set below is the **desktop app**. The mobile app currently
mirrors a subset (browse semesters/courses, per-course progress, tap to cycle
item tags) — see [Mobile app](#mobile-app) and
[`docs/planning/PENDING_FEATURES.md`](docs/planning/PENDING_FEATURES.md).

- **Semester selector** — switch between all `.json` semesters with labelled
  Edit and Delete controls; delete requires confirmation.
- **Two layouts** — toggle between **Weekly view** and **All Courses**; choice
  persists in `localStorage`:
  - *Weekly view* — collapsible week sections (current week auto-expands);
    one card per course showing that week's readings and tasks.
  - *All Courses* — one column per course (uniform 300 px, independent scroll).
    Each column groups readings and tasks under collapsible per-week dividers
    (current week auto-expanded). Long course names truncated with a tooltip.
- **Dashboard** — per-course progress bars and current-week indicator.
  Click a course name to enter **focus mode** (column centres and widens,
  others dim). Click again or press Esc to exit.
  The **Breakdown** toggle opens an inline panel showing separate
  readings and tasks mini-bars with done/total counts per course, plus a Total
  summary row for the semester.
- **Bulk collapse controls** — Expand all / Collapse all / Expand current week
  buttons in the header act on whichever layout is active.
- **Custom tag system** — each semester defines its own reading tags and task
  tags grouped into *Pending* and *Done* sections. Clicking a status badge opens
  a dropdown to pick any tag. Done-section tags count toward progress. The
  "pending" tag of each kind is protected (cannot be renamed or deleted, but can
  be recolored); every other tag, including "studied", can be renamed, recolored,
  deleted, and reordered. Custom tags can be added, renamed, recolored, and
  dragged to reorder in the Tags tab of the semester modal.
- **Pomodoro study timer** — start a focus timer for any course from either
  app: set your focus and break lengths and how many blocks precede a long
  break, and Lectio adds the time to that course as you go. The control becomes
  a live countdown you can pause, skip, or stop; the remaining time is derived
  from the session deadline, so backgrounding, sleeping, or restarting the app
  never loses time. Each course's total is shown on the dashboard and course
  views, and can be corrected by hand.
- **Sort control** — order courses by progress (↓/↑), alphabetically (A → Z /
  Z → A), or by week (↑/↓). Persists in `localStorage`; never rewrites the JSON
  file. Progress and alphabetical sorts apply to the dashboard and All Courses
  view; week sorts also reorder the weeks themselves.
- **Inline editing** — click a title to rename; `×` to delete; add rows at the
  bottom of each section for new readings/tasks.
- **Inline due-date editing** — tasks with a due date show a clickable
  "due YYYY-MM-DD" badge that opens an inline date picker (commit on blur/Enter,
  cancel on Escape, clear the field to remove the date). Tasks without one reveal
  a "＋ date" affordance on row hover.
- **＋ New button** — opens the semester modal, which has three tabs:
  *Semester* (name, start date, number of weeks), *Courses* (add/edit/reorder
  courses with accent colors), and *Tags* (manage reading and task tags).
- **Autosave & manual save** — every change autosaves after a 500 ms debounce
  with a header **Saving… → ✓ Saved** indicator. Save immediately with
  **⌘S / Ctrl+S** or **File → Save**. An **Unsaved changes** indicator and a
  save-before-quit dialog protect your work.
- **Session restore** — reopens the last active semester and view on launch;
  falls back gracefully if the semester was deleted.
- **Example semester** — a fresh install starts empty; the "No semesters yet"
  screen offers a "Load example semester" button that adds a small starter
  semester (2 courses) to explore right away, alongside the "New" button.
- **Onboarding tour** — auto-launches on first run; replay any time via
  Settings → Tutorial. Each step spotlights a real UI element with a cutout
  and tooltip; supports Back / Next / Skip and keyboard navigation.
- **Feedback** — send feedback directly from the app without leaving it or
  needing a GitHub account.
- **Theme** — select **Light**, **Dark**, or **Auto** in Settings (⌘,).
  Auto follows `prefers-color-scheme` and updates live; applied before first
  paint to avoid any flash.
- **Typography** — [Inter](https://fonts.google.com/specimen/Inter) for body
  text and [Outfit](https://fonts.google.com/specimen/Outfit) for headings and
  course names, loaded from Google Fonts.
- **Auto-updates** — checks GitHub Releases on launch and downloads updates in
  the background; shows a dismissible banner with a one-click **Restart to
  update** (macOS via `latest-mac.yml`, Windows via `latest.yml`).

## Development

Requires [Node.js](https://nodejs.org) (v22+). Install dependencies and launch
the app from source:

```bash
npm install
npm start
```

`npm start` (from the repo root) delegates to the `@lectio/desktop` workspace,
which runs `electron .` and opens the desktop window directly — no terminal
interaction, no browser, no `localhost`. Use `npm run dev` to launch with
DevTools open.

In development the app reads and writes the desktop package's own
`packages/desktop/semesters/` folder.

## Mobile app

The mobile app lives in the `@lectio/mobile` workspace
([`packages/mobile/`](packages/mobile/)) — an [Expo](https://expo.dev/) (SDK 56)
/ React Native app using Expo Router and TypeScript. It runs in
[Expo Go](https://expo.dev/go) with no native/dev-client build, on both iOS and
Android.

Semesters sync through Supabase (Postgres + Row Level Security), gated behind
email/password, Google or Apple sign-in, so the same account sees the same data
on every device — including the desktop app, which uses the same Supabase
project once signed in.
You need a Supabase project: copy
[`packages/mobile/.env.example`](packages/mobile/.env.example) to
`packages/mobile/.env` and fill in `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

```bash
npm install            # once, from the repo root (links workspaces)
npm run mobile         # expo start — scan the QR code with Expo Go
npm run mobile:ios     # open in the iOS simulator
npm run mobile:android # open on the Android emulator
```

Setup details and current limitations are in
[`packages/mobile/README.md`](packages/mobile/README.md) and
[`docs/planning/PENDING_FEATURES.md`](docs/planning/PENDING_FEATURES.md).

## Testing

The core logic lives in `@lectio/core` (`packages/core/`, DOM-free modules) and
is tested with [Vitest](https://vitest.dev/); the mobile workspace has its own
Vitest suite too:

```bash
npm test            # run both suites once (@lectio/core, then @lectio/mobile)
npm run test:watch  # watch mode (@lectio/core only)
npm run test:coverage   # V8 coverage report for core (packages/core/coverage/)
```

- **Unit tests** (`packages/core/tests/unit/`) cover tag cycling, progress and
  breakdown, course/item CRUD, sorting, the Pomodoro timer and study-time
  accounting, the `.lectio.json` interchange format, the Moodle mapper/client/
  SSO helpers, the OAuth redirect parser, conflict detection, and the
  filesystem store.
- **Integration tests** (`packages/core/tests/integration/`) drive the IPC
  handlers through a mock `ipcMain` against a temp directory.
- **Contract tests** (`packages/core/tests/contract/`) hold a reusable suite
  every storage adapter runs against — `fs-storage` and the desktop Supabase
  adapter here, and both mobile adapters from `packages/mobile/test/`.
- Coverage thresholds are enforced at **70% lines** and **70% functions**
  (see `packages/core/vitest.config.mjs`); the run fails if they aren't met.

CI runs the suites on **macOS** and **Ubuntu** (Node 22) on pushes and pull
requests to `main` and `dev`, and uploads the coverage report as an
artifact. It also runs a macOS packaging build (no publish) so desktop build
breakage is caught on PRs, and a `tsc --noEmit` typecheck of the mobile
workspace. A release is only built once CI passes — see
[`.github/workflows/ci.yml`](.github/workflows/ci.yml) and
[`release.yml`](.github/workflows/release.yml). Feature-to-test traceability
lives in [`docs/planning/USER_STORIES.md`](docs/planning/USER_STORIES.md).

## Build for distribution

```bash
npm run build:mac
```

`npm run build:mac` (from the repo root) delegates to the `@lectio/desktop`
workspace. This runs [electron-builder](https://www.electron.build/) and
produces, in the **`packages/desktop/dist/`** folder:

- a **`.dmg`** installer — drag-and-drop, ready to share or upload to a GitHub
  Release, and
- a **`.zip`** of the `.app` (used by the Homebrew cask and auto-update).

The `.dmg` opens to a drag-to-install window — drag **Lectio** onto
the Applications shortcut, then launch it like any native Mac app.

### First launch on macOS (Gatekeeper)

Releases are signed with a real Apple Developer ID certificate and
notarized by Apple, so a freshly downloaded copy opens normally — no
Gatekeeper warning, no manual step required.

If a build was ever produced without notarization credentials configured
(see [`docs/guides/MACOS_SIGNING.md`](docs/guides/MACOS_SIGNING.md) for the fallback
path), Gatekeeper shows "unidentified developer" instead. In that case,
do this once:

> **First launch:** right-click **Lectio** in Applications → **Open** →
> **Open**. If macOS still refuses (e.g. *"is damaged and can't be opened"*),
> clear the download quarantine flag once:
>
> ```bash
> xattr -dr com.apple.quarantine "/Applications/Lectio.app"
> ```

### First launch on Windows (SmartScreen)

On Windows, build the installer with:

```bash
npm run build:win
```

This produces, in the **`packages/desktop/dist/`** folder, a **`Lectio Setup <version>.exe`**
[NSIS](https://www.electron.build/configuration/nsis) installer (plus a `.zip`
of the app and `latest.yml` for auto-updates). Run the installer and follow
**Next → Next → Install** — you can pick the install directory, and it creates
**Desktop** and **Start Menu** shortcuts.

The installer and app are **not** signed with a paid certificate, so the first
time you run a freshly downloaded copy, **Windows Defender SmartScreen** may show
a blue *"Windows protected your PC"* warning. Do this once:

> **First launch:** click **More info** → **Run anyway**. This only appears once.

This is the Windows equivalent of macOS Gatekeeper above; once you've allowed it,
updates after that launch normally.

Windows builds remain unsigned (see Phase 17 in the roadmap for the
signing-cert decision); macOS builds are fully signed and notarized as of
this release — see [`docs/guides/MACOS_SIGNING.md`](docs/guides/MACOS_SIGNING.md) for
how the credentials are configured and the self-signed fallback behavior.

## Updating the app icon

Replace `packages/desktop/assets/icon.png` (1024×1024) with your artwork, then
rebuild the `.icns` (the icon scripts live in the `@lectio/desktop` workspace):

```bash
npm run icon --workspace @lectio/desktop      # icon.png → icon.icns (macOS: sips + iconutil)
npm run icon:win --workspace @lectio/desktop  # icon.png → icon.ico (cross-platform, Node 22+)
npm run icons --workspace @lectio/desktop     # rebuild both icon.icns and icon.ico
```

Commit both files and ship the new icon in the next release. Full details (the
generated sizes, DMG background, and caching tips) are in
[`docs/guides/UPDATING_THE_ICON.md`](docs/guides/UPDATING_THE_ICON.md).

## Project structure

An npm-workspaces monorepo with three packages: shared logic in `@lectio/core`,
the Electron app in `@lectio/desktop`, and the Expo app in `@lectio/mobile`.
Repo-level concerns (signing, Homebrew, the feedback function) stay at the root.
Contributor-facing detail (workspace commands, the storage contract, conventions)
lives in [`CLAUDE.md`](CLAUDE.md).

```
lectio/
├── package.json        # Workspace root: delegates start/dev/build/test/mobile to the packages
├── packages/
│   ├── core/           # @lectio/core — shared, testable logic (DOM/Electron-free)
│   │   ├── src/
│   │   │   ├── planner-core.js   # tags, progress, breakdown, course/item CRUD, sorting, uid
│   │   │   ├── pomodoro-core.js  # study timer state machine + study-time accounting
│   │   │   ├── semester-store.js # filesystem read/write/delete
│   │   │   ├── ipc-handlers.js   # registers the semester + export/import IPC handlers
│   │   │   ├── integrations/     # platform-free integrations
│   │   │   │   ├── lectio-file.js    # .lectio.json interchange envelope (build/parse)
│   │   │   │   ├── moodle.js         # Moodle course-contents → import candidates
│   │   │   │   ├── moodle-client.js  # Moodle Web Services REST client
│   │   │   │   ├── moodle-sso.js     # SSO launch URL + token-redirect parser
│   │   │   │   └── oauth-redirect.js # lectio://auth-callback parser
│   │   │   └── storage/          # async storage contract + adapters
│   │   │       ├── contract.js   # the canonical list/get/save/delete interface + validator
│   │   │       ├── migrate.js    # platform-agnostic legacy→tag-id migration
│   │   │       ├── conflict.js   # cross-device write-conflict detection + ConflictError
│   │   │       └── fs-storage.js # filesystem adapter (used by desktop)
│   │   └── tests/                # Vitest unit + integration + reusable storage-contract suite
│   ├── desktop/        # @lectio/desktop — the Electron app + electron-builder config
│   │   ├── main.js               # Main process: windows, IPC, menu, tray, auto-update
│   │   ├── preload.js            # contextBridge bridges (11 — see "How it works" below)
│   │   ├── preload-pomodoro-popup.js  # separate preload for the popup's own renderer
│   │   ├── index.html            # Markup: update banner, header, dashboard, planner, modals
│   │   ├── pomodoro-popup.html   # The always-on-top phase-complete alert window
│   │   ├── app.js                # Renderer logic: views, save system, session restore
│   │   ├── auth.js               # Renderer auth surface (window.lectioAuth)
│   │   ├── supabase-client.js    # Builds window.lectioSupabase from the generated config
│   │   ├── supabase-storage.js   # Desktop cloud storage adapter (contract-compliant)
│   │   ├── supabase-config.example.js  # Template for the generated renderer config
│   │   ├── local-import.js       # One-time, non-destructive local → cloud upload
│   │   ├── style.css             # Styles (theme variables, banners, indicators)
│   │   ├── package.json          # Desktop scripts + electron-builder config (dmg, nsis, publish)
│   │   ├── scripts/
│   │   │   ├── sync-core.js      # Vendors core modules next to index.html for the renderer
│   │   │   ├── sync-supabase.js  # Vendors supabase-js UMD + generates supabase-config.js
│   │   │   ├── bundle-deps.js    # Seeds packages/desktop/node_modules before packaging
│   │   │   └── clean-deps.js     # Drops that seed so dev uses the live workspace
│   │   ├── assets/               # Icons, DMG background, tray glyph, and their generators
│   │   │   ├── icon.png              # 1024×1024 source icon
│   │   │   ├── icon.icns / icon.ico  # built app icons (see docs/guides/UPDATING_THE_ICON.md)
│   │   │   ├── build-icns.sh         # icon.png → icon.icns  (npm run icon)
│   │   │   ├── build-ico.js          # icon.png → icon.ico   (npm run icon:win)
│   │   │   ├── generate-icon.js      # generate a placeholder icon.png
│   │   │   ├── generate-dmg-background.js  # DMG window background
│   │   │   ├── generate-tray-icon.js       # monochrome menu-bar clock glyph
│   │   │   ├── dmg-background.png / @2x    # DMG window background
│   │   │   ├── pomodoro-tray-icon.png / @2x  # menu-bar tray icon
│   │   │   └── google-logo.svg / apple-logo.svg  # OAuth provider buttons
│   │   ├── build/
│   │   │   ├── afterPack.js          # ad-hoc/self-signed sign the .app (free distribution path)
│   │   │   ├── afterSign.js          # Notarization hook (runs only if APPLE_TEAM_ID set)
│   │   │   └── entitlements.mac.plist  # Hardened Runtime entitlements (required for notarization)
│   │   └── semesters/
│   │       └── example.json      # Bundled example semester (starter data)
│   └── mobile/         # @lectio/mobile — the Expo / React Native app (iOS + Android)
│       ├── app/                  # Expo Router screens (18 routes: auth, planner, Moodle, settings)
│       ├── src/
│       │   ├── auth/             # AuthProvider + OAuth (Google / Sign in with Apple)
│       │   ├── storage/          # device-storage + supabase-storage adapters
│       │   ├── supabase/client.ts   # Supabase client (reads EXPO_PUBLIC_* env vars)
│       │   ├── pomodoro/         # Study timer UI + study-time dashboard
│       │   ├── moodle/           # Import session, raw rows, week suggestion
│       │   ├── sync/             # Conflict dialog + saveWithConflict
│       │   ├── tutorial/         # First-run onboarding overlay
│       │   ├── components/       # Shared UI (progress bars, sheets, menus, swipe rows)
│       │   ├── add/              # Semester / course / item / tag form fields
│       │   └── lib/              # Feedback client, prefs, transfer, hooks
│       ├── test/                 # Vitest suite (storage adapters against the shared contract)
│       ├── types/                # Hand-written @lectio/core ambient declarations
│       ├── .env.example          # Supabase URL + publishable key placeholders
│       ├── eas.json              # EAS Build profiles
│       └── package.json          # Expo scripts (start/ios/android/typecheck/test)
├── api/                # Vercel feedback function (repo-level)
├── supabase/           # Supabase Edge Functions (delete-account)
├── spikes/             # Throwaway validation scripts (Moodle Web Services PoC)
├── scripts/            # gen-macos-signing-cert.sh (self-signed cert for release signing)
├── homebrew/
│   ├── Casks/lectio.rb            # Homebrew cask
│   ├── update-cask.sh             # refresh cask version + sha256 from a release
│   └── sync-tap.sh                # publish the cask to ../homebrew-tap
├── docs/
│   ├── index.html                # GitHub Pages landing page
│   ├── RELEASE_NOTES.md          # Full changelog (append under
│   │                             #   ## Unreleased each task)
│   ├── AUDIT_2026-09.md          # Repository audit (architecture, dead code, security, drift)
│   ├── planning/
│   │   ├── PENDING_FEATURES.md   # Mobile/desktop/infra gaps tracker
│   │   ├── ROADMAP_TO_LAUNCH.md  # Phased plan to launch
│   │   ├── USER_STORIES.md       # Stories + test traceability
│   │   ├── TESTING_CHECKLIST.md  # Manual release-testing checklist
│   │   ├── TUTORIAL_STEPS.md     # Onboarding tour copy
│   │   └── MOODLE_INTEGRATION_SPIKE.md  # Moodle integration design notes
│   ├── guides/
│   │   ├── UPDATING_THE_ICON.md  # How to rebuild icon files from icon.png
│   │   └── MACOS_SIGNING.md      # Self-signed signing + auto-update notes
│   ├── legal/                    # Impressum + privacy policy (DE/EN), shipped in the app
│   ├── brand_images/             # Logo + icon renders for docs and the landing page
│   └── archive/
│       ├── GITHUB_RELEASE.md         # Release-description template
│       └── CHANGELOG_PRE_LAUNCH.md   # Pre-1.0 changelog
├── .github/
│   ├── workflows/      # ci.yml (tests + macOS build + mobile typecheck) + release.yml
│   └── ISSUE_TEMPLATE/ # bug_report.md + feature_request.md
└── README.md
```

## How it works (IPC first, HTTPS where it has to be)

The renderer never touches the filesystem directly. `preload.js` uses
`contextBridge` to expose small, purpose-built APIs on `window`; each method
calls `ipcRenderer.invoke`/`send`, and the main process handles it with
`ipcMain.handle`/`ipcMain.on`. `ipcRenderer` itself is never exposed, and the
renderer runs with `contextIsolation: true` / `nodeIntegration: false`.

That covers all persistence in the local (signed-out) path — no HTTP involved.
The renderer does make HTTPS calls of its own in two places: **Supabase**
(PostgREST + auth) when signed in, and the **feedback** endpoint at
`https://lectio-opal.vercel.app/api/feedback`, which files a GitHub issue on
your behalf so you don't need an account.

**`window.planner`** — semesters, dialogs, and file export/import:

| Renderer call                          | IPC channel            | Main process action                          |
| -------------------------------------- | ---------------------- | -------------------------------------------- |
| `listSemesters()`                      | `list-semesters`       | List all semester files                      |
| `getSemester(id)`                      | `get-semester`         | Read a semester JSON (migrating on load)     |
| `saveSemester(id, data)`               | `save-semester`        | Write a semester JSON                        |
| `deleteSemester(id)`                   | `delete-semester`      | Delete a semester file                       |
| `showSaveDialog(opts)`                 | `show-save-dialog`     | Native save dialog; returns the chosen path  |
| `showOpenDialog(opts)`                 | `show-open-dialog`     | Native open dialog; returns the chosen path  |
| `exportCourse({ filePath, course })`   | `export-course`        | Write a `.lectio.json` course export         |
| `exportSemester({ filePath, semester })` | `export-semester`    | Write a `.lectio.json` semester export       |
| `importFile({ filePath })`             | `import-file`          | Read + parse a `.lectio.json` file           |
| `loadExampleSemester()`                | `load-example-semester` | Copy the bundled example into the data dir  |

`id` is the filename without `.json` and must match `[A-Za-z0-9_-]+` (this
guards against path traversal), and every export/import path must end in
`.lectio.json`.

The other ten bridges follow the same pattern:

| Bridge                 | Channels                                                                                   | What it does                                              |
| ---------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `window.updater`       | `update-available`, `update-download-progress`, `update-downloaded`, `update-error`, `start-update-download`, `restart-and-update` | Auto-update events + download/restart triggers             |
| `window.saver`         | `menu-save`, `set-dirty`, `flush-save-and-quit`, `save-and-quit-done`                       | File → Save, unsaved-changes reporting, save-before-quit    |
| `window.appInfo`       | `get-version` (+ a synchronous `platform`)                                                  | App version and host platform                               |
| `window.settings`      | `get-settings`, `save-settings`, `open-settings`                                            | `settings.json` read/write + the ⌘, menu signal             |
| `window.fileUtils`     | *(no channel — calls `webUtils` in preload)*                                                | Resolves a dropped `File` to a real path for drag-and-drop import |
| `window.legalDocs`     | `open-legal-doc`                                                                            | Open the Impressum / Privacy Policy windows                 |
| `window.moodleAuth`    | `moodle-list-accounts`, `moodle-get-account-token`, `moodle-add-account`, `moodle-remove-account`, `moodle-capture-token` | Multi-account Moodle tokens (encrypted via `safeStorage`) + SSO capture |
| `window.providerAuth`  | `oauth-capture-redirect`                                                                    | Drives the Google / Apple OAuth window and parses the redirect |
| `window.pomodoroTray`  | `pomodoro-tray-report`, `tray-pomodoro-action`, `tray-open-pomodoro-modal`                  | Menu-bar timer state + the clicked action id                |
| `window.pomodoroPopup` | `pomodoro-popup-show`, `pomodoro-popup-hide`, `popup-pomodoro-action`                       | The always-on-top phase-complete alert                      |

The popup window has its own smaller preload
(`preload-pomodoro-popup.js`, channels `pomodoro-popup-data`,
`pomodoro-popup-action`, `pomodoro-popup-dismiss`) running in a context that
never shares JavaScript with the main window.

### Where your data lives

- **Development:** the desktop package's `packages/desktop/semesters/` folder.
- **Packaged app:** `~/Library/Application Support/Lectio/semesters/`
  (`app.getPath('userData')`), so your data persists across app updates. It's
  empty on first launch — use the "New" button or the "Load example
  semester" empty-state action to add your first semester.

## Adding a semester manually

Create a new file in the active `semesters/` folder (`packages/desktop/semesters/`
in development, or `~/Library/Application Support/Lectio/semesters/` for
the installed app), e.g. `ws2025.json`. The filename (without `.json`) is the
semester's id. Follow this schema:

```json
{
  "id": "ws2025",
  "name": "Winter Semester 2025",
  "startDate": "2025-10-13",
  "weeks": 15,
  "courses": [
    {
      "id": "course-1",
      "name": "Algorithms",
      "color": "#4A90D9",
      "readings": [
        {
          "id": "r-1",
          "week": 1,
          "title": "Chapter 1: Introduction",
          "status": "r-pending"
        }
      ],
      "tasks": [
        {
          "id": "t-1",
          "week": 1,
          "title": "Exercise Set 1",
          "dueDate": "2025-10-20",
          "status": "t-pending"
        }
      ]
    }
  ]
}
```

Field reference:

- `startDate` — ISO date (`YYYY-MM-DD`) of the Monday of week 1. Week dates and
  the "current week" indicator are computed from this.
- `weeks` — total number of weeks in the semester.
- `color` — any CSS color; used as the course card's accent and progress bar.
- Reading `status` — a tag id from the semester's `readingTags` list
  (e.g. `"r-pending"`, `"r-studied"`). Legacy strings (`"pending"`,
  `"seen"`, etc.) are migrated automatically on load.
- Task `status` — a tag id from the semester's `taskTags` list
  (e.g. `"t-pending"`, `"t-done"`). Legacy strings (`"not done"`, `"done"`,
  etc.) are migrated automatically on load.
- All `id` values must be unique within their list.
- Optional fields the app adds as you use it, safe to omit when hand-writing a
  file: `readingTags` / `taskTags` (the semester's tag sets — the defaults are
  filled in on load if absent), `examDate` and `studyTime` on a course, `note`
  on a reading or task (max 280 characters), and `freeStudy` on the semester.

The directory is read each time the list loads, so a new file shows up in the
selector the next time the app launches (or when you reselect from the dropdown).

## Releasing

Releases are built and published automatically by CI:

1. Bump `version` in `package.json` and commit.
2. Push a matching tag, e.g. `git tag v1.0.1 && git push origin v1.0.1`.
3. [`release.yml`](.github/workflows/release.yml) runs the full CI suite first
   (`needs: ci`) and, only if it passes, builds on macOS and Windows in parallel
   and publishes the `.dmg`, `.zip`, and **`latest-mac.yml`** (macOS), and the
   `.exe`, `.zip`, and **`latest.yml`** (Windows) to the GitHub Release for that
   tag.

Two additional repo secrets are required for the app to be able to sign in once
built: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
(same values as `packages/mobile/.env`). Without them, `sync-supabase.js` now
fails the CI build on purpose rather than shipping a build that can never reach
the server.

To build locally without publishing, run `npm run build:mac` (artifacts land in
`dist/`).

## Auto-updates

The app uses [electron-updater](https://www.electron.build/auto-update) against
GitHub Releases (configured via the `build.publish` field in `package.json`).

- On launch, the packaged app calls `checkForUpdatesAndNotify()` and compares the
  installed version against the latest published release (using `latest-mac.yml`).
- When a newer version exists it downloads in the background and shows a banner:
  *"A new version is available, downloading…"*.
- Once downloaded, the banner offers **Restart to update**, which calls
  `autoUpdater.quitAndInstall()`. The banner can also be dismissed.
- Update errors are logged silently and never crash the app.

Auto-updates only run in the packaged app from a published release — in
development it's a no-op. The renderer talks to the updater only through the
`window.updater` bridge in [`preload.js`](packages/desktop/preload.js); `ipcRenderer` is never
exposed.

## Install via Homebrew (tap)

Install the GUI app with a **Cask** — it copies `Lectio.app` straight
into `/Applications`. The cask lives at
[`homebrew/Casks/lectio.rb`](homebrew/Casks/lectio.rb); it
downloads the release `.zip` and its `postflight` clears the download quarantine
so the (ad-hoc signed) app opens on first launch without manual steps.

**Publish it to your tap** so others can install with one command:

1. Create a repo named **`homebrew-tap`** on your GitHub account (the
   `homebrew-` prefix is what makes `brew tap masprime77/tap` resolve). Clone it
   next to this project (so it sits at `../homebrew-tap`).

2. Cut a release first (push a `v*` tag), then publish the cask to the tap — one
   command refreshes `version`/`sha256` from the release, copies the cask into
   the tap's `Casks/`, and commits + pushes it:

   ```bash
   homebrew/sync-tap.sh                  # version defaults to package.json
   # tap path defaults to ../homebrew-tap; override with TAP_DIR=/path/to/tap
   ```

   (`homebrew/update-cask.sh <version>` just does the version/sha256 refresh if
   you want that step on its own.)

3. Anyone can then install (and upgrade / uninstall) the app with:

   ```bash
   brew tap masprime77/tap
   brew install --cask lectio
   ```

> The app is currently built for **Apple Silicon (arm64)** only (the cask has
> `depends_on arch: :arm64`). For Intel support, add an `x64` (or `universal`)
> build target and a matching `on_intel`/`on_arm` block in the cask.

## License

MIT
