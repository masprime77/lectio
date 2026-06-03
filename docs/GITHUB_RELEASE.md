---
## What's new in v1.7.0

This release sharpens the planner and onboarding experience. You can now break down each course's progress into separate readings/tasks bars, edit a task's due date inline, and get walked through the app by an interactive tour on first run. The semester modal is leaner, and sending feedback no longer leaves the app.

### Planner
- Added a "Breakdown" toggle button to the dashboard header that opens an inline panel splitting each course's progress into separate readings and tasks mini-bars with done/total counts, plus a "Total" summary row for the whole semester; the panel respects the current sort order and Study Mode, and the existing progress bars are unchanged.
- Added inline editing of a task's due date directly in the planner: tasks with a date show a clickable "due YYYY-MM-DD" that opens an inline date picker (committing on blur/Enter, cancelling on Escape, clearing the field removes the date), and tasks without one reveal a "＋ date" affordance on row hover to set one.

### Semester modal
- Removed the "Reading / Task" quick-add tab from the semester modal (the standalone "Add reading / task" modal is unaffected).
- Renamed the semester modal title in create mode from "Create New Semester" to "New".

### Onboarding & feedback
- Added an interactive onboarding tour that auto-launches on first run and can be replayed any time from Settings → Start tour: each step spotlights a real UI element with a cutout, shows a titled tooltip, and supports Back/Next/Skip plus keyboard navigation (arrows, Enter, Escape). Steps live in a single `TUTORIAL_STEPS` array so new features only need an entry there (see `docs/TUTORIAL_STEPS.md`).
- Replaced the feedback flow's GitHub redirect with a direct submission to the Vercel `/api/feedback` endpoint, so feedback is sent without leaving the app or needing a GitHub account; the submit button now shows a "Sending…" state, then an in-modal success confirmation, with inline error recovery on failure.

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
  git tag v1.7.0
  git push origin v1.7.0

The release.yml workflow will then run CI and, if it passes, build and
publish the macOS (.dmg + .zip + latest-mac.yml) and Windows (.exe + .zip +
latest.yml) assets to a new GitHub Release for the v1.7.0 tag. Once the
draft release appears in GitHub, paste the content of docs/GITHUB_RELEASE.md
into the description field and publish it to make the download links live.

After publishing, update the Homebrew cask:

  homebrew/sync-tap.sh
-->
