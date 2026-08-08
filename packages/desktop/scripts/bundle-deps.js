'use strict';
// Pre-seed packages/desktop/node_modules with @lectio/desktop's *production*
// dependency closure so electron-builder bundles those modules into the app.
//
// Why this exists: in this npm-workspaces monorepo every dependency is hoisted
// to the repo-root node_modules, so packages/desktop has no local node_modules.
// electron-builder (a) bundles only what it finds under <appDir>/node_modules —
// nothing, here — and (b) when that dir is missing runs a `npm install
// --omit=dev` in the workspace child, which npm executes against the whole
// workspace and prunes the hoisted root's devDependencies (electron-builder,
// 7zip-bin, …) mid-build, aborting the run. Seeding the closure makes
// electron-builder see deps already installed: it skips that install (no prune)
// and bundles the seeded modules.
//
// The closure is computed by npm itself and copied from the already-installed
// hoisted modules (dereferencing the @lectio/core workspace symlink) — no
// network. packages/desktop/node_modules is git-ignored and rebuilt each
// prebuild; predev/prestart remove it so `npm start`/dev keep using the live
// workspace packages instead of these snapshots.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const rootModules = path.join(repoRoot, 'node_modules');
const destModules = path.join(__dirname, '..', 'node_modules');

let out;
try {
  out = execFileSync(
    'npm',
    ['ls', '--omit=dev', '--all', '--parseable', '--workspace', '@lectio/desktop'],
    { cwd: repoRoot, encoding: 'utf8' }
  );
} catch (err) {
  // npm ls exits non-zero on benign warnings but still prints the tree on stdout.
  out = err.stdout ? err.stdout.toString() : '';
  if (!out) throw err;
}

const pkgPaths = out
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);

fs.rmSync(destModules, { recursive: true, force: true });

let copied = 0;
for (const src of pkgPaths) {
  const rel = path.relative(rootModules, src);
  // Skip the repo root, the desktop app itself, and anything outside root node_modules.
  if (rel === '' || rel.startsWith('..') || rel === path.join('@lectio', 'desktop')) continue;

  const dest = path.join(destModules, rel);
  const nested = path.join(src, 'node_modules');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, {
    recursive: true,
    dereference: true,
    // A package's own nested node_modules entries are listed separately, so skip
    // them here to avoid copying the same module twice.
    filter: (p) => p !== nested && !p.startsWith(nested + path.sep),
  });
  copied += 1;
}

console.log(`bundle-deps: seeded ${copied} production modules into packages/desktop/node_modules`);
