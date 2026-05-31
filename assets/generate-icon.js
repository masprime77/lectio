'use strict';
// Generates assets/icon.png (1024x1024): a flat rounded-rect app icon in the
// app's primary color with "SP" in white (San Francisco system font).
//
// Run:   node_modules/.bin/electron assets/generate-icon.js
// Then build the .icns from it with sips + iconutil (see the build steps in the
// README / commit message). Uses Chromium's canvas via Electron — no extra deps.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const SIZE = 1024;
const PRIMARY = '#4A90D9'; // app primary color
const OUT = path.join(__dirname, 'icon.png');

const draw = `(() => {
  const S = ${SIZE};
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const ctx = c.getContext('2d');

  // Full-bleed rounded square (squircle-ish), in the primary color.
  const r = Math.round(S * 0.22);
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(S, 0, S, S, r);
  ctx.arcTo(S, S, 0, S, r);
  ctx.arcTo(0, S, 0, 0, r);
  ctx.arcTo(0, 0, S, 0, r);
  ctx.closePath();
  ctx.fillStyle = '${PRIMARY}';
  ctx.fill();

  // "SP" wordmark in white, bold San Francisco.
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 ' + Math.round(S * 0.5) + 'px -apple-system, "SF Pro Display", "Helvetica Neue", system-ui, sans-serif';
  ctx.fillText('SP', S / 2, S * 0.54);

  return c.toDataURL('image/png');
})()`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: SIZE, height: SIZE });
  await win.loadURL('data:text/html,<body></body>');
  const dataUrl = await win.webContents.executeJavaScript(draw);
  fs.writeFileSync(OUT, Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'));
  console.log('Wrote ' + OUT);
  app.quit();
});

app.on('window-all-closed', () => app.quit());
