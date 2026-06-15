---
## What's new in v1.9.0

All Courses view gets two improvements for adding readings and tasks.

### Improvements
- **Add to any week.** Each course column now has **+ Reading** / **+ Task** buttons with a **to week** picker at the bottom, so you can add an item to *any* week — including weeks that don't have anything yet — without opening the "+ Add" dialog. Leave the picker on the dash (—) to use the current week.
- **No more scroll jumps.** Adding a reading or task no longer snaps the list back to the top — your scroll position is kept right where it was.

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
  git tag v1.9.0
  git push origin v1.9.0

The release.yml workflow will then run CI and, if it passes, build and
publish the macOS (.dmg + .zip + latest-mac.yml) and Windows (.exe + .zip +
latest.yml) assets to a new GitHub Release for the v1.9.0 tag. Once the
draft release appears in GitHub, paste the content of docs/GITHUB_RELEASE.md
into the description field and publish it to make the download links live.

After publishing, update the Homebrew cask:

  homebrew/sync-tap.sh
-->
