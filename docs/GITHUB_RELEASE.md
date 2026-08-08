---
## What's new in v1.0.0

### Highlights
- **Two layouts** — Weekly view and All Courses, with collapsible weeks, per-course progress bars, and a focus mode that centers and widens one course.
- **Custom tag system** — define your own reading and task tags, grouped into Pending and Done sections, with drag-to-reorder and full customization.
- **Pomodoro study timer** — start a focus timer for any course from desktop or mobile; studied time is credited automatically and shown on the dashboard.
- **Inline editing everywhere** — rename, delete, and add readings/tasks in place, including inline due-date editing.
- **Autosave & manual save** — every change autosaves with a Saving/Saved indicator, plus ⌘S/Ctrl+S and a save-before-quit safeguard.
- **Onboarding tour, theming, and auto-updates** — a guided first-run tour, Light/Dark/Auto theme, and background auto-updates via GitHub Releases.

This is the official 1.0.0 public launch — prior v1.x tags were internal development and test builds (see `docs/CHANGELOG_PRE_LAUNCH.md`).

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

NOTE (one-time only): v1.0.0 already exists as a tag from early dev
history. Before tagging, delete the old tag first:
  git push origin :refs/tags/v1.0.0
  git tag -d v1.0.0
Then proceed with the tag/push commands below as normal. This note only
applies to this specific relaunch and should be removed from this file
once the v1.0.0 release is published (i.e., do not carry it forward into
future GITHUB_RELEASE.md rewrites).

  git tag v1.0.0
  git push origin v1.0.0

The release.yml workflow will then run CI and, if it passes, build and
publish the macOS (.dmg + .zip + latest-mac.yml) and Windows (.exe + .zip +
latest.yml) assets to a new GitHub Release for the v1.0.0 tag. Once the
draft release appears in GitHub, paste the content of docs/GITHUB_RELEASE.md
into the description field and publish it to make the download links live.

After publishing, update the Homebrew cask:

  homebrew/sync-tap.sh
-->
