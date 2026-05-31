# Semester Planner

A minimal, framework-free **native desktop app** for planning a university
semester. Track readings and tasks per course, per week, with click-to-cycle
status badges and per-course progress bars. Each semester is a plain JSON file —
there's no database and no server. The UI is vanilla JS in an
[Electron](https://www.electronjs.org/) window; the Electron main process reads
and writes the JSON files directly via Node.js.

![CI](https://github.com/masprime77/semester-planner/actions/workflows/ci.yml/badge.svg)
[![Latest release](https://img.shields.io/github/v/release/masprime77/semester-planner?label=download)](https://github.com/masprime77/semester-planner/releases/latest)
![Vanilla JS](https://img.shields.io/badge/frontend-vanilla%20JS-yellow)
![Electron](https://img.shields.io/badge/runtime-electron-47848F)
![macOS](https://img.shields.io/badge/platform-macOS-lightgrey)

## Download

**[⬇ Download for macOS (Apple Silicon)](https://github.com/masprime77/semester-planner/releases/latest/download/SemesterPlanner-arm64.dmg)**

That is a permanent link — it always serves the `.dmg` from the **latest**
release. Open it, drag **Semester Planner** onto Applications, and launch it (see
[First launch on macOS](#first-launch-on-macos-gatekeeper) the first time). You
can also browse the [releases page](https://github.com/masprime77/semester-planner/releases/latest)
or install via [Homebrew](#install-via-homebrew-tap).

## Features

- **Semester selector** — switch between all `.json` files in `semesters/`,
  with inline **edit** and **delete** (the delete asks for confirmation).
- **Two layouts** — toggle between **Week view** and **Course view**; the choice
  is remembered in `localStorage`:
  - *Week view* — weeks as collapsible sections (current week auto-expands),
    with one card per course showing that week's readings and tasks.
  - *Course view* — one column per course laid out side by side, each grouping
    its readings and tasks under per-week dividers, with independent scrolling.
- **Dashboard** — per-course progress bars and a current-week indicator.
- **Status cycling** — click a badge to advance its status:
  - Readings: `pending → seen → summarized → studied → pending`
  - Tasks: `not done → done → reviewed → not done`
- **Inline editing** — click a title to rename, the `×` button to delete, and
  use the add row at the bottom of each section to add new readings/tasks.
- **New / edit semester modal** — name, start date, week count, and courses with
  colors; editing preserves each course's existing readings and tasks.
- **Theme** — a header toggle cycles **Light → Dark → Auto**; Auto follows your
  system's `prefers-color-scheme` (and updates live when it changes). The choice
  is saved in `localStorage` and applied before first paint to avoid any flash.
- **Typography** — [Inter](https://fonts.google.com/specimen/Inter) for body
  text and [Outfit](https://fonts.google.com/specimen/Outfit) for headings and
  course names, loaded from Google Fonts.
- **Auto-updates** — the packaged app checks GitHub Releases on launch and
  downloads new versions in the background, showing a dismissible banner with a
  one-click **Restart to update**.
- **Mobile-friendly**, English-only, clean minimal UI with inline Tabler icons.

## Development

Requires [Node.js](https://nodejs.org) (v18+). Install dependencies and launch
the app from source:

```bash
npm install
npm start
```

`npm start` runs `electron .`, which opens the desktop window directly — no
terminal interaction, no browser, no `localhost`. Use `npm run dev` to launch
with DevTools open. You can also double-click **`start.command`** in Finder to
run the app from source without a terminal.

In development the app reads and writes the project's own `semesters/` folder.

## Testing

The core logic is extracted into `lib/` (pure, DOM-free modules) and tested with
[Vitest](https://vitest.dev/):

```bash
npm test            # run the suite once
npm run test:watch  # watch mode
npm run test:coverage   # run with a V8 coverage report (written to coverage/)
```

- **Unit tests** (`tests/unit/`) cover status cycling, progress calculation,
  course CRUD, and the filesystem store.
- **Integration tests** (`tests/integration/`) drive the IPC handlers through a
  mock `ipcMain` against a temp directory.
- Coverage thresholds are enforced at **70% lines** and **70% functions**
  (see `vitest.config.mjs`); the run fails if they aren't met.

CI runs the suite on **macOS** and **Ubuntu** (Node 20) on every push and on
pull requests to `main`, and uploads the coverage report as an artifact. A
release is only built once CI passes — see
[`.github/workflows/ci.yml`](.github/workflows/ci.yml) and
[`release.yml`](.github/workflows/release.yml). Feature-to-test traceability
lives in [`docs/USER_STORIES.md`](docs/USER_STORIES.md).

## Build for distribution

```bash
npm run build:mac
```

This runs [electron-builder](https://www.electron.build/) and produces, in the
**`dist/`** folder:

- a **`.dmg`** installer — drag-and-drop, ready to share or upload to a GitHub
  Release, and
- a **`.zip`** of the `.app` (used by the Homebrew formula).

The `.dmg` opens to a drag-to-install window — drag **Semester Planner** onto
the Applications shortcut, then launch it like any native Mac app.

### First launch on macOS (Gatekeeper)

Builds are unsigned unless you provide signing credentials, so macOS Gatekeeper
may block the app the first time:

> **First launch:** if macOS blocks the app, right-click the app in Applications
> → **Open** → **Open anyway**. This is only required once.

To produce a signed and notarized build instead, set `APPLE_TEAM_ID` (along with
`APPLE_ID` and `APPLE_ID_PASSWORD`) in the environment before `npm run build:mac`.
The `afterSign` hook notarizes automatically when `APPLE_TEAM_ID` is present and
is skipped silently otherwise.

## Project structure

```
semester-planner/
├── main.js             # Electron main process: window, IPC handlers, auto-update
├── preload.js          # contextBridge bridges: window.planner + window.updater
├── index.html          # Markup: update banner, header, dashboard, planner, modal
├── app.js              # Renderer logic (vanilla JS)
├── style.css           # Styles (theme variables, update banner)
├── start.command       # Double-click launcher for running from source
├── package.json        # Scripts + electron-builder config (dmg, publish)
├── lib/                # Pure, testable core logic
│   ├── planner-core.js      # status cycles, progress, course CRUD
│   ├── semester-store.js    # filesystem read/write/delete
│   └── ipc-handlers.js      # registers the semester IPC handlers
├── assets/             # App icon (.icns) + DMG background, and generators
├── build/
│   └── afterSign.js         # Notarization hook (runs only if APPLE_TEAM_ID set)
├── tests/              # Vitest unit + integration tests
├── homebrew/
│   └── semester-planner.rb  # Homebrew formula template
├── docs/
│   └── USER_STORIES.md      # Stories + test traceability
├── .github/workflows/  # ci.yml (tests) + release.yml (build & publish)
├── semesters/
│   └── example.json    # Bundled example semester (starter data)
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

### Where your data lives

- **Development:** the project's `semesters/` folder.
- **Packaged app:** `~/Library/Application Support/Semester Planner/semesters/`
  (`app.getPath('userData')`), so your data persists across app updates. On
  first launch the app seeds this folder with the bundled `example.json`.

## Adding a semester manually

Create a new file in the active `semesters/` folder (the project folder in
development, or `~/Library/Application Support/Semester Planner/semesters/` for
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
- Reading `status` — `pending` | `seen` | `summarized` | `studied`.
- Task `status` — `not done` | `done` | `reviewed`.
- All `id` values must be unique within their list.

The directory is read each time the list loads, so a new file shows up in the
selector the next time the app launches (or when you reselect from the dropdown).

## Releasing

Releases are built and published automatically by CI:

1. Bump `version` in `package.json` and commit.
2. Push a matching tag, e.g. `git tag v1.0.1 && git push origin v1.0.1`.
3. [`release.yml`](.github/workflows/release.yml) runs the full CI suite first
   (`needs: ci`) and, only if it passes, builds on macOS and publishes the
   `.dmg`, `.zip`, and **`latest-mac.yml`** to the GitHub Release for that tag.

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
`window.updater` bridge in [`preload.js`](preload.js); `ipcRenderer` is never
exposed.

## Install via Homebrew (tap)

For a GUI app, a **Cask** is the recommended Homebrew install — it copies
`Semester Planner.app` straight into `/Applications`. The cask template lives at
[`homebrew/Casks/semester-planner.rb`](homebrew/Casks/semester-planner.rb) and
downloads the stable `SemesterPlanner-arm64.dmg` from the release.

**Publish it as a tap** so others can install with one command:

1. Create a repo named **`homebrew-tap`** on your GitHub account (the
   `homebrew-` prefix is what makes `brew tap masprime77/tap` resolve).

2. Cut a release first (push a `v*` tag), then fill the cask's `version` and
   `sha256` from that release — the helper script does it for you:

   ```bash
   homebrew/update-cask.sh 1.0.1   # downloads the .dmg, computes sha256, rewrites the cask
   ```

3. Copy the filled `homebrew/Casks/semester-planner.rb` into the tap repo under
   `Casks/semester-planner.rb`, commit, and push.

4. Anyone can then install (and upgrade / uninstall) the app with:

   ```bash
   brew tap masprime77/tap
   brew install --cask semester-planner
   ```

> The app is currently built for **Apple Silicon (arm64)** only. For Intel
> support, add an `x64` (or `universal`) build target and a matching
> `on_intel`/`on_arm` block in the cask.
>
> A plain **formula** alternative (installs into the Cellar prefix and symlinks)
> also exists at
> [`homebrew/semester-planner.rb`](homebrew/semester-planner.rb); the cask is the
> better fit for a desktop app.

## License

MIT
