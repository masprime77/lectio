#!/bin/bash
# Fallback / dev launcher: double-click to run the app from source with Electron.
# For a packaged native app, use `npm run build:mac` and install the .dmg instead.
cd "$(dirname "$0")" || exit 1

if [ ! -d node_modules ]; then
  echo "Installing dependencies (first run)…"
  npm install || { echo "npm install failed"; exit 1; }
fi

npm start
