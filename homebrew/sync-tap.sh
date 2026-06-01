#!/bin/bash
# Publishes the Lectio cask to your Homebrew tap repo.
#
# Usage:   homebrew/sync-tap.sh [version]
#   - version defaults to the "version" field in package.json
#   - tap location defaults to ../homebrew-tap (override with TAP_DIR=/path/to/tap)
#
# What it does:
#   1. Refreshes the cask (version + sha256) from the published GitHub release.
#   2. Copies it into the tap's Casks/ folder.
#   3. Commits and pushes in the tap repo (only if something changed).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAP_DIR="${TAP_DIR:-$REPO_ROOT/../homebrew-tap}"
VERSION="${1:-$(node -p "require('$REPO_ROOT/package.json').version")}"
CASK="$REPO_ROOT/homebrew/Casks/lectio.rb"

if [ ! -d "$TAP_DIR/.git" ]; then
  echo "error: tap repo not found at '$TAP_DIR'" >&2
  echo "       set TAP_DIR=/path/to/homebrew-tap and retry." >&2
  exit 1
fi

echo "==> Refreshing cask for v$VERSION"
bash "$REPO_ROOT/homebrew/update-cask.sh" "$VERSION"

echo "==> Copying cask into $TAP_DIR/Casks/"
mkdir -p "$TAP_DIR/Casks"
cp "$CASK" "$TAP_DIR/Casks/lectio.rb"

echo "==> Committing & pushing in the tap"
cd "$TAP_DIR"
git add Casks/lectio.rb
if git diff --cached --quiet; then
  echo "Tap already up to date for v$VERSION — nothing to push."
else
  git commit -m "lectio $VERSION"
  git push
  echo "Pushed lectio $VERSION to the tap."
fi
