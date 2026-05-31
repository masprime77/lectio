'use strict';
// Generates the DMG background images:
//   assets/dmg-background.png      (1080x750)
//   assets/dmg-background@2x.png   (2160x1500, retina)
// A solid light background matching the app's light theme with a subtle
// left→right arrow in the center (no text). Uses Chromium's canvas via Electron.
//
// Run: node_modules/.bin/electron assets/generate-dmg-background.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const BG = '#f5f6f8'; // app light-theme background
const ARROW = '#c7ced6'; // subtle gray
const BASE_W = 1080;
const BASE_H = 750;

function drawScript(scale) {
  const W = BASE_W * scale;
  const H = BASE_H * scale;
  return `(() => {
    const W = ${W}, H = ${H}, s = ${scale};
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '${BG}';
    ctx.fillRect(0, 0, W, H);

    // Subtle left→right arrow, centered, hinting "drag this way".
    ctx.strokeStyle = '${ARROW}';
    ctx.lineWidth = 6 * s;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const y = H * 0.49;
    const x1 = W * 0.40;
    const x2 = W * 0.60;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();

    const ah = 24 * s; // arrowhead size
    ctx.beginPath();
    ctx.moveTo(x2, y); ctx.lineTo(x2 - ah, y - ah);
    ctx.moveTo(x2, y); ctx.lineTo(x2 - ah, y + ah);
    ctx.stroke();

    return c.toDataURL('image/png');
  })()`;
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 200, height: 200 });
  await win.loadURL('data:text/html,<body></body>');

  for (const [scale, name] of [[1, 'dmg-background.png'], [2, 'dmg-background@2x.png']]) {
    const dataUrl = await win.webContents.executeJavaScript(drawScript(scale));
    const out = path.join(__dirname, name);
    fs.writeFileSync(out, Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'));
    console.log('Wrote ' + out);
  }
  app.quit();
});

app.on('window-all-closed', () => app.quit());
