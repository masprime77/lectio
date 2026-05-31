# Semester Planner

A minimal, framework-free **native desktop app** for planning a university
semester. Track readings and tasks per course, per week, with click-to-cycle
status badges and per-course progress bars. Each semester is a plain JSON file —
there's no database and no server. The UI is vanilla JS in an
[Electron](https://www.electronjs.org/) window; the Electron main process reads
and writes the JSON files directly via Node.js.

![Vanilla JS](https://img.shields.io/badge/frontend-vanilla%20JS-yellow)
![Electron](https://img.shields.io/badge/runtime-electron-47848F)
![macOS](https://img.shields.io/badge/platform-macOS-lightgrey)

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

## Build for distribution

```bash
npm run build:mac
```

This runs [electron-builder](https://www.electron.build/) and produces, in the
**`dist/`** folder:

- a **`.dmg`** installer — drag-and-drop, ready to share or upload to a GitHub
  Release, and
- a **`.zip`** of the `.app` (used by the Homebrew formula).

Open the `.dmg`, drag **Semester Planner** to Applications, and launch it like
any native Mac app.

## Project structure

```
semester-planner/
├── main.js             # Electron main process: window + ipcMain fs handlers
├── preload.js          # contextBridge bridge exposing window.planner
├── index.html          # Markup: header, dashboard, planner, modal
├── app.js              # Renderer logic (vanilla JS)
├── style.css           # Styles
├── start.command       # Double-click launcher for running from source
├── package.json        # Scripts + electron-builder config
├── homebrew/
│   └── semester-planner.rb   # Homebrew formula template
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

1. Bump `version` in `package.json`.
2. `npm run build:mac` to produce the `.dmg` and `.zip` in `dist/`.
3. Create a GitHub Release (e.g. tag `v1.0.0`) and attach both artifacts.

## Install via Homebrew (tap)

A formula template lives at [`homebrew/semester-planner.rb`](homebrew/semester-planner.rb).
It has no `depends_on "node"` — the packaged Electron app bundles its own Node
runtime. To publish it as a tap so others can `brew install` the app:

1. Create a repo named **`homebrew-tap`** on your GitHub account (the
   `homebrew-` prefix is what makes it a tap).

2. Fill in the formula's three placeholders from your release:

   ```ruby
   version "1.0.0"
   url "https://github.com/masprime77/semester-planner/releases/download/v1.0.0/Semester-Planner-1.0.0-mac.zip"
   sha256 "<output of: shasum -a 256 Semester-Planner-1.0.0-mac.zip>"
   ```

3. Commit it to the tap repo under `Formula/semester-planner.rb` and push.

4. Anyone can then install with:

   ```bash
   brew tap masprime77/tap
   brew install semester-planner
   ```

   On install, the formula prints where the app was placed and how to symlink it
   into `/Applications`, plus the location of your semester data
   (`~/Library/Application Support/Semester Planner/semesters/`), which is kept
   separate from the app so it survives upgrades and uninstalls.

## License

MIT
