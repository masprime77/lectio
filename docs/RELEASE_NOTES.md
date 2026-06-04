## v1.8.7

_Released: 2026-06-04_

- Fixed macOS auto-update for real. Diagnostics in v1.8.5 confirmed Squirrel.Mac rejected every update because ad-hoc signing gives each build a different designated requirement (`code failed to satisfy specified code requirement(s)`). Builds are now signed with a **persistent self-signed code-signing certificate**, which produces a stable designated requirement (`identifier "com.masprime77.lectio" and certificate leaf = H"…"`), so macOS auto-update installs and relaunches correctly between self-signed builds.
- Added `build/afterPack.js` self-signed signing (env `MAC_SIGN_IDENTITY`, falling back to ad-hoc), a CI keychain-import step in the release workflow (driven by the `MAC_CSC_P12_BASE64` / `MAC_CSC_PASSWORD` secrets), the `scripts/gen-macos-signing-cert.sh` certificate generator, and `docs/MACOS_SIGNING.md`.
- Note: this is not Apple notarization, so the first-launch Gatekeeper prompt remains (handled by the cask / right-click → Open). Updating *into* this first signed build from an older ad-hoc copy still requires a one-time manual reinstall; auto-update works for every release after it.

## v1.8.6

_Released: 2026-06-04_

- Test release with no functional changes. It exists as a newer version to update *into* from v1.8.5, so the v1.8.5 diagnostics (electron-log + inline error surfacing) can capture the exact reason the macOS install/relaunch fails.

## v1.8.5

_Released: 2026-06-04_

- Diagnostic release for the macOS auto-update failure. Added `electron-log` as the `autoUpdater` logger, so the underlying Squirrel.Mac / ShipIt errors are written to `~/Library/Logs/Lectio/main.log` (macOS) / `%APPDATA%\Lectio\logs\main.log` (Windows).
- The update dialog now surfaces auto-update errors inline ("Update failed: …") and re-enables its buttons, instead of leaving a dead "Install & Relaunch" button when an install/relaunch fails.

## v1.8.4

_Released: 2026-06-04_

- Test release that ships no functional changes. Its purpose is to verify the v1.8.3 macOS auto-update fix end-to-end against a real newer release: updating from v1.8.3 should now surface the update dialog, download via the progress bar, and reliably relaunch into v1.8.4 on macOS (and continue to work on Windows).

## v1.8.3

_Released: 2026-06-04_

- Fixed the macOS auto-update never relaunching or applying: `quitAndInstall` closes all windows and calls `app.quit()`, but the unsaved-changes `before-quit` handler could `preventDefault()` and cancel that quit, so Squirrel never swapped the app. The `restart-and-update` handler now allows that quit through, and the renderer flushes pending edits before triggering it.
- Set `autoInstallOnAppQuit = true` as a safety net: a downloaded update now also installs on the next normal quit, so closing and reopening the app picks up the new version even if the explicit relaunch path fails.

## v1.8.2

_Released: 2026-06-04_

- Test release that ships no functional changes; its purpose is to validate the v1.8.1 update flow end-to-end (the `update-available` dialog, the GitHub Release notes panel, the download progress bar, and the reliable relaunch on macOS and Windows) against a real newer release.

## v1.8.1

_Released: 2026-06-04_

- Replaced the auto-update banner with a modal dialog that opens on `update-available`, shows the GitHub Release notes for the new version, and renders a download progress bar.
- When auto-update is off, the dialog lets the user start the download manually via "Download & Install"; when it is on, the download runs in the background and the progress bar shows immediately. After the download completes the primary button becomes "Install & Relaunch".
- Fixed `quitAndInstall` to pass `isSilent` + `isForceRunAfter`, so the update reliably relaunches on macOS and skips the NSIS re-install wizard on Windows.
- Exposed `update-download-progress` and `start-update-download` IPC channels plus `onDownloadProgress`/`startDownload` on the `window.updater` bridge.

## v1.8.0

_Released: 2026-06-03_

- Added IPC handlers for exporting a single course (`export-course`) and a full semester (`export-semester`) to `.lectio.json` files, and for reading a `.lectio.json` file back (`import-file`).
- Added native save/open file-dialog IPC handlers (`show-save-dialog`, `show-open-dialog`) scoped to the `.lectio.json` extension.
- Exposed the new export/import and dialog methods on `window.planner` in the preload bridge.
- Semester export/import now lives in the edit modal footer instead of the header toolbar; the semester selector keeps only the Edit and Delete buttons.
- Export semester writes the full semester (including tag definitions) to a `.lectio.json` file via a native save dialog.
- Import semester reads a `.lectio.json` file and shows a confirmation modal to keep or reset reading/task statuses and, on an id clash, to replace the existing semester or save it as a new one.
- Added drag-and-drop: dropping a `.lectio.json` file onto the window imports it as a semester or a course.
- Added Edit, Export, Import, and Delete icon buttons to each course-column header in Course view.
- Export course writes a single course (without tags) to a `.lectio.json` file via a native save dialog.
- Import course adds a course from a `.lectio.json` file into the current semester with freshly generated ids.
- The header **New** button now opens the create-semester modal directly (no popover).
- The New/Edit modal footer has tab-aware Import/Export buttons: on the Semester tab, Import brings in a full semester and Export (edit mode only) writes the current one; on the Courses tab, Import adds a course to the semester being built or edited; the Tags tab shows neither, since tags can't be imported/exported yet.
- Importing a course from the Courses tab works in both create mode (adds a draft course row, kept with its readings/tasks on save) and edit mode (adds it to the live semester and refreshes the course list).
- Editing the semester from a course column's pencil button or via "+ Add course" now opens the modal on the Courses tab instead of the Semester tab.
- Docs: rewrote the README Features list to match the v1.7.0 feature set (Breakdown panel, focus mode, bulk collapse controls, custom tags, Study Mode, sort control, inline due-date editing, three-tab semester modal, onboarding tour, in-app feedback, per-OS auto-updates).
- Docs: updated the README Download section to use the `Lectio-Setup.exe` artifact name and added the Homebrew one-line install command.
- Docs: added the `icon:win` and `icons` npm scripts to the README icon-build commands.
- Docs: added user stories US-036–US-046 (custom tags, tag management UI, Study Mode, sort control, focus mode, collapsible weeks, breakdown panel, inline due-date editing, onboarding tour, in-app feedback, Windows platform).
- Docs: appended US-036–US-046 to the traceability matrix, corrected the US-036/US-037/US-038 test references to the real test files (`semester-manager.test.js`, `ipc.test.js`, `progress.test.js`, `status.test.js`), and updated the coverage summary to 12 covered / 6 partial / 28 not covered (46 stories).

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
