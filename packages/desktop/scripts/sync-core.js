'use strict';
// Vendor the renderer-facing part of @lectio/core next to index.html.
//
// The renderer runs with contextIsolation:true / nodeIntegration:false, so it
// can only pull in planner-core via a <script src> URL relative to index.html —
// it can't require() the package. In dev, npm hoists @lectio/core to the
// workspace-root node_modules (there is no packages/desktop/node_modules copy),
// and when packaged electron-builder flattens index.html to the asar root, so a
// "../core/..." path resolves in neither place. Copying the file to a stable
// sibling (packages/desktop/planner-core.js) makes `<script src="planner-core.js">`
// work identically under `npm start`/`npm run dev` and in the packaged app.
//
// The copy is git-ignored; it's regenerated on prestart/predev/prebuild.
const fs = require('fs');
const path = require('path');

const src = require.resolve('@lectio/core/planner-core');
const dest = path.join(__dirname, '..', 'planner-core.js');
fs.copyFileSync(src, dest);
