---
## What's new in v1.8.0

This release is all about moving your data between files. You can now export and import whole semesters or individual courses as `.lectio.json` files — from the New/Edit modal, from per-course buttons in All Courses view, or by dragging a file onto the window.

### Import & export
- Export a full semester (including its tag definitions) to a `.lectio.json` file via a native save dialog.
- Export a single course (without tags) to a `.lectio.json` file via a native save dialog.
- Import a semester from a `.lectio.json` file, with a confirmation modal to keep or reset reading/task statuses and, on an id clash, to replace the existing semester or save it as a new one.
- Import a course from a `.lectio.json` file into the current semester with freshly generated ids.
- Drag and drop a `.lectio.json` file onto the window to import it as a semester or a course.

### Where import/export lives
- Semester import/export now lives in the New/Edit modal footer instead of the header toolbar; the semester selector keeps only the Edit and Delete buttons.
- The New/Edit modal footer has tab-aware Import/Export buttons: the Semester tab imports a full semester and (in edit mode) exports the current one; the Courses tab imports a course into the semester being built or edited; the Tags tab shows neither, since tags can't be imported/exported yet.
- Importing a course from the Courses tab works in both create mode (adds a draft course row, kept with its readings/tasks on save) and edit mode (adds it to the live semester and refreshes the course list).
- Each course-column header in All Courses view gains Edit, Export, Import, and Delete icon buttons.
- The header **New** button now opens the create-semester modal directly (no popover).
- Editing the semester from a course column's pencil button or via "+ Add course" now opens the modal on the Courses tab.

### Docs
- Synced the README and user stories to the shipped v1.8.0 feature set and added user stories US-036–US-046 with corrected test references and coverage totals.

---
**Full changelog:** [`docs/RELEASE_NOTES.md`](docs/RELEASE_NOTES.md)

**macOS:** download `Lectio-arm64.dmg` below → drag to Applications.
**Windows:** download `Lectio-Setup.exe` below → Next → Next → Install.
**Homebrew:** `brew tap masprime77/tap && brew install --cask lectio`

> First launch on macOS: right-click → Open (Gatekeeper), or run `xattr -cr /Applications/Lectio.app` in Terminal.
> First launch on Windows: click **More info → Run anyway** (SmartScreen).

---

<!--
AFTER THE PR IS MERGED — what to run

After merging the PR into main:

  git checkout main
  git pull origin main
  git tag v1.8.0
  git push origin v1.8.0

The release.yml workflow will then run CI and, if it passes, build and
publish the macOS (.dmg + .zip + latest-mac.yml) and Windows (.exe + .zip +
latest.yml) assets to a new GitHub Release for the v1.8.0 tag. Once the
draft release appears in GitHub, paste the content of docs/GITHUB_RELEASE.md
into the description field and publish it to make the download links live.

After publishing, update the Homebrew cask:

  homebrew/sync-tap.sh
-->
