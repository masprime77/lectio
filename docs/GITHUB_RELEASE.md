---
## What's new in v1.8.1

This release reworks how Lectio tells you about updates. Instead of a thin banner, a new update dialog shows the release notes for the version you're about to get and a live download progress bar — and the install now relaunches reliably on both macOS and Windows.

### Update experience
- The auto-update banner is replaced by a modal dialog that opens when an update is available, shows the GitHub Release notes for the new version, and renders a download progress bar.
- With auto-update off, the dialog lets you start the download yourself via **Download & Install**; with it on, the download runs in the background and the progress bar appears right away. Once the download finishes, the primary button becomes **Install & Relaunch**.

### Fixes
- `quitAndInstall` now passes `isSilent` + `isForceRunAfter`, so the update reliably relaunches on macOS and skips the NSIS re-install wizard on Windows.
- Exposed the `update-download-progress` and `start-update-download` IPC channels plus `onDownloadProgress`/`startDownload` on the `window.updater` bridge.

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
  git tag v1.8.1
  git push origin v1.8.1

The release.yml workflow will then run CI and, if it passes, build and
publish the macOS (.dmg + .zip + latest-mac.yml) and Windows (.exe + .zip +
latest.yml) assets to a new GitHub Release for the v1.8.1 tag. Once the
draft release appears in GitHub, paste the content of docs/GITHUB_RELEASE.md
into the description field and publish it to make the download links live.

After publishing, update the Homebrew cask:

  homebrew/sync-tap.sh
-->
