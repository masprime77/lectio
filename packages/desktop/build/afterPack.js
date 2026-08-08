'use strict';
// electron-builder afterPack hook.
//
// On the free (unsigned) distribution path, electron-builder leaves the app
// bundle's signature unsealed, so a downloaded (quarantined) copy is reported by
// Gatekeeper as "damaged" and won't open. Here we sign the whole bundle so its
// signature is VALID — Gatekeeper then shows the milder "unidentified developer"
// instead, which users can bypass (right-click → Open, or
// `xattr -dr com.apple.quarantine`).
//
// Two free signing modes:
//   - Persistent self-signed identity (MAC_SIGN_IDENTITY): a single self-signed
//     code-signing cert reused across every release. Because the signing
//     identity is STABLE, each build's signature satisfies the previous build's
//     designated requirement, so Squirrel.Mac accepts macOS auto-updates
//     between two self-signed builds. CI imports the cert and sets this env var
//     (see .github/workflows/release.yml + docs/MACOS_SIGNING.md).
//   - Ad-hoc (fallback): valid for Gatekeeper but its requirement is pinned to
//     each build's binary hash, so macOS auto-update can never install it.
//
// When real Developer ID credentials are present, we skip this entirely and let
// electron-builder sign + the afterSign hook notarize.
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  if (process.env.APPLE_TEAM_ID || process.env.CSC_LINK) return; // real signing path

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  const identity = process.env.MAC_SIGN_IDENTITY || '-';
  const isAdHoc = identity === '-';
  const label = isAdHoc ? 'ad-hoc' : `self-signed (${identity})`;

  try {
    // Strip extended attributes (Finder info, etc.) that block codesign.
    execFileSync('xattr', ['-cr', appPath]);

    const args = ['--deep', '--force', '--sign', identity];
    // No trusted timestamp for self-signed (no Apple TSA); avoids a network
    // dependency and is irrelevant to Squirrel.Mac's requirement check.
    if (!isAdHoc) args.push('--timestamp=none');
    args.push(appPath);
    execFileSync('codesign', args, { stdio: 'inherit' });
    console.log(`afterPack: ${label} signed ${appPath}`);

    if (!isAdHoc) {
      // Surface the resulting signature + designated requirement in the build
      // log so it's verifiable that successive self-signed builds share the
      // same requirement (the condition for auto-update to work).
      execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], { stdio: 'inherit' });
      execFileSync('codesign', ['-d', '--requirements', '-', appPath], { stdio: 'inherit' });
    }
  } catch (err) {
    // A configured real identity must sign cleanly — fail loudly so a broken
    // release is never published.
    if (!isAdHoc) throw err;
    // Ad-hoc fallback: building inside an iCloud-synced folder can re-add
    // xattrs and break signing locally — harmless (local copies aren't
    // quarantined). CI runs in a clean checkout where this succeeds.
    console.warn(`afterPack: ad-hoc signing skipped (${err.message.split('\n')[0]})`);
  }
};
