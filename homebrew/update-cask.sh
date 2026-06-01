#!/bin/bash
# Fills the Homebrew cask's version + sha256 from a published GitHub release.
#
# Usage:  homebrew/update-cask.sh <version>     e.g.  homebrew/update-cask.sh 1.0.3
#
# The cask installs from the .zip asset (the .app inside it), so we hash the zip.
# The Release workflow uploads "Lectio-<version>-arm64-mac.zip" on a
# v* tag.
set -euo pipefail

VERSION="${1:?usage: $0 <version>  e.g. $0 1.0.3}"
REPO="masprime77/lectio"
ASSET="Lectio-${VERSION}-arm64-mac.zip"
URL="https://github.com/${REPO}/releases/download/v${VERSION}/${ASSET}"
CASK="$(cd "$(dirname "$0")" && pwd)/Casks/lectio.rb"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "Downloading ${URL}"
curl -fsSL "$URL" -o "${tmp}/${ASSET}"
sha="$(shasum -a 256 "${tmp}/${ASSET}" | awk '{print $1}')"
echo "sha256: ${sha}"

# BSD/macOS sed in-place edit.
sed -i '' -E "s/^  version \".*\"/  version \"${VERSION}\"/" "$CASK"
sed -i '' -E "s/^  sha256 \".*\"/  sha256 \"${sha}\"/" "$CASK"

echo "Updated ${CASK} → version ${VERSION}."
