# User Stories

Feature-level user stories for Semester Planner, with acceptance criteria and
links to the automated tests that cover them. UI-only behaviours (rendering,
DOM interaction, theming) are validated manually and noted as such; the
extracted core logic in `lib/` is covered by the Vitest suite under `tests/`.

Test references use the form `file › test name`.

---

## Semester management

**US-001 — Create a new semester**
- As a student, I want to create a new semester with a name, start date, week
  count, and courses so that I can start planning a term.
- Acceptance criteria:
  - [ ] The modal collects name, start date, number of weeks, and course rows.
  - [ ] A new JSON file is written with a unique id derived from the name.
  - [ ] The new semester becomes the selected one after creation.
- Linked tests: `tests/unit/semester-manager.test.js › save-semester writes the correct data`; `tests/integration/ipc.test.js › save-semester followed by get-semester returns the same data`

**US-002 — Edit an existing semester**
- As a student, I want to edit a semester's details so that I can fix mistakes
  without losing my readings and tasks.
- Acceptance criteria:
  - [ ] The modal opens pre-filled with the current name, date, weeks, courses.
  - [ ] Saving overwrites the same file.
  - [ ] Existing courses keep their readings and tasks.
- Linked tests: `tests/unit/semester.test.js › editing a course name updates only that course` (course-edit semantics; full modal preserve flow verified manually)

**US-003 — Delete a semester**
- As a student, I want to delete a semester so that old terms don't clutter the
  selector.
- Acceptance criteria:
  - [ ] A confirmation is required before deletion.
  - [ ] The JSON file is removed from the semesters folder.
  - [ ] The app falls back to another semester (or an empty state).
- Linked tests: `tests/unit/semester-manager.test.js › delete-semester removes the file`; `tests/integration/ipc.test.js › delete-semester followed by get-semester throws a not-found error`

**US-004 — Switch between semesters**
- As a student, I want to switch semesters from a dropdown so that I can view a
  different term.
- Acceptance criteria:
  - [ ] The selector lists every `.json` file in the semesters folder.
  - [ ] Selecting one loads and renders its data.
- Linked tests: `tests/unit/semester-manager.test.js › list-semesters returns only .json files`; `tests/unit/semester-manager.test.js › get-semester returns parsed JSON`

---

## Courses

**US-005 — Add a course to a semester**
- As a student, I want to add a course so that I can track its readings/tasks.
- Acceptance criteria:
  - [ ] A new course is appended with a unique id.
  - [ ] The course starts with empty readings and tasks.
- Linked tests: `tests/unit/semester.test.js › adding a course generates a unique id`

**US-006 — Edit a course name and color**
- As a student, I want to rename a course and change its accent color so that I
  can keep it recognizable.
- Acceptance criteria:
  - [ ] Editing a course's name updates only that course.
  - [ ] The chosen color is applied as the card/column accent. *(manual)*
- Linked tests: `tests/unit/semester.test.js › editing a course name updates only that course`

**US-007 — Delete a course**
- As a student, I want to remove a course so that dropped courses disappear.
- Acceptance criteria:
  - [ ] The course is removed from the list.
  - [ ] Deleting a non-existent course is a safe no-op.
- Linked tests: `tests/unit/semester.test.js › deleting a course removes it from the list`; `tests/unit/semester.test.js › deleting a course that does not exist is a no-op`

---

## Readings

**US-008 — Add a reading to a course in a specific week**
- As a student, I want to add a reading under a course for a given week so that I
  can plan my reading load.
- Acceptance criteria:
  - [ ] The add row creates a reading with status `pending` in that week.
- Linked tests: _none (UI add-row flow; verified manually)_

**US-009 — Edit a reading title**
- As a student, I want to rename a reading inline so that I can correct it.
- Acceptance criteria:
  - [ ] Clicking the title turns it into an editable field; Enter saves.
- Linked tests: _none (UI inline-edit; verified manually)_

**US-010 — Delete a reading**
- As a student, I want to delete a reading so that removed items disappear.
- Acceptance criteria:
  - [ ] The `×` button removes the reading and persists the change.
- Linked tests: _none (UI delete; verified manually)_

**US-011 — Cycle reading status (pending → seen → summarized → studied)**
- As a student, I want to click a reading's badge to advance its status so that I
  can track study progress quickly.
