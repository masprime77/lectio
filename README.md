# Lectio

A minimal app for planning a university semester. Track readings and tasks per
course, per week, with click-to-cycle status badges and per-course progress
bars. Lectio ships as two apps from one monorepo:

- a framework-free **native desktop app** (macOS + Windows) built on
  [Electron](https://www.electronjs.org/) — each semester is a plain JSON file
  on disk, with no database and no server, and
- a **mobile app** (iOS + Android) built with [Expo](https://expo.dev/) /
  React Native that syncs semesters across devices through
  [Supabase](https://supabase.com/) with email/password sign-in.

Both apps share the same planner logic from the `@lectio/core` workspace. The
mobile app is an early preview that mirrors a subset of the desktop features —
see [`docs/PENDING_FEATURES.md`](docs/PENDING_FEATURES.md) for the gaps.

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
[`docs/PENDING_FEATURES.md`](docs/PENDING_FEATURES.md).

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
  a dropdown to pick any tag. Done-section tags count toward progress. Protected
  tags ("pending" / "studied") cannot be renamed or deleted but can be recolored.
  Custom tags can be added, renamed, recolored, and dragged to reorder in the
  Tags tab of the semester modal.
- **Study Mode** — header toggle (persisted) that narrows progress to items
  tagged "studied" only. A green "Studied" shortcut appears at the bottom of the
  status dropdown while Study Mode is on.
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
DevTools open. You can also double-click **`packages/desktop/start.command`** in
Finder to run the app from source without a terminal.

In development the app reads and writes the desktop package's own
`packages/desktop/semesters/` folder.

## Mobile app

The mobile app lives in the `@lectio/mobile` workspace
([`packages/mobile/`](packages/mobile/)) — an [Expo](https://expo.dev/) (SDK 56)
/ React Native app using Expo Router and TypeScript. It runs in
[Expo Go](https://expo.dev/go) with no native/dev-client build, on both iOS and
Android.

Semesters sync through Supabase (Postgres + Row Level Security), gated behind
email/password sign-in, so the same account sees the same data on every device.
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
[`docs/PENDING_FEATURES.md`](docs/PENDING_FEATURES.md).

## Testing

The core logic lives in `@lectio/core` (`packages/core/`, pure DOM-free modules)
and is tested with [Vitest](https://vitest.dev/):

```bash
npm test            # run the suite once
npm run test:watch  # watch mode
npm run test:coverage   # run with a V8 coverage report (written to coverage/)
```

- **Unit tests** (`packages/core/tests/unit/`) cover status cycling, progress
  calculation, course CRUD, and the filesystem store.
- **Integration tests** (`packages/core/tests/integration/`) drive the IPC
  handlers through a mock `ipcMain` against a temp directory.
- Coverage thresholds are enforced at **70% lines** and **70% functions**
  (see `packages/core/vitest.config.mjs`); the run fails if they aren't met.

CI runs the suite on **macOS** and **Ubuntu** (Node 22) on pushes and pull
requests to `main` and `mobile-prep`, and uploads the coverage report as an
artifact. It also runs a macOS packaging build (no publish) so desktop build
breakage is caught on PRs. A release is only built once CI passes — see
[`.github/workflows/ci.yml`](.github/workflows/ci.yml) and
[`release.yml`](.github/workflows/release.yml). Feature-to-test traceability
lives in [`docs/USER_STORIES.md`](docs/USER_STORIES.md).

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

macOS builds are signed but **not notarized** (no paid Apple Developer ID), so
Gatekeeper blocks a freshly downloaded copy the first time. Do this once:

> **First launch:** right-click **Lectio** in Applications → **Open** →
> **Open**. If macOS still refuses (e.g. *"is damaged and can't be opened"*),
> clear the download quarantine flag once:
>
> ```bash
> xattr -dr com.apple.quarantine "/Applications/Lectio.app"
> ```

This is only needed on first launch; updates after that open normally. For why
this happens — and how the persistent self-signed certificate keeps auto-update
working on the free path — see [`docs/MACOS_SIGNING.md`](docs/MACOS_SIGNING.md).

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

To produce a fully **signed + notarized** build instead — so downloads open with
no prompt at all — set `APPLE_TEAM_ID` (plus the Apple ID and Developer ID cert
env vars) before building; the signing hooks then defer to electron-builder and
notarize automatically. The signing model (self-signed free path vs. notarized)
is documented in [`docs/MACOS_SIGNING.md`](docs/MACOS_SIGNING.md).

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
[`docs/UPDATING_THE_ICON.md`](docs/UPDATING_THE_ICON.md).

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
│   ├── core/           # @lectio/core — pure, testable logic (DOM/Electron-free)
│   │   ├── src/
│   │   │   ├── planner-core.js   # status cycles, progress, course CRUD
│   │   │   ├── semester-store.js # filesystem read/write/delete
│   │   │   ├── ipc-handlers.js   # registers the semester IPC handlers
│   │   │   └── storage/          # async storage contract + adapters
│   │   │       ├── contract.js   # the canonical list/get/save/delete interface + validator
│   │   │       ├── migrate.js    # platform-agnostic legacy→tag-id migration
│   │   │       └── fs-storage.js # filesystem adapter (used by desktop)
│   │   └── tests/                # Vitest unit + integration + reusable storage-contract suite
│   ├── desktop/        # @lectio/desktop — the Electron app + electron-builder config
│   │   ├── main.js               # Main process: window, IPC handlers, auto-update
│   │   ├── preload.js            # contextBridge bridges: window.planner + window.updater
│   │   ├── index.html            # Markup: update banner, header, dashboard, planner, modal
│   │   ├── app.js                # Renderer logic: views, save system, session restore
│   │   ├── style.css             # Styles (theme variables, banners, indicators)
│   │   ├── start.command         # Double-click launcher for running from source
│   │   ├── package.json          # Desktop scripts + electron-builder config (dmg, publish)
│   │   ├── scripts/sync-core.js  # Vendors planner-core next to index.html for the renderer
│   │   ├── assets/               # Icon + DMG background, and their generators
│   │   │   ├── icon.png              # 1024×1024 source icon
│   │   │   ├── icon.icns             # built app/volume icon (see docs/UPDATING_THE_ICON.md)
│   │   │   ├── build-icns.sh         # icon.png → icon.icns  (npm run icon)
│   │   │   ├── generate-icon.js      # generate a placeholder icon.png
│   │   │   ├── dmg-background.png / @2x   # DMG window background
│   │   │   └── generate-dmg-background.js
│   │   ├── build/
│   │   │   ├── afterPack.js          # ad-hoc/self-signed sign the .app (free distribution path)
│   │   │   └── afterSign.js          # Notarization hook (runs only if APPLE_TEAM_ID set)
│   │   └── semesters/
│   │       └── example.json      # Bundled example semester (starter data)
│   └── mobile/         # @lectio/mobile — the Expo / React Native app (iOS + Android)
│       ├── app/                  # Expo Router screens (sign-in, semesters, course detail)
│       ├── src/
│       │   ├── auth/             # AuthProvider (Supabase email/password session)
│       │   ├── storage/          # device-storage + supabase-storage adapters
│       │   └── supabase/client.ts   # Supabase client (reads EXPO_PUBLIC_* env vars)
│       ├── .env.example          # Supabase URL + publishable key placeholders
│       └── package.json          # Expo scripts (start/ios/android)
├── api/                # Vercel feedback function (repo-level)
├── homebrew/
│   ├── Casks/lectio.rb            # Homebrew cask
│   ├── update-cask.sh             # refresh cask version + sha256 from a release
│   └── sync-tap.sh                # publish the cask to ../homebrew-tap
├── docs/
│   ├── PENDING_FEATURES.md       # Mobile/desktop/infra gaps tracker
│   ├── USER_STORIES.md           # Stories + test traceability
│   ├── UPDATING_THE_ICON.md      # How to rebuild icon files from icon.png
│   ├── MACOS_SIGNING.md          # Self-signed signing + auto-update notes
│   └── GITHUB_RELEASE.md         # Release-description template
├── .github/workflows/  # ci.yml (tests + macOS build) + release.yml (build & publish)
└── README.md
```

## How it works (IPC, no HTTP)

The renderer never touches the filesystem directly. `preload.js` uses
`contextBridge` to expose a small, safe `window.planner` API; each method calls
`ipcRenderer.invoke`, and the main process handles it with `ipcMain.handle`:

| Renderer call (`window.planner.*`) | IPC channel       | Main process action            |
| ---------------------------------- | ----------------- | ------------------------------ |
| `listSemesters()`                  | `list-semesters`  | List all semester files        |
| `getSemester(id)`                  | `get-semester`    | Read a semester JSON           |
| `saveSemester(id, data)`           | `save-semester`   | Write a semester JSON          |
| `deleteSemester(id)`               | `delete-semester` | Delete a semester file         |

`id` is the filename without `.json` and must match `[A-Za-z0-9_-]+` (this
guards against path traversal). `ipcRenderer` is never exposed to the renderer.

Two more `contextBridge` bridges follow the same pattern: **`window.updater`**
(auto-update events + restart) and **`window.saver`** (the File → Save trigger,
unsaved-changes reporting, and the save-before-quit handshake).

### Where your data lives

- **Development:** the desktop package's `packages/desktop/semesters/` folder.
- **Packaged app:** `~/Library/Application Support/Lectio/semesters/`
  (`app.getPath('userData')`), so your data persists across app updates. On
  first launch the app seeds this folder with the bundled `example.json`.

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
          "status": "pending"
        }
      ],
      "tasks": [
        {
          "id": "t-1",
          "week": 1,
          "title": "Exercise Set 1",
          "dueDate": "2025-10-20",
          "status": "not done"
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
