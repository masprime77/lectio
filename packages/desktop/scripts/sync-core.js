'use strict';
// Vendor the renderer-facing parts of @lectio/core next to index.html.
//
// The renderer runs with contextIsolation:true / nodeIntegration:false, so it
// can only pull core in via a <script src> URL relative to index.html — it
// can't require() the package. In dev, npm hoists @lectio/core to the
// workspace-root node_modules (there is no packages/desktop/node_modules copy),
// and when packaged electron-builder flattens index.html to the asar root, so a
// "../core/..." path resolves in neither place. Copying each file to a stable
// sibling makes `<script src="...">` work identically under `npm start`/
// `npm run dev` and in the packaged app.
//
// Both files are dual-mode (window globals in the browser, module.exports in
// Node): planner-core → window.PlannerCore, migrate → window.PlannerMigrate
// (used by supabase-storage.js's get() to apply the same migration as fs/mobile).
//
// The copies are git-ignored; they're regenerated on prestart/predev/prebuild.
const fs = require('fs');
const path = require('path');

const files = [
  ['@lectio/core/planner-core', 'planner-core.js'],
  ['@lectio/core/storage/migrate', 'migrate.js'],
];
for (const [spec, name] of files) {
  fs.copyFileSync(require.resolve(spec), path.join(__dirname, '..', name));
}
