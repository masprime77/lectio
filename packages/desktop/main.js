const { app, BrowserWindow, ipcMain, Menu, dialog, shell, safeStorage } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log/main');
const fs = require('fs');
const path = require('path');
const { registerIpcHandlers } = require('@lectio/core/ipc-handlers');
const { buildLaunchUrl, parseMoodleMobileRedirect } = require('@lectio/core/integrations/moodle-sso');

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
function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
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
  // Route electron-updater's internal logging (and the underlying Squirrel.Mac /
  // ShipIt errors on macOS) to a file so update failures are diagnosable on a
  // user's machine. Log path: ~/Library/Logs/Lectio/main.log (macOS),
  // %USERPROFILE%\AppData\Roaming\Lectio\logs\main.log (Windows).
  log.transports.file.level = 'debug';
  autoUpdater.logger = log;

  // Suppress autoUpdater's built-in notification; we handle the UI ourselves.
  autoUpdater.autoDownload = enabled; // download automatically only when enabled
  // Safety net: if the explicit quitAndInstall relaunch ever fails to swap the
  // app, a downloaded update still installs the next time the app quits, so a
  // plain close + reopen picks up the new version.
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    // Pass version string to renderer so it can fetch release notes.
    sendToRenderer('update-available', info.version);
  });

  autoUpdater.on('download-progress', (progress) => {
    // progress.percent is 0-100 (float).
    sendToRenderer('update-download-progress', Math.round(progress.percent));
  });

  autoUpdater.on('update-downloaded', () => {
    sendToRenderer('update-downloaded');
  });

  autoUpdater.on('error', (err) => {
    const message = err == null ? 'unknown' : err.message || String(err);
    log.error('autoUpdater error:', err);
    // Surface to the dialog so a failed install/relaunch doesn't look like a
    // dead button — the user (and we) can see the actual reason.
    sendToRenderer('update-error', message);
  });

  // Renderer triggers a manual download (used when autoDownload is false).
  ipcMain.handle('start-update-download', () => {
    try { autoUpdater.downloadUpdate(); } catch (e) {
      console.error('downloadUpdate error:', e && e.message);
    }
  });

  // Restart into the freshly downloaded update.
  // isSilent=true  → skip the NSIS re-install wizard on Windows.
  // isForceRunAfter=true → relaunch immediately after install on both platforms.
  ipcMain.handle('restart-and-update', () => {
    // quitAndInstall closes all windows and calls app.quit(). Our before-quit
    // handler would otherwise preventDefault() on unsaved changes and cancel
    // that quit — on macOS that means Squirrel never swaps the app, so it
    // neither relaunches nor applies the update. Allow this quit through; the
    // renderer flushes pending edits before invoking this handler.
    allowQuit = true;
    autoUpdater.quitAndInstall(/* isSilent */ true, /* isForceRunAfter */ true);
  });

  // Always check for updates (even when autoDownload is false, we want to
  // know if a new version exists so we can show the dialog).
  try {
    autoUpdater.checkForUpdates();
  } catch (err) {
    console.error('autoUpdater check failed:', err && err.message);
  }
}

// IPC: filesystem handlers (replace the old Express endpoints). The actual
// logic lives in @lectio/core (semester-store) so it can be tested without Electron.
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

// Native file dialogs for export/import. The renderer calls these to choose a
// destination/source path, then passes the path to the export/import IPC
// handlers in @lectio/core (ipc-handlers).
ipcMain.handle('show-save-dialog', async (event, { defaultName, title }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: title || 'Export',
    defaultPath: defaultName || 'export.lectio.json',
    filters: [{ name: 'Lectio JSON', extensions: ['lectio.json'] }],
  });
  if (canceled || !filePath) return { canceled: true };
  return { canceled: false, filePath };
});

ipcMain.handle('show-open-dialog', async (event, { title }) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: title || 'Import',
    filters: [{ name: 'Lectio JSON', extensions: ['lectio.json'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths.length) return { canceled: true };
  return { canceled: false, filePath: filePaths[0] };
});

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
// Moodle: secure token storage + SSO capture window
//
// One encrypted file holding several accounts, keyed by baseUrl — a Moodle
// instance is the natural unique key here (this is one person's own accounts
// on several instances, not a multi-user handoff). Token
// refresh/expiry/revocation isn't designed yet; this only covers the initial
// SSO-driven capture and secure-at-rest storage of the result.
// ---------------------------------------------------------------------------
const MOODLE_TOKEN_FILE = path.join(app.getPath('userData'), 'moodle-token.enc');

function isMoodleEncryptionAvailable() {
  return safeStorage.isEncryptionAvailable();
}

// The accounts file is encrypted at rest via the OS keychain (Keychain on
// macOS, DPAPI on Windows) through Electron's safeStorage. safeStorage is
// main-process-only, which is why this whole module lives here rather than
// being callable directly from the renderer.
//
// Reads the raw accounts file, transparently migrating Phase 15's old
// single-account shape ({ baseUrl, wstoken }) to the new
// { accounts: [{ baseUrl, wstoken, label }] } shape in memory. The migrated
// shape is NOT written back until the next mutation (addMoodleAccount /
// removeMoodleAccount) — a read-only call never rewrites the file.
function readMoodleAccountsFile() {
  if (!fs.existsSync(MOODLE_TOKEN_FILE)) return { accounts: [] };
  if (!isMoodleEncryptionAvailable()) {
    throw new Error('OS-backed encryption is not available on this machine.');
  }
  const encrypted = fs.readFileSync(MOODLE_TOKEN_FILE);
  const data = JSON.parse(safeStorage.decryptString(encrypted));
  if (Array.isArray(data.accounts)) return data;
  // Old Phase 15 single-account shape.
  if (data.baseUrl && data.wstoken) {
    return { accounts: [{ baseUrl: data.baseUrl, wstoken: data.wstoken, label: undefined }] };
  }
  return { accounts: [] };
}

function writeMoodleAccountsFile(data) {
  if (!isMoodleEncryptionAvailable()) {
    throw new Error('OS-backed encryption is not available on this machine.');
  }
  const encrypted = safeStorage.encryptString(JSON.stringify(data));
  fs.mkdirSync(path.dirname(MOODLE_TOKEN_FILE), { recursive: true });
  fs.writeFileSync(MOODLE_TOKEN_FILE, encrypted);
}

// Accounts WITHOUT their wstoken — safe to hand to the renderer for display
// (Settings list, course-picker account selector) without re-exposing every
// token on every listing call.
function listMoodleAccounts() {
  return readMoodleAccountsFile().accounts.map(({ baseUrl, label }) => ({ baseUrl, label }));
}

// One account's full record (including wstoken), by baseUrl. The renderer
// still builds createMoodleClient() itself (same boundary Phase 15 already
// crossed for the single-account case), so it needs the token on demand.
function getMoodleAccountToken(baseUrl) {
  return readMoodleAccountsFile().accounts.find((a) => a.baseUrl === baseUrl) || null;
}

// Adds a new account, or replaces an existing one with the same baseUrl (a
// reconnect after an expired/invalid token) — exactly one entry per baseUrl.
function addMoodleAccount({ baseUrl, wstoken, label }) {
  const data = readMoodleAccountsFile();
  const idx = data.accounts.findIndex((a) => a.baseUrl === baseUrl);
  const entry = { baseUrl, wstoken, label };
  if (idx === -1) data.accounts.push(entry);
  else data.accounts[idx] = entry;
  writeMoodleAccountsFile(data);
  return { ok: true };
}

function removeMoodleAccount(baseUrl) {
  const data = readMoodleAccountsFile();
  data.accounts = data.accounts.filter((a) => a.baseUrl !== baseUrl);
  writeMoodleAccountsFile(data);
  return { ok: true };
}

// Drives the SSO login in its own window and intercepts the
// moodlemobile://token=... redirect before Electron tries (and fails) to
// actually navigate to it. Resolves with the parsed
// { wstoken, privatetoken, passport? }, or rejects if the user closes the
// window before completing login, or if the redirect couldn't be parsed.
function captureMoodleToken(baseUrl) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const launchUrl = buildLaunchUrl(baseUrl);

    const authWindow = new BrowserWindow({
      width: 480,
      height: 720,
      title: 'Connect Moodle',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    function handleRedirect(event, url) {
      if (settled || !/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/token=/.test(url)) return;
      event.preventDefault();
      settled = true;
      const parsed = parseMoodleMobileRedirect(url);
      authWindow.destroy();
      if (!parsed) {
        reject(new Error('Could not parse the Moodle SSO redirect.'));
        return;
      }
      resolve(parsed);
    }

    authWindow.webContents.on('will-redirect', handleRedirect);
    authWindow.webContents.on('will-navigate', handleRedirect);

    authWindow.on('closed', () => {
      if (!settled) reject(new Error('Moodle sign-in was cancelled.'));
    });

    authWindow.loadURL(launchUrl);
  });
}

ipcMain.handle('moodle-list-accounts', () => listMoodleAccounts());
ipcMain.handle('moodle-get-account-token', (event, baseUrl) => getMoodleAccountToken(baseUrl));
ipcMain.handle('moodle-add-account', (event, { baseUrl, wstoken, label }) => addMoodleAccount({ baseUrl, wstoken, label }));
ipcMain.handle('moodle-remove-account', (event, baseUrl) => removeMoodleAccount(baseUrl));
ipcMain.handle('moodle-capture-token', (event, baseUrl) => captureMoodleToken(baseUrl));

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
