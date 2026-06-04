#!/usr/bin/env bash
#
# Generate a persistent self-signed code-signing certificate for Lectio's
# macOS builds, and print the values to store as GitHub Actions secrets.
#
# Why: macOS in-app auto-update (Squirrel.Mac) only installs an update whose
# code signature satisfies the running app's *designated requirement*. Ad-hoc
# signatures pin that requirement to each build's binary hash, so a new build
# can never satisfy the old one and the update silently fails. Signing every
# release with ONE reusable self-signed identity makes the requirement stable,
# so updates between two self-signed builds install correctly. (This is not
# Apple notarization — Gatekeeper still shows "unidentified developer" on first
# launch; that's handled by the Homebrew cask / right-click → Open.)
#
# Run this ONCE on a Mac. Then add the two printed values as repo secrets:
#   MAC_CSC_P12_BASE64   ← the base64 blob
#   MAC_CSC_PASSWORD     ← the .p12 password
# The release workflow imports them and signs each build (see
# .github/workflows/release.yml + docs/MACOS_SIGNING.md).
#
# Keep the generated .p12 safe and DO NOT commit it. If the cert is ever lost
# or regenerated, the identity changes and users must reinstall once manually
# before auto-update resumes.
#
# Usage:
#   scripts/gen-macos-signing-cert.sh ["Common Name"] [output-dir]
#   P12_PASSWORD=my-pass scripts/gen-macos-signing-cert.sh   # fixed password

set -euo pipefail

CN="${1:-Lectio Self-Signed}"
OUT_DIR="${2:-./macos-signing}"
P12_PASSWORD="${P12_PASSWORD:-$(openssl rand -base64 18)}"

mkdir -p "$OUT_DIR"
KEY="$OUT_DIR/lectio-signing.key"
CERT="$OUT_DIR/lectio-signing.crt"
P12="$OUT_DIR/lectio-signing.p12"
CNF="$(mktemp)"
trap 'rm -f "$CNF"' EXIT

# OpenSSL config with the code-signing extensions. Written to a temp file so
# this works on both OpenSSL and the LibreSSL that ships with macOS (which does
# not reliably support `-addext`).
cat > "$CNF" <<EOF
[ req ]
distinguished_name = dn
x509_extensions    = v3_code
prompt             = no

[ dn ]
CN = $CN

[ v3_code ]
basicConstraints   = critical,CA:FALSE
keyUsage           = critical,digitalSignature
extendedKeyUsage   = critical,codeSigning
EOF

echo "Generating self-signed code-signing certificate (CN=\"$CN\")…"
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "$KEY" -out "$CERT" -days 3650 -config "$CNF"

# macOS's Security framework (used by `security import` in CI) can't read the
# SHA-256-MAC PKCS#12 that OpenSSL 3 writes by default — it fails with "MAC
# verification failed". Use the older, Apple-compatible algorithms via -legacy
# when the openssl build supports it (OpenSSL 3). LibreSSL (the macOS system
# openssl) has no -legacy flag but already writes compatible files.
PKCS12_LEGACY=()
if openssl pkcs12 -help 2>&1 | grep -q -- '-legacy'; then
  PKCS12_LEGACY=(-legacy)
fi

openssl pkcs12 -export "${PKCS12_LEGACY[@]}" -inkey "$KEY" -in "$CERT" \
  -name "$CN" -out "$P12" -passout pass:"$P12_PASSWORD"

echo
echo "Created:"
echo "  $P12"
echo
echo "──────────────────────────────────────────────────────────────────────"
echo "Add these as GitHub repo secrets (Settings → Secrets and variables →"
echo "Actions → New repository secret):"
echo
echo "  MAC_CSC_PASSWORD = $P12_PASSWORD"
echo
echo "  MAC_CSC_P12_BASE64 = (the base64 blob below)"
echo "──────────────────────────────────────────────────────────────────────"
echo
base64 < "$P12"
echo
echo "Tip: pipe straight to your clipboard with:"
echo "  base64 < \"$P12\" | pbcopy"
echo
echo "Then keep \"$P12\" somewhere safe and delete the working copy. Do NOT commit it."
