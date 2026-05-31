const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const path = require('path');
const { registerIpcHandlers } = require('./lib/ipc-handlers');

let mainWindow = null;

// Where semester JSON files live:
//   - development: the project's /semesters folder
//   - production:  <userData>/semesters, so user data persists across app
//     updates (~/Library/Application Support/Semester Planner/semesters on macOS)
const SEMESTERS_DIR = app.isPackaged
  ? path.join(app.getPath('userData'), 'semesters')
  : path.join(__dirname, 'semesters');

// Ensure the semesters directory exists. In production, seed it from the
// bundled example.json on first launch (when the folder is empty).
function ensureSemestersDir() {
  fs.mkdirSync(SEMESTERS_DIR, { recursive: true });
  if (!app.isPackaged) return;

  const hasData = fs.readdirSync(SEMESTERS_DIR).some((f) => f.endsWith('.json'));
  if (hasData) return;

  // extraResources places the bundled folder at <resources>/semesters.
  const bundledExample = path.join(process.resourcesPath, 'semesters', 'example.json');
  if (fs.existsSync(bundledExample)) {
    fs.copyFileSync(bundledExample, path.join(SEMESTERS_DIR, 'example.json'));
  }
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (process.argv.includes('--dev-tools')) {
    mainWindow.webContents.openDevTools();
  }
}

// Notify the renderer (if the window is still around).
function sendToRenderer(channel) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel);
  }
}

// ---------------------------------------------------------------------------
// Auto-update (electron-updater + GitHub Releases)
// ---------------------------------------------------------------------------
function setupAutoUpdater() {
  autoUpdater.on('update-available', () => sendToRenderer('update-available'));
  autoUpdater.on('update-downloaded', () => sendToRenderer('update-downloaded'));
  // Never crash the app over an update error — just log it.
  autoUpdater.on('error', (err) => {
    console.error('autoUpdater error:', err == null ? 'unknown' : err.message || err);
  });

  // Restart into the freshly downloaded update.
  ipcMain.handle('restart-and-update', () => autoUpdater.quitAndInstall());

  // Check in the background, then notify. Wrapped so a dev/offline failure is
  // swallowed (the 'error' handler also covers async rejections).
  try {
    autoUpdater.checkForUpdatesAndNotify();
  } catch (err) {
    console.error('autoUpdater check failed:', err && err.message);
  }
}

// IPC: filesystem handlers (replace the old Express endpoints). The actual
// logic lives in lib/semester-store.js so it can be tested without Electron.
registerIpcHandlers(ipcMain, () => SEMESTERS_DIR);

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  ensureSemestersDir();

  // Hide the default menu bar on macOS.
  if (process.platform === 'darwin') Menu.setApplicationMenu(null);

  createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
