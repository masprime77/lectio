## Unreleased

- Fixed: `packages/desktop/build/afterSign.js` now fails loudly with an
  actionable error when only some of the five macOS signing secrets
  (`CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_TEAM_ID`, `APPLE_ID`,
  `APPLE_ID_PASSWORD`) are configured, instead of silently attempting to
  notarize an unsigned app and crashing with a cryptic codesign error.

## v1.0.0

_Released: 2026-08-08_

- Official 1.0.0 public launch of Lectio.
- Archived the pre-1.0 development history (tags v1.0.0–v1.9.0) to
  `docs/CHANGELOG_PRE_LAUNCH.md`.
- Reset `version` to `1.0.0` in both the root `package.json` and
  `packages/desktop/package.json` ahead of the public launch.
- Rewrote `docs/GITHUB_RELEASE.md` as the v1.0.0 release description.
