'use strict';
// electron-builder afterSign hook.
//
// Notarizes the macOS app only when APPLE_TEAM_ID is present in the
// environment. Without it (the common case for local / unsigned CI builds),
// this is a silent no-op: the unsigned app still works — the user just needs to
// right-click → Open on first launch (see the README "First launch" note).
exports.default = async function afterSign(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') return;

  const teamId = process.env.APPLE_TEAM_ID;
  if (!teamId) return; // No credentials → skip signing/notarization silently.

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  // Lazy-require so @electron/notarize is only needed when actually notarizing.
  const { notarize } = require('@electron/notarize');
  await notarize({
    teamId,
    appBundleId: context.packager.appInfo.id,
    appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_ID_PASSWORD,
  });
};
