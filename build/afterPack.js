'use strict';
// electron-builder afterPack hook.
//
// On the free (unsigned) distribution path, electron-builder leaves the app
// bundle's signature unsealed, so a downloaded (quarantined) copy is reported by
// Gatekeeper as "damaged" and won't open. Here we ad-hoc sign the whole bundle,
// producing a VALID signature — Gatekeeper then shows the milder "unidentified
// developer" instead, which users can bypass (right-click → Open, or
// `xattr -dr com.apple.quarantine`).
//
// When real Developer ID credentials are present, we skip this and let
// electron-builder sign + the afterSign hook notarize.
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  if (process.env.APPLE_TEAM_ID || process.env.CSC_LINK) return; // real signing path

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  try {
    // Strip extended attributes (Finder info, etc.) that block codesign.
    execFileSync('xattr', ['-cr', appPath]);
    // Ad-hoc sign the whole bundle so its signature is valid.
    execFileSync('codesign', ['--deep', '--force', '--sign', '-', appPath], { stdio: 'inherit' });
    console.log(`afterPack: ad-hoc signed ${appPath}`);
  } catch (err) {
    // Building inside an iCloud-synced folder can re-add xattrs and break
    // signing locally — that's harmless (local copies aren't quarantined). CI
    // runs in a clean checkout where this succeeds.
    console.warn(`afterPack: ad-hoc signing skipped (${err.message.split('\n')[0]})`);
  }
};
