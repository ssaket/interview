const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onTriggerScreenshot: (callback) => ipcRenderer.on('trigger-screenshot', callback),
  getSources: () => ipcRenderer.invoke('get-sources'),
});