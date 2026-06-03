const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const path = require('path');
const { registerIpcHandlers } = require('./lib/ipc-handlers');

let mainWindow = null;

// Where semester JSON files live:
//   - development: the project's /semesters folder
//   - production:  <userData>/semesters, so user data persists across app
//     updates (~/Library/Application Support/Lectio/semesters on macOS)
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
    minWidth: 500,
    minHeight: 400,
    titleBarStyle: 'hiddenInset',
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

// Application menu with File → Save (Cmd/Ctrl+S). Save is handled in the
// renderer, so the menu item just forwards the request over IPC.
function buildAppMenu() {
  const isMac = process.platform === 'darwin';
  // Settings/Preferences → handled in the renderer. Cmd+, on macOS, Ctrl+, else.
  const settingsItem = {
    label: 'Settings…',
    accelerator: 'CmdOrCtrl+,',
    click: () => sendToRenderer('open-settings'),
  };
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              settingsItem, // Preferences belongs in the app menu on macOS
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendToRenderer('menu-save'),
        },
        ...(!isMac ? [{ type: 'separator' }, settingsItem] : []),
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------------------
// Auto-update (electron-updater + GitHub Releases)
// ---------------------------------------------------------------------------
function setupAutoUpdater(enabled) {
  autoUpdater.on('update-available', () => sendToRenderer('update-available'));
  autoUpdater.on('update-downloaded', () => sendToRenderer('update-downloaded'));
  // Never crash the app over an update error — just log it.
  autoUpdater.on('error', (err) => {
    console.error('autoUpdater error:', err == null ? 'unknown' : err.message || err);
  });

  // Restart into the freshly downloaded update.
  ipcMain.handle('restart-and-update', () => autoUpdater.quitAndInstall());

  // Auto-update disabled in settings → register handlers but skip the check.
  if (!enabled) return;

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
// Unsaved-changes tracking + close prompt
// ---------------------------------------------------------------------------
let isDirty = false;   // reported by the renderer as changes are made/saved
let allowQuit = false; // set once the user has decided how to close

ipcMain.on('set-dirty', (event, dirty) => {
  isDirty = !!dirty;
});

// Renderer signals it finished saving for the "Save and Close" choice.
ipcMain.handle('save-and-quit-done', () => {
  allowQuit = true;
  app.quit();
});

// ---------------------------------------------------------------------------
// App settings (file-based, in userData) — read in the main process so the
// auto-update preference is available before the renderer loads.
// ---------------------------------------------------------------------------
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch (e) {
    return {}; // missing or corrupt → defaults applied by callers
  }
}

function writeSettings(data) {
  try {
    fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data || {}, null, 2));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

ipcMain.handle('get-settings', () => readSettings());
ipcMain.handle('save-settings', (event, data) => writeSettings(data));
ipcMain.handle('get-version', () => app.getVersion());

// Open an external link in the user's default browser. Restricted to https
// github.com URLs (used for the pre-filled feedback/bug-report issue links) so
// the renderer can't ask the OS to open arbitrary URLs.
ipcMain.handle('open-external', (event, url) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' && parsed.hostname === 'github.com') {
      return shell.openExternal(parsed.href);
    }
  } catch (e) {
    /* malformed URL → ignore */
  }
  return Promise.resolve();
});

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  ensureSemestersDir();
  buildAppMenu();

  createWindow();
  // Read the auto-update preference before launching the check (default: on).
  const autoUpdateEnabled = readSettings().autoUpdate !== false;
  setupAutoUpdater(autoUpdateEnabled);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Warn about unsaved changes before quitting.
app.on('before-quit', async (event) => {
  if (allowQuit || !isDirty || !mainWindow || mainWindow.isDestroyed()) return;

  event.preventDefault();
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'Unsaved changes',
    message: 'You have unsaved changes. Save before closing?',
    buttons: ['Save and Close', 'Close without saving', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
  });

  if (response === 0) {
    // Ask the renderer to flush; it calls save-and-quit-done when finished.
    sendToRenderer('flush-save-and-quit');
  } else if (response === 1) {
    allowQuit = true;
    app.quit();
  }
  // response === 2 (Cancel): stay open.
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
