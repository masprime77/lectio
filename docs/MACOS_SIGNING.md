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

`packages/desktop/build/afterSign.js` fails loudly if only some of the five
secrets are configured: electron-builder invokes the `afterSign` hook
regardless of whether real signing actually happened, so notarizing an app
that was never Developer-ID-signed would otherwise crash inside
`@electron/notarize` with a cryptic codesign error instead of pointing at the
missing secret. With a partial set, the hook throws and names exactly which
of the five secrets are present and which are missing.

With all five set, the hook additionally runs `codesign -dvvv` on the packaged
`.app` and refuses to notarize unless the signature carries
`TeamIdentifier=<APPLE_TEAM_ID>` — electron-builder logs "skipped macOS
application code signing" and continues when it can't import an identity, so
the bundle would otherwise reach `@electron/notarize` still ad-hoc signed. The
two usual causes are `CSC_LINK` not being base64 of a **Developer ID
Application** certificate (a Development or Mac App Distribution cert won't
do) and `CSC_KEY_PASSWORD` not matching the `.p12` export password; the error
includes the raw `codesign` output so the actual state is visible in the CI log.

### Two notarization paths — only one is enabled

electron-builder has **built-in** notarization of its own, in addition to the
`afterSign.js` hook. It activates as soon as `APPLE_ID` is set and then requires
the app-specific password in **`APPLE_APP_SPECIFIC_PASSWORD`** — a different
variable from the `APPLE_ID_PASSWORD` this repo's hook uses — so it aborts the
build with `APPLE_APP_SPECIFIC_PASSWORD env var needs to be set`. It is
therefore disabled with `"notarize": false` in the desktop `package.json`'s
`build.mac` block, leaving `afterSign.js` as the single notarizer. Enabling both
would notarize every build twice. If you ever prefer the built-in path, set
`APPLE_APP_SPECIFIC_PASSWORD` in the workflow and drop the `notarize()` call
from `afterSign.js`.

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

1. If `MAC_CSC_P12_BASE64` is set **and `CSC_LINK` is not**, the **Import
   self-signed signing certificate** step creates a temporary keychain, imports
   the `.p12`, adds it to the search list, and exports the identity's SHA-1 as
   `MAC_SIGN_IDENTITY`. (The cert is untrusted, so it's listed without
   `find-identity -v`.) It is skipped on the real Developer ID path, where
   `afterPack` no-ops anyway and this step's keychain — which it makes the
   *default* — could shadow the identity electron-builder imports.
2. On this free path the build runs with `CSC_IDENTITY_AUTO_DISCOVERY=false`, so
   electron-builder does not try to sign. Instead
   `packages/desktop/build/afterPack.js` signs the bundle with
   `MAC_SIGN_IDENTITY` and logs the resulting designated requirement.
3. If the secret is absent, the step is skipped and `afterPack` falls back to
   ad-hoc signing (auto-update won't work, but the app still runs).

### Gotcha: `CSC_IDENTITY_AUTO_DISCOVERY` disables signing entirely

That variable does **not** merely stop electron-builder searching the keychain —
setting it to `false` turns macOS code signing off outright, and it takes
precedence even when `CSC_LINK` is set. Pinning it to `false` unconditionally
therefore breaks the *real* signing path: electron-builder skips signing, and
`afterPack` also skips (it defers whenever `CSC_LINK`/`APPLE_TEAM_ID` are set),
so nothing signs the app and an ad-hoc bundle reaches `afterSign`. The
signature check there catches it, but the failure reads like a bad certificate.
The workflow now sets the flag to `false` only when `CSC_LINK` is empty. The
symptom to recognise in a build log is:

```
• skipped macOS application code signing  reason=, ... CSC_IDENTITY_AUTO_DISCOVERY=false
```

An empty `reason=` alongside configured signing secrets means the flag suppressed
signing — not that the certificate failed to import.

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
