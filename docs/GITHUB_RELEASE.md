---
## What's new in v1.6.2

This is a patch release that fixes two regressions introduced by the v1.6.0 header redesign.

### Header logo now appears
The small rounded logo next to the "Lectio" wordmark was missing in the packaged app because `assets/icon.png` was not included in the electron-builder bundle. It is now bundled correctly and renders in both development and the distributed app.

### Window is draggable again
Hiding the native title bar with `hiddenInset` left no drag region — every pixel of the header belonged to a button or select, making the window impossible to move. The header is now a native drag region, with interactive controls explicitly opted out so clicks still work normally.
---
**Full changelog:** [`docs/RELEASE_NOTES.md`](docs/RELEASE_NOTES.md)

**macOS:** download `Lectio-arm64.dmg` below → drag to Applications.**Windows:** download `Lectio-Setup.exe` below → Next → Next → Install.**Homebrew:** `brew tap masprime77/tap && brew install --cask lectio`

> First launch on macOS: right-click → Open (Gatekeeper), or run `xattr -cr /Applications/Lectio.app` in Terminal.
> First launch on Windows: click **More info → Run anyway** (SmartScreen).

---

<!--
AFTER THE PR IS MERGED — what to run

After merging the PR into main:

  git checkout main
  git pull origin main
  git tag v1.6.1
  git push origin v1.6.1

The release.yml workflow will then run CI and, if it passes, build and
publish the macOS (.dmg + .zip + latest-mac.yml) and Windows (.exe + .zip +
latest.yml) assets to a new GitHub Release for the v1.6.1 tag. Once the
draft release appears in GitHub, paste the content of docs/GITHUB_RELEASE.md
into the description field and publish it to make the download links live.

After publishing, update the Homebrew cask:

  homebrew/sync-tap.sh
-->
