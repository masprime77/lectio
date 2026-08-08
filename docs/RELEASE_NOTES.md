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
