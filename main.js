const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const fs = require('fs');
const path = require('path');

const SEMESTERS_DIR = path.join(__dirname, 'semesters');

// Reject ids that could escape the semesters directory.
const safeId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id);
const fileFor = (id) => path.join(SEMESTERS_DIR, `${id}.json`);

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

// ---------------------------------------------------------------------------
// IPC: filesystem handlers (replace the old Express endpoints)
// ---------------------------------------------------------------------------
ipcMain.handle('list-semesters', () => {
  const files = fs.readdirSync(SEMESTERS_DIR).filter((f) => f.endsWith('.json'));
  return files.map((f) => {
    const data = JSON.parse(fs.readFileSync(path.join(SEMESTERS_DIR, f), 'utf8'));
    return { id: path.basename(f, '.json'), name: data.name || data.id };
  });
});

ipcMain.handle('get-semester', (event, id) => {
  if (!safeId(id) || !fs.existsSync(fileFor(id))) return null;
  return JSON.parse(fs.readFileSync(fileFor(id), 'utf8'));
});

ipcMain.handle('save-semester', (event, id, data) => {
  if (!safeId(id)) return { ok: false, error: 'Invalid id' };
  fs.writeFileSync(fileFor(id), JSON.stringify(data, null, 2));
  return { ok: true, id };
});

ipcMain.handle('delete-semester', (event, id) => {
  if (!safeId(id) || !fs.existsSync(fileFor(id))) return { ok: false, error: 'Not found' };
  fs.unlinkSync(fileFor(id));
  return { ok: true, id };
});

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
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
