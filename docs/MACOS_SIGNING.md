# macOS code signing & auto-update

Lectio's macOS builds are signed with a **persistent self-signed code-signing
certificate** so that in-app auto-update works on the free (non-Apple) path.

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
clears. For full notarization (and no Gatekeeper warning), set `APPLE_TEAM_ID`
+ certs instead; that path still takes over automatically (see `build/`).

## One-time setup

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
   does not try to sign. Instead `build/afterPack.js` signs the bundle with
   `MAC_SIGN_IDENTITY` and logs the resulting designated requirement.
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
