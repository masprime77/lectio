---
## What's new in v1.8.3

This release fixes the macOS auto-update introduced in v1.8.1/v1.8.2, where clicking **Install & Relaunch** would not restart into the new version — and a plain close + reopen wouldn't apply the update either. Windows was unaffected.

### Fixes
- macOS updates now install and relaunch reliably. `quitAndInstall` works by closing all windows and quitting the app; the unsaved-changes prompt could cancel that quit, so Squirrel never swapped the app. The update path now lets the quit through and flushes any pending edits first, so nothing is lost.
- Added a safety net: a downloaded update also installs on the next normal quit, so closing and reopening the app picks up the new version even if the immediate relaunch ever fails.

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
  git tag v1.8.3
  git push origin v1.8.3

The release.yml workflow will then run CI and, if it passes, build and
publish the macOS (.dmg + .zip + latest-mac.yml) and Windows (.exe + .zip +
latest.yml) assets to a new GitHub Release for the v1.8.3 tag. Once the
draft release appears in GitHub, paste the content of docs/GITHUB_RELEASE.md
into the description field and publish it to make the download links live.

After publishing, update the Homebrew cask:

  homebrew/sync-tap.sh
-->
