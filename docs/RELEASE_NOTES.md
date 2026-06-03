## Unreleased

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
