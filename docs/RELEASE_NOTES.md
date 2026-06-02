## Unreleased

- Week sections inside each course column (All Courses view) are now collapsible via a chevron toggle; the current week is expanded by default and all others are collapsed, with each section's open/closed state persisted while navigating.
- Course view columns now render at a uniform fixed width (300px) regardless of course name length.
- Long course names are truncated with an ellipsis and reveal the full name via a native tooltip on hover.
- Renamed the header view toggle labels: "Week view" → "Weekly view" and "Course view" → "All Courses" (internal view values unchanged).
- Added a focused single-course mode: clicking a course name in the progress bar isolates that course's column (centred, wider) and dims the other progress rows; clicking it again restores the normal layout.
- Focused mode can also be exited by clicking the empty space around the column or pressing the Esc key.
