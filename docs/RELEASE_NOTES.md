## Unreleased

- Fixed: `packages/desktop/build/afterSign.js` now fails loudly with an
  actionable error when only some of the five macOS signing secrets
  (`CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_TEAM_ID`, `APPLE_ID`,
  `APPLE_ID_PASSWORD`) are configured, instead of silently attempting to
  notarize an unsigned app and crashing with a cryptic codesign error.
- Fixed: with all five signing secrets set, `afterSign.js` now verifies the
  packaged `.app` actually carries the expected `TeamIdentifier` before calling
  `notarize()`, so a failed certificate import (wrong cert type or mismatched
  `.p12` password) fails with a specific, actionable error instead of crashing
  inside `@electron/notarize`'s codesign check.
- Fixed: the macOS release job never actually signed the app when the Developer
  ID secrets were configured. `.github/workflows/release.yml` pinned
  `CSC_IDENTITY_AUTO_DISCOVERY=false`, which disables electron-builder's macOS
  signing outright (not just its keychain search) and wins over `CSC_LINK`,
  while `afterPack.js` skips signing whenever `CSC_LINK`/`APPLE_TEAM_ID` are
  set — so neither path signed and an ad-hoc bundle reached `afterSign`. The
  flag is now set to `false` only on the free/self-signed path, and the
  self-signed certificate import is skipped when `CSC_LINK` is configured (its
  keychain became the default and could shadow the Developer ID identity).
- Fixed: disabled electron-builder's built-in macOS notarization
  (`"notarize": false` in the desktop `package.json`'s `build.mac` block). It
  activates whenever `APPLE_ID` is set and demands the password in
  `APPLE_APP_SPECIFIC_PASSWORD` rather than the `APPLE_ID_PASSWORD` the
  `afterSign.js` hook uses, failing the build; with signing previously being
  skipped, the release never got far enough to hit it. `afterSign.js` is now the
  single notarization path.
- Fixed: `packages/desktop/scripts/bundle-deps.js` now invokes `npm ls` through
  a shell (`execSync` with a fixed command string) instead of spawning the
  binary directly, fixing two consecutive `prebuild:win` failures on Windows —
  `spawnSync npm ENOENT` (npm on PATH is the `npm.cmd` shim) and then
  `spawnSync npm.cmd EINVAL` (since Node's CVE-2024-27980 hardening, spawning a
  `.cmd`/`.bat` without a shell is refused outright).

## v1.0.0

_Released: 2026-08-08_

- Official 1.0.0 public launch of Lectio.
- Archived the pre-1.0 development history (tags v1.0.0–v1.9.0) to
  `docs/CHANGELOG_PRE_LAUNCH.md`.
- Reset `version` to `1.0.0` in both the root `package.json` and
  `packages/desktop/package.json` ahead of the public launch.
- Rewrote `docs/GITHUB_RELEASE.md` as the v1.0.0 release description.