- Acceptance criteria:
  - [ ] Clicking cycles pending → seen → summarized → studied → pending.
  - [ ] An unknown status resets to `pending`.
- Linked tests: `tests/unit/status.test.js › cycles pending → seen → summarized → studied → pending`; `tests/unit/status.test.js › defaults back to the first status of the cycle`

---

## Tasks

**US-012 — Add a task to a course in a specific week**
- As a student, I want to add a task with an optional due date so that I can
  track deliverables.
- Acceptance criteria:
  - [ ] The add row creates a task with status `not done` in that week.
- Linked tests: _none (UI add-row flow; verified manually)_

**US-013 — Edit a task title and due date**
- As a student, I want to rename a task and set its due date so that I can keep
  deadlines accurate.
- Acceptance criteria:
  - [ ] The title is editable inline; the due date shows next to the task.
- Linked tests: _none (UI inline-edit; verified manually)_

**US-014 — Delete a task**
- As a student, I want to delete a task so that removed items disappear.
- Acceptance criteria:
  - [ ] The `×` button removes the task and persists the change.
- Linked tests: _none (UI delete; verified manually)_

**US-015 — Cycle task status (not done → done → reviewed)**
- As a student, I want to click a task's badge to advance its status so that I can
  track completion.
- Acceptance criteria:
  - [ ] Clicking cycles not done → done → reviewed → not done.
  - [ ] An unknown status resets to `not done`.
- Linked tests: `tests/unit/status.test.js › cycles not done → done → reviewed → not done`; `tests/unit/status.test.js › defaults back to the first status of the cycle`

---

## Views

**US-016 — Switch between week view and course column view**
- As a student, I want to toggle layouts so that I can see my plan by week or by
  course.
- Acceptance criteria:
  - [ ] A header toggle switches between the two layouts.
  - [ ] The choice is saved to `localStorage`.
- Linked tests: _none (UI layout/localStorage; verified manually)_

**US-017 — Collapse and expand a week in week view**
- As a student, I want to collapse weeks so that I can focus on one at a time.
- Acceptance criteria:
  - [ ] Clicking a week header toggles its body open/closed.
- Linked tests: _none (UI interaction; verified manually)_

**US-018 — Current week is auto-expanded on load**
- As a student, I want the current week expanded on load so that today's work is
  visible immediately.
- Acceptance criteria:
  - [ ] On load, the week matching today's date is open; others are collapsed.
- Linked tests: _none (date-derived UI state; verified manually)_

---

## Progress

**US-019 — Progress bar updates when a reading status changes**
- As a student, I want the course progress to reflect studied readings so that I
  can gauge how far along I am.
- Acceptance criteria:
  - [ ] Readings marked `studied` count toward the percentage.
- Linked tests: `tests/unit/progress.test.js › calculates correctly when some readings are studied`

**US-020 — Progress bar updates when a task status changes**
- As a student, I want the progress to reflect completed tasks so that finished
  work shows up.
- Acceptance criteria:
  - [ ] Tasks marked `done` or `reviewed` count toward the percentage.
- Linked tests: `tests/unit/progress.test.js › calculates correctly when all tasks are done or reviewed`; `tests/unit/progress.test.js › calculates the combined progress of mixed readings and tasks`

**US-021 — Progress shows 0% when no items exist**
- As a student, I want an empty course to read 0% so that the bar isn't
  misleading.
- Acceptance criteria:
  - [ ] A course with no readings and no tasks reports 0%.
- Linked tests: `tests/unit/progress.test.js › returns 0% for a course with no items`

---

## Theme

**US-022 — Switch to light mode**
- As a user, I want to force light mode so that the app stays light regardless of
  the system theme.
- Acceptance criteria:
  - [ ] Selecting Light sets `data-theme="light"`.
- Linked tests: _none (UI theme; verified manually)_

**US-023 — Switch to dark mode**
- As a user, I want to force dark mode so that the app stays dark regardless of
  the system theme.
- Acceptance criteria:
  - [ ] Selecting Dark sets `data-theme="dark"`.
- Linked tests: _none (UI theme; verified manually)_

