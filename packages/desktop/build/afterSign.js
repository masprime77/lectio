'use strict';
// electron-builder afterSign hook.
//
// Notarizes the macOS app based on how many of the five real-signing secrets
// (see REQUIRED_SIGNING_VARS) are present in the environment:
//   - none set: silent no-op — the common case for local / unsigned CI builds.
//     The unsigned/ad-hoc-signed app still works — the user just needs to
//     right-click → Open on first launch (see the README "First launch" note).
//   - some but not all set: electron-builder still calls this hook even when
//     it only ad-hoc-signed the app (its signApp() reports success regardless
//     of whether a real identity was used), so notarizing here would run
//     @electron/notarize's codesign check against an unsigned app and crash
//     with a cryptic "code has no resources but signature indicates they must
//     be present" error. Fail loudly instead, naming what's missing.
//   - all five set: notarize as before.
const REQUIRED_SIGNING_VARS = [
  'CSC_LINK',
  'CSC_KEY_PASSWORD',
  'APPLE_TEAM_ID',
  'APPLE_ID',
  'APPLE_ID_PASSWORD',
];

exports.default = async function afterSign(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') return;

  const present = REQUIRED_SIGNING_VARS.filter((name) => !!process.env[name]);
  if (present.length === 0) return; // No credentials → skip signing/notarization silently.

  const missing = REQUIRED_SIGNING_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `afterSign: partial macOS signing configuration. Present: ${present.join(', ')}. ` +
        `Missing: ${missing.join(', ')}. Real signing + notarization requires all five ` +
        `secrets set together (${REQUIRED_SIGNING_VARS.join(', ')}), or none of them, to ` +
        `use the self-signed/ad-hoc fallback in afterPack.js. See docs/MACOS_SIGNING.md.`
    );
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  // Lazy-require so @electron/notarize is only needed when actually notarizing.
  const { notarize } = require('@electron/notarize');
  await notarize({
    teamId: process.env.APPLE_TEAM_ID,
    appBundleId: context.packager.appInfo.id,
    appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_ID_PASSWORD,
  });
};
