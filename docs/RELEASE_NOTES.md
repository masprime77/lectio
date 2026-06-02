## Unreleased

- Week sections inside each course column (All Courses view) are now collapsible via a chevron toggle; the current week is expanded by default and all others are collapsed, with each section's open/closed state persisted while navigating.
- Added header controls to bulk expand all, collapse all, or expand only the current week; the buttons act on whichever layout is active (Weekly view or All Courses view).
- Course view columns now render at a uniform fixed width (300px) regardless of course name length.
- Long course names are truncated with an ellipsis and reveal the full name via a native tooltip on hover.
- Renamed the header view toggle labels: "Week view" → "Weekly view" and "Course view" → "All Courses" (internal view values unchanged).
- Added a focused single-course mode: clicking a course name in the progress bar isolates that course's column (centred, wider) and dims the other progress rows; clicking it again restores the normal layout.
- Focused mode can also be exited by clicking the empty space around the column or pressing the Esc key.
- Added a global "+ Add" button in the header (shown once a semester is loaded) that opens a modal for adding a reading or task to any course and week of the current semester, with a Reading/Task toggle (Task reveals an optional due-date field) and the current week pre-selected.
- Added a header sort control to order courses by progress (↓/↑) or by their earliest week with content (↑/↓); the choice applies to the progress bars, course columns, and week-view cards, and persists across restarts (localStorage). Sorting is non-destructive — the underlying course order on disk is never changed.
- The sort control bakes a "Sort: " prefix into each option label, so the active mode reads as "Sort: <mode>" directly in the select (no separate label element).
- Added alphabetical course sort options (A → Z and Z → A) to the sort control.
- Scoped the progress and alphabetical sorts to the progress bar and All Courses columns only; the Weekly view keeps the original course order for those modes (only week sorts reorder it).
- The Week ↓ sort now also reverses the order of the weeks themselves — weeks render N … 1 in both the Weekly view and inside each All Courses column (Week ↑ stays ascending).
- Week sorts now affect only the order of the weeks (week sections in the Weekly view and within each course column); the progress bar and course-column order fall back to alphabetical (A → Z) instead of ordering courses by their earliest week.
- Replaced the hardcoded reading/task status cycles with a flexible per-semester tag system (data model and core logic): each semester now stores its own `readingTags` and `taskTags`, where every tag has a `section` (`pending`/`done`) that decides whether items count toward course progress. The "pending" and "studied" tags of each kind are protected (cannot be deleted or renamed, but can be recolored). Item statuses now store a tag id rather than a name string.
- Legacy semesters are migrated transparently on load: the default tag sets are added and existing status strings are rewritten to their matching tag ids. (UI for managing tags lands in a later change.)
