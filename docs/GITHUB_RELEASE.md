---
## What's new in v1.8.8

A test release with no functional changes. It exists purely to verify the macOS auto-update fix from v1.8.7 end-to-end: it's a newer **self-signed** build to update *into* from v1.8.7. Because both are signed with the same persistent certificate, they share the same designated requirement, so Squirrel.Mac should now install the update and relaunch cleanly.

### Notes
- No features or fixes ship here. If you're running the manually-installed **v1.8.7**, updating to v1.8.8 and pressing **Install & Relaunch** should, on macOS, download and relaunch into v1.8.8 — the behaviour that was broken on the ad-hoc path.

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
  git tag v1.8.8
  git push origin v1.8.8

The release.yml workflow will then run CI and, if it passes, build and
publish the macOS (.dmg + .zip + latest-mac.yml) and Windows (.exe + .zip +
latest.yml) assets to a new GitHub Release for the v1.8.8 tag. Once the
draft release appears in GitHub, paste the content of docs/GITHUB_RELEASE.md
into the description field and publish it to make the download links live.

After publishing, update the Homebrew cask:

  homebrew/sync-tap.sh
-->
