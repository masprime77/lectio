---
## What's new in v1.8.5

A diagnostic release for the macOS auto-update issue, where pressing **Install & Relaunch** doesn't restart the app. It adds proper logging and in-app error reporting so we can capture the exact reason the macOS install/relaunch fails.

### Diagnostics
- `electron-log` is now wired in as the auto-updater's logger, so the underlying Squirrel.Mac / ShipIt errors are written to a log file: `~/Library/Logs/Lectio/main.log` on macOS, `%APPDATA%\Lectio\logs\main.log` on Windows.
- The update dialog now shows auto-update errors inline ("Update failed: …") and re-enables its buttons, instead of leaving a dead button when an install or relaunch fails.

> **How to help verify:** install this build, then when a newer release prompts you to update, press **Install & Relaunch**. If it fails on macOS, the dialog will show the reason — and the full error is in `~/Library/Logs/Lectio/main.log`. Send that along.

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
  git tag v1.8.5
  git push origin v1.8.5

The release.yml workflow will then run CI and, if it passes, build and
publish the macOS (.dmg + .zip + latest-mac.yml) and Windows (.exe + .zip +
latest.yml) assets to a new GitHub Release for the v1.8.5 tag. Once the
draft release appears in GitHub, paste the content of docs/GITHUB_RELEASE.md
into the description field and publish it to make the download links live.

After publishing, update the Homebrew cask:

  homebrew/sync-tap.sh
-->
