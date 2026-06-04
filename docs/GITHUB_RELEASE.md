---
## What's new in v1.8.4

A test release with no functional changes. It exists to validate the macOS auto-update fix shipped in v1.8.3, running against a real, newer release: updating **from v1.8.3** should surface the update dialog, download via the progress bar, and reliably relaunch into v1.8.4 on macOS — the behaviour that was broken before v1.8.3.

### Notes
- No features or fixes ship here. If you're on v1.8.3, updating to v1.8.4 should show the update dialog, download, and relaunch cleanly into the new version on both macOS and Windows.

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
  git tag v1.8.4
  git push origin v1.8.4

The release.yml workflow will then run CI and, if it passes, build and
publish the macOS (.dmg + .zip + latest-mac.yml) and Windows (.exe + .zip +
latest.yml) assets to a new GitHub Release for the v1.8.4 tag. Once the
draft release appears in GitHub, paste the content of docs/GITHUB_RELEASE.md
into the description field and publish it to make the download links live.

After publishing, update the Homebrew cask:

  homebrew/sync-tap.sh
-->
