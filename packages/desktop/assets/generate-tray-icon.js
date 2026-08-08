'use strict';
// Generates the menu bar (Tray) icon: pomodoro-tray-icon.png (18x18) and its
// @2x Retina variant (36x36) — a monochrome clock glyph, not the color app
// icon. Electron auto-picks the @2x file when nativeImage.createFromPath is
// given the 1x path, as long as both live in the same directory with the
// standard "name" / "name@2x" pair.
//
// The glyph is the exact same Tabler "clock" path the header's study-timer
// button already draws (see ICONS.clock / icon('clock') in app.js) — circle
// center (12,12) r 9, hands (12,7)->(12,12)->(15,15), stroke-width 2, in a
// 24-unit viewBox — so the Tray icon and the in-app button read as the same
// symbol. Drawn as a plain black stroke on a transparent background and
// marked as a template image by buildTrayIcon() in main.js, so macOS re-tints
// it for light/dark menu bars and the selection highlight.
//
// Run: node_modules/.bin/electron assets/generate-tray-icon.js
// Uses Chromium's canvas via Electron — no extra deps, same pattern as
// generate-icon.js / generate-dmg-background.js.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

// The source glyph's own coordinate space (matches ICONS.clock's viewBox).
const VIEWBOX = 24;
const CIRCLE_CENTER = 12;
const CIRCLE_RADIUS = 9;
const HAND_POINTS = [
  [12, 7],
  [12, 12],
  [15, 15],
];
const STROKE_WIDTH = 2;

function drawScript(targetSize) {
  const scale = targetSize / VIEWBOX;
  return `(() => {
    const S = ${targetSize};
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const ctx = c.getContext('2d');
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = ${STROKE_WIDTH * scale};
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.arc(${CIRCLE_CENTER * scale}, ${CIRCLE_CENTER * scale}, ${CIRCLE_RADIUS * scale}, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(${HAND_POINTS[0][0] * scale}, ${HAND_POINTS[0][1] * scale});
    ctx.lineTo(${HAND_POINTS[1][0] * scale}, ${HAND_POINTS[1][1] * scale});
    ctx.lineTo(${HAND_POINTS[2][0] * scale}, ${HAND_POINTS[2][1] * scale});
    ctx.stroke();

    return c.toDataURL('image/png');
  })()`;
}

async function writePng(win, targetSize, outPath) {
  const dataUrl = await win.webContents.executeJavaScript(drawScript(targetSize));
  fs.writeFileSync(outPath, Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'));
  console.log('Wrote ' + outPath);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 36, height: 36 });
  await win.loadURL('data:text/html,<body></body>');
  await writePng(win, 18, path.join(__dirname, 'pomodoro-tray-icon.png'));
  await writePng(win, 36, path.join(__dirname, 'pomodoro-tray-icon@2x.png'));
  app.quit();
});

app.on('window-all-closed', () => app.quit());
