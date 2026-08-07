// Ambient module for the *.html legal-document fragments bundled as assets
// (see metro.config.js's assetExts). Metro resolves require()/import of these
// to a numeric asset module id, same as an image require() — expo-asset then
// turns that id into a local file URI at runtime.
declare module '*.html' {
  const assetSource: number;
  export default assetSource;
}
