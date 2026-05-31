const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const fs = require('fs');
const path = require('path');
const { registerIpcHandlers } = require('./lib/ipc-handlers');

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
  const win = new BrowserWindow({
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

  win.loadFile('index.html');

  if (process.argv.includes('--dev-tools')) {
    win.webContents.openDevTools();
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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