**US-024 — Auto mode follows system preference**
- As a user, I want Auto mode to match my OS theme and update live when it
  changes.
- Acceptance criteria:
  - [ ] Auto removes `data-theme`; `prefers-color-scheme` drives the colors.
- Linked tests: _none (UI/media query; verified manually)_

**US-025 — Selected theme persists after reload**
- As a user, I want my theme choice remembered so that I don't reset it each
  launch.
- Acceptance criteria:
  - [ ] The choice is saved to `localStorage` and applied before first paint.
- Linked tests: _none (persistence/UI; verified manually)_

---

## Data persistence

**US-026 — All changes persist after closing and reopening the app**
- As a student, I want my edits saved to disk so that they survive restarts.
- Acceptance criteria:
  - [ ] Saving a semester writes its JSON; reloading returns the same data.
- Linked tests: `tests/integration/ipc.test.js › save-semester followed by get-semester returns the same data`; `tests/unit/semester-manager.test.js › save-semester writes the correct data`

**US-027 — First launch copies example.json to the user data folder**
- As a new user, I want starter data on first launch so that the app isn't empty.
- Acceptance criteria:
  - [ ] In a packaged app, an empty user data folder is seeded from the bundled
        `example.json`.
- Linked tests: _none (Electron `app`-coupled seeding; verified manually)_

---

## Distribution

**US-028 — App builds successfully with `npm run build:mac`**
- As a maintainer, I want a one-command build so that I can produce a shareable
  installer.
- Acceptance criteria:
  - [ ] `npm run build:mac` produces a `.dmg` and a `.zip` in `dist/`.
  - [ ] The release workflow runs the build only after CI passes.
- Linked tests: _none (build step; gated by CI in `release.yml`)_

**US-029 — Installed app opens without a terminal or browser**
- As a user, I want to launch the app by double-clicking so that I don't need a
  terminal or `localhost`.
- Acceptance criteria:
  - [ ] The `.app` opens a native window directly.
- Linked tests: _none (packaged-app behaviour; verified manually)_

---

## Traceability matrix

| Story  | Feature area        | Linked test file(s)                          | Status        |
| ------ | ------------------- | -------------------------------------------- | ------------- |
| US-001 | Semester management | semester-manager.test.js, ipc.test.js        | covered       |
| US-002 | Semester management | semester.test.js                             | partial       |
| US-003 | Semester management | semester-manager.test.js, ipc.test.js        | covered       |
| US-004 | Semester management | semester-manager.test.js                     | covered       |
| US-005 | Courses             | semester.test.js                             | covered       |
| US-006 | Courses             | semester.test.js                             | partial       |
| US-007 | Courses             | semester.test.js                             | covered       |
| US-008 | Readings            | —                                            | not covered   |
| US-009 | Readings            | —                                            | not covered   |
| US-010 | Readings            | —                                            | not covered   |
| US-011 | Readings            | status.test.js                               | covered       |
| US-012 | Tasks               | —                                            | not covered   |
| US-013 | Tasks               | —                                            | not covered   |
| US-014 | Tasks               | —                                            | not covered   |
| US-015 | Tasks               | status.test.js                               | covered       |
| US-016 | Views               | —                                            | not covered   |
| US-017 | Views               | —                                            | not covered   |
| US-018 | Views               | —                                            | not covered   |
| US-019 | Progress            | progress.test.js                             | covered       |
| US-020 | Progress            | progress.test.js                             | covered       |
| US-021 | Progress            | progress.test.js                             | covered       |
| US-022 | Theme               | —                                            | not covered   |
| US-023 | Theme               | —                                            | not covered   |
| US-024 | Theme               | —                                            | not covered   |
| US-025 | Theme               | —                                            | not covered   |
| US-026 | Data persistence    | ipc.test.js, semester-manager.test.js        | covered       |
| US-027 | Data persistence    | —                                            | not covered   |
| US-028 | Distribution        | — (gated by CI)                              | not covered   |
| US-029 | Distribution        | —                                            | not covered   |

**Coverage summary:** 12 covered, 2 partial, 15 not covered (UI/packaging
behaviours validated manually). Automated coverage focuses on the pure logic and
filesystem/IPC layers in `lib/`, which the Vitest suite covers at 100% lines and
functions (threshold: 70%).
