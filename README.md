# Semester Planner

A minimal, framework-free web app for planning a university semester. Track
readings and tasks per course, per week, with click-to-cycle status badges and
per-course progress bars. Each semester is a plain JSON file — there's no
database. A tiny Express server reads and writes those files.

![Vanilla JS](https://img.shields.io/badge/frontend-vanilla%20JS-yellow)
![Express](https://img.shields.io/badge/server-express-green)

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

## Install

Requires [Node.js](https://nodejs.org) (v18+).

```bash
npm install
```

## Run

```bash
npm start
```

Then open <http://localhost:3000>. Changes are saved automatically to the
selected semester's JSON file in `semesters/`.

## Project structure

```
semester_planner/
├── index.html          # Markup: header, dashboard, planner, modal
├── app.js              # All client logic (vanilla JS)
├── style.css           # Styles
├── server.js           # Express server (~50 lines)
├── package.json
├── semesters/
│   └── example.json    # Example semester with sample data
└── README.md
```

## API

| Method | Route                  | Description                     |
| ------ | ---------------------- | ------------------------------- |
| GET    | `/api/semesters`       | List all semester files         |
| GET    | `/api/semesters/:id`   | Load a semester JSON            |
| PUT    | `/api/semesters/:id`   | Save (or create) a semester     |
| DELETE | `/api/semesters/:id`   | Delete a semester file          |

`:id` is the filename without the `.json` extension and must match
`[A-Za-z0-9_-]+` (this guards against path traversal).

## Adding a semester manually

Create a new file in `semesters/`, e.g. `semesters/ws2025.json`. The filename
(without `.json`) is the semester's id used in the API. Follow this schema:

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

Restart isn't required — the file list is read on each request, so a new file
shows up in the selector after a page refresh.

## Deploy read-only to GitHub Pages

GitHub Pages serves static files only — there's no Node server, so the `PUT`
save endpoint won't exist. You can still publish a **read-only** view of your
semesters with a small workaround.

The frontend talks to the server through the `api` object in `app.js`. For a
static deployment, point it at the JSON files directly and make saving a no-op:

1. Copy your semester files into a `semesters/` folder at the site root (they're
   already there) and create a static manifest the page can fetch instead of
   the live `/api/semesters` listing — e.g. `semesters/index.json`:

   ```json
   [{ "id": "example", "name": "Summer Semester 2025" }]
   ```

2. In `app.js`, swap the `api` implementation for a static version:

   ```js
   const api = {
     list: () => fetch('semesters/index.json').then((r) => r.json()),
     load: (id) => fetch(`semesters/${id}.json`).then((r) => r.json()),
     // No backend on GitHub Pages — saving/deleting are disabled (read-only).
     save: () => Promise.resolve({ ok: false, readonly: true }),
     remove: () => Promise.resolve({ ok: false, readonly: true }),
   };
   ```

   Status cycling and edits still update the in-memory view, but nothing is
   persisted. To keep your data in sync, edit the JSON files locally (or via the
   running server), then commit and push them.

3. Push to a `gh-pages` branch (or enable Pages on `main`):

   ```bash
   git subtree push --prefix . origin gh-pages   # or use the Pages settings UI
   ```

4. In your repo's **Settings → Pages**, choose the branch to serve from. Your
   read-only planner will be available at
   `https://<username>.github.io/semester-planner/`.

**Export/import workflow:** treat the JSON files as your portable export. Run
the app locally to edit, commit the updated `semesters/*.json`, and push — the
GitHub Pages site reflects the committed files on its next build.

## License

MIT
