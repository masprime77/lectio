// Rebuilds assets/icon.ico from assets/icon.png (1024x1024) using png-to-ico,
// a pure-JS converter that needs no native build — so this works on macOS,
// Linux, and Windows. Run via:  npm run icon:win
//
// Unlike assets/build-icns.sh (macOS-only, sips + iconutil → .icns), this emits
// a multi-resolution Windows .ico. png-to-ico's one-shot path only embeds
// 16/32/48/256 px, so we resize the source ourselves and hand it the full set
// of layers below. Swap the logo by replacing assets/icon.png with your
// 1024x1024 artwork, then run this script and commit
// assets/icon.png + assets/icon.ico.
//
// png-to-ico@3 is ESM-only, so this CommonJS script loads it via dynamic import.
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const src = path.join(dir, 'icon.png');
const out = path.join(dir, 'icon.ico');

// Layers embedded in the .ico, covering common Windows shell needs
// (taskbar, Explorer list/details/tiles, Alt-Tab, installer).
const sizes = [16, 24, 32, 48, 64, 128, 256];

async function main() {
  if (!fs.existsSync(src)) {
    throw new Error(`${src} not found in assets/`);
  }

  const { imagesToIco } = await import('png-to-ico');
  const { readPNG, resize } = await import('png-to-ico/lib/png.js');

  const png = await readPNG(src);
  if (png.width !== png.height) {
    throw new Error('icon.png must be a square PNG image.');
  }

  // Downscale through a 256px base for cleaner small icons (mirrors how
  // png-to-ico itself works), then build each requested layer from it.
  const base = png.width === 256 ? png : resize(png, 256, 256);
  const layers = sizes.map((s) => (s === 256 ? base : resize(base, s, s)));

  fs.writeFileSync(out, imagesToIco(layers));
  console.log(`Rebuilt assets/icon.ico from ${path.basename(src)} (${sizes.join(', ')} px)`);
}

main().catch((err) => {
  console.error('error: failed to build icon.ico:', err.message);
  process.exit(1);
});
