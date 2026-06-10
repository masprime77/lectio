// Metro config for running an Expo app inside an npm-workspaces monorepo.
// Without this, Metro can't resolve the @lectio/core workspace symlink (hoisted
// to the repo-root node_modules) or watch the shared package for changes.
// See https://docs.expo.dev/guides/monorepo/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch the whole monorepo so changes in @lectio/core trigger a rebuild.
config.watchFolders = [workspaceRoot];

// 2. Resolve modules from the app first, then the hoisted root node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Only walk the two paths above (don't climb the tree), so a hoisted
//    @lectio/core resolves deterministically.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
