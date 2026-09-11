const { contextBridge, ipcRenderer } = require('electron');

// Bridge for the pomodoro completion popup's OWN renderer (a separate,
// isolated window from the main Lectio window — see main.js's
// showPomodoroPopup). Not to be confused with the `pomodoroPopup` bridge
// exposed to the MAIN window's renderer in preload.js; the two never run in
// the same JS context.
contextBridge.exposeInMainWorld('pomodoroPopup', {
  onData: (callback) => ipcRenderer.on('pomodoro-popup-data', (_e, payload) => callback(payload)),
  // The buttons are whatever the main window sent in `actions`; clicking one
  // relays its id back rather than naming a fixed transition here.
  action: (id) => ipcRenderer.send('pomodoro-popup-action', id),
  dismiss: () => ipcRenderer.send('pomodoro-popup-dismiss'),
});
