# macOS code signing & auto-update

Lectio's macOS builds are signed with a **real Apple Developer ID Application
certificate** and notarized via `@electron/notarize` when `APPLE_TEAM_ID` /
`CSC_LINK` and friends are configured in CI — see
["Real signing + notarization"](#real-signing--notarization-primary-path)
below. A **persistent self-signed code-signing certificate** is kept as an
automatic fallback, so in-app auto-update still works on the free (non-Apple)
path if the real credentials are ever absent.

## Why this is needed

macOS in-app updates go through **Squirrel.Mac**. Before installing an update,
Squirrel checks that the new build's code signature satisfies the *running*
app's **designated requirement (DR)**.

- With **ad-hoc** signing (`codesign --sign -`), the DR is pinned to each
  build's binary hash (`cdhash`). A new build therefore can *never* satisfy the
  previous build's requirement, so Squirrel rejects every update with:

  > Code signature ... did not pass validation: code failed to satisfy
  > specified code requirement(s)

  The update downloads but never installs (this is the bug behind the macOS
  "pressing Install & Relaunch does nothing" symptom).

- With a **stable signing identity**, the DR is instead:

  ```
  designated => identifier "com.masprime77.lectio" and certificate leaf = H"<cert hash>"
  ```

  Every build signed with the *same* certificate yields the *same*
  requirement, so Squirrel accepts updates between builds.

A self-signed certificate gives us that stable identity for free. It is **not**
Apple notarization — Gatekeeper still shows "unidentified developer" on first
launch, which the Homebrew cask's `postflight` (or a manual right-click → Open)
clears. Real notarization (no Gatekeeper warning at all) is the default
configured path in CI — see
["Real signing + notarization"](#real-signing--notarization-primary-path)
below.

## Real signing + notarization (primary path)

This is the path CI uses today. It needs:

- A **Developer ID Application** certificate, which requires an Apple
  Developer Program membership, exported as a `.p12`.
- An **app-specific password** for the Apple ID used to notarize, generated at
  [appleid.apple.com](https://appleid.apple.com/).

Those map to five GitHub repo secrets (Settings → Secrets and variables →
Actions):

- `CSC_LINK` — base64 of the Developer ID Application `.p12`
- `CSC_KEY_PASSWORD` — the `.p12` export password
- `APPLE_TEAM_ID` — the Apple Developer Team ID
- `APPLE_ID` — the Apple ID used to notarize
- `APPLE_ID_PASSWORD` — an app-specific password for that Apple ID

electron-builder reads `CSC_LINK`/`CSC_KEY_PASSWORD` automatically and signs
with the Developer ID Application cert; `packages/desktop/build/afterSign.js`
then notarizes automatically once `APPLE_TEAM_ID` is set. No further
configuration is needed at release time — set the five secrets once and every
tagged release signs and notarizes.

Notarization only succeeds because **Hardened Runtime** is enabled with the
entitlements Electron's JIT needs
(`packages/desktop/build/entitlements.mac.plist`) — Apple rejects a build
that isn't hardened-runtime-signed. That config lives in
`packages/desktop/package.json`'s `build.mac` block, not in the release
workflow.

With this path, downloaded builds open with **no Gatekeeper warning at all**,
for any user — unlike the self-signed fallback below.

## Self-signed fallback (if real credentials are unavailable)

This path only takes effect when `CSC_LINK`/`APPLE_TEAM_ID` are **not** set
(per the `||` check in `packages/desktop/build/afterPack.js`) — e.g. a fork,
or before the five secrets above are configured.

1. **Generate the certificate** on a Mac:

   ```bash
   scripts/gen-macos-signing-cert.sh
   ```

   This creates `./macos-signing/lectio-signing.p12` and prints:
   - a random `.p12` password, and
   - the base64 of the `.p12`.

   (Uses OpenSSL's `-legacy` PKCS#12 encryption so macOS `security import` can
   read it — the default OpenSSL 3 format fails with "MAC verification failed".)

2. **Add two GitHub repo secrets** (Settings → Secrets and variables → Actions):
   - `MAC_CSC_P12_BASE64` — the base64 blob
   - `MAC_CSC_PASSWORD` — the `.p12` password

3. **Store the `.p12` somewhere safe** (a password manager). Do **not** commit
   it, and do not lose it — see "Rotating the certificate" below.

That's it. The next tagged release builds a signed macOS app automatically.

## How it works in CI

`.github/workflows/release.yml` (macOS `build` job):

1. If `MAC_CSC_P12_BASE64` is set, the **Import self-signed signing
   certificate** step creates a temporary keychain, imports the `.p12`, adds it
   to the search list, and exports the identity's SHA-1 as `MAC_SIGN_IDENTITY`.
   (The cert is untrusted, so it's listed without `find-identity -v`.)
2. The build runs with `CSC_IDENTITY_AUTO_DISCOVERY=false`, so electron-builder
   does not try to sign. Instead `packages/desktop/build/afterPack.js` signs the
   bundle with `MAC_SIGN_IDENTITY` and logs the resulting designated requirement.
3. If the secret is absent, the step is skipped and `afterPack` falls back to
   ad-hoc signing (auto-update won't work, but the app still runs).

You can confirm a signed build in the release job log: look for
`afterPack: self-signed (...) signed` followed by
`designated => identifier "com.masprime77.lectio" and certificate leaf = H"..."`.
That hash must be identical across releases for auto-update to work.

## Important: the first signed release can't auto-update *into*

Squirrel validates against the **running** app's requirement. Any copy people
are running today is ad-hoc, so the **first** self-signed release cannot be
auto-installed onto it — that copy must be replaced **manually once** (download
the `.dmg` and drag to Applications). From then on, updates between two
self-signed releases install normally.

## Rotating the certificate

The DR is bound to the certificate. If you generate a **new** cert (lost `.p12`,
expiry — the generated cert lasts 10 years), the identity changes and the next
update won't auto-install; users must reinstall manually once, after which
auto-update resumes with the new cert. So keep the `.p12` backed up and reuse it.
