'use strict';
// Remove the build-only packages/desktop/node_modules seeded by bundle-deps.js.
//
// `npm start`/dev resolve @lectio/core (and the other deps) from the hoisted
// workspace root, so any local node_modules left over from a build would shadow
// the live workspace packages with stale snapshots. Run this on predev/prestart
// to guarantee dev always uses the real workspace.
const fs = require('fs');
const path = require('path');

fs.rmSync(path.join(__dirname, '..', 'node_modules'), { recursive: true, force: true });
