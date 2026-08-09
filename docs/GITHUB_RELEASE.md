## What's new in v1.0.0

### Highlights
- **Two layouts** — Weekly view and All Courses, with collapsible weeks, per-course progress bars, and a focus mode that centers and widens one course.
- **Custom tag system** — define your own reading and task tags, grouped into Pending and Done sections, with drag-to-reorder and full customization.
- **Pomodoro study timer** — start a focus timer for any course from desktop or mobile; studied time is credited automatically and shown on the dashboard.
- **Inline editing everywhere** — rename, delete, and add readings/tasks in place, including inline due-date editing.
- **Autosave & manual save** — every change autosaves with a Saving/Saved indicator, plus ⌘S/Ctrl+S and a save-before-quit safeguard.
- **Onboarding tour, theming, and auto-updates** — a guided first-run tour, Light/Dark/Auto theme, and background auto-updates via GitHub Releases.
- **Signed and notarized on macOS** — builds are signed with an Apple Developer ID certificate and notarized by Apple, so they open normally with no Gatekeeper warning and no Terminal workaround.

This is the official 1.0.0 public launch — prior v1.x tags were internal development and test builds (see `docs/CHANGELOG_PRE_LAUNCH.md`).

---

### Install

**macOS (Apple Silicon):** download `Lectio-arm64.dmg` below → drag to Applications.
**Windows:** download `Lectio-Setup.exe` below → Next → Next → Install.
**Homebrew:** `brew tap masprime77/tap && brew install --cask lectio`

> **Updating from an earlier build?** This is the first notarized release, so its signature doesn't match what older copies expect — existing installs can't auto-update into it. Install this one manually once; auto-updates work normally from here on.

> **Windows first launch:** SmartScreen may warn you, since the Windows build isn't code-signed. Click **More info → Run anyway** — once only.

> **Intel Macs:** not supported yet. The macOS build is Apple Silicon (arm64) only.

**Full changelog:** [`docs/RELEASE_NOTES.md`](docs/RELEASE_NOTES.md)

<!--
Publishing checklist

1. Paste everything above (down to the "Full changelog" line) into the
   GitHub Release description for the v1.0.0 tag, then publish the draft to
   make the download links live.
2. Update the Homebrew cask:

     homebrew/sync-tap.sh

Assets the release workflow attaches: Lectio-arm64.dmg (+ .blockmap),
Lectio-1.0.0-arm64-mac.zip (+ .blockmap), latest-mac.yml, Lectio-Setup.exe
(+ .blockmap), Lectio-1.0.0-win.zip, latest.yml. The two latest*.yml files
drive electron-updater and must stay attached.
-->
