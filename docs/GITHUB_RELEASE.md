---
## What's new in v1.8.7

This release fixes macOS auto-update properly. The v1.8.5 diagnostics confirmed the cause: with ad-hoc signing, macOS (Squirrel.Mac) rejected every update because each build had a different code-signing requirement, so **Install & Relaunch** silently did nothing. Builds are now signed with a stable, persistent self-signed certificate, which lets macOS install and relaunch updates correctly.

### Fixes
- macOS auto-update now installs and relaunches between releases. Builds carry a stable code-signing identity, so the new version satisfies the running app's signature requirement instead of being rejected.

### Notes
- This is **not** Apple notarization, so the first-launch Gatekeeper prompt still applies on a fresh download (right-click → Open, or use the Homebrew cask which clears it automatically).
- **Updating into this build from an older copy still needs a one-time manual reinstall** (download the `.dmg` and drag to Applications). Every release *after* this one updates automatically.

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

PREREQUISITE (one time, before tagging): generate the self-signed signing
cert and add the repo secrets, or the macOS build falls back to ad-hoc and
auto-update still won't work:

  scripts/gen-macos-signing-cert.sh
  # then add MAC_CSC_P12_BASE64 and MAC_CSC_PASSWORD as GitHub repo secrets
  # (see docs/MACOS_SIGNING.md)

After merging the PR into main:

  git checkout main
  git pull origin main
  git tag v1.8.7
  git push origin v1.8.7

The release.yml workflow will then run CI and, if it passes, build and
publish the macOS (.dmg + .zip + latest-mac.yml) and Windows (.exe + .zip +
latest.yml) assets to a new GitHub Release for the v1.8.7 tag. Once the
draft release appears in GitHub, paste the content of docs/GITHUB_RELEASE.md
into the description field and publish it to make the download links live.

After publishing, update the Homebrew cask:

  homebrew/sync-tap.sh
-->
