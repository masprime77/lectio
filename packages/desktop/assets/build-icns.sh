#!/bin/bash
# Rebuilds assets/icon.icns from assets/icon.png (1024x1024) using only macOS
# built-in tools (sips + iconutil). Run via:  npm run icon
#
# Swap the logo by replacing assets/icon.png with your 1024x1024 artwork, then
# run this script and commit assets/icon.png + assets/icon.icns.
set -euo pipefail
cd "$(dirname "$0")"

SRC="icon.png"
SET="icon.iconset"

if [ ! -f "$SRC" ]; then
  echo "error: $SRC not found in assets/" >&2
  exit 1
fi

rm -rf "$SET" && mkdir "$SET"
sips -z 16 16     "$SRC" --out "$SET/icon_16x16.png"      >/dev/null
sips -z 32 32     "$SRC" --out "$SET/icon_16x16@2x.png"   >/dev/null
sips -z 32 32     "$SRC" --out "$SET/icon_32x32.png"      >/dev/null
sips -z 64 64     "$SRC" --out "$SET/icon_32x32@2x.png"   >/dev/null
sips -z 128 128   "$SRC" --out "$SET/icon_128x128.png"    >/dev/null
sips -z 256 256   "$SRC" --out "$SET/icon_128x128@2x.png" >/dev/null
sips -z 256 256   "$SRC" --out "$SET/icon_256x256.png"    >/dev/null
sips -z 512 512   "$SRC" --out "$SET/icon_256x256@2x.png" >/dev/null
sips -z 512 512   "$SRC" --out "$SET/icon_512x512.png"    >/dev/null
cp "$SRC" "$SET/icon_512x512@2x.png"
iconutil -c icns "$SET" -o icon.icns
rm -rf "$SET"

echo "Rebuilt assets/icon.icns from $SRC"
