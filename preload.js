const { contextBridge, ipcRenderer } = require('electron');
const Tesseract = require('tesseract.js');

contextBridge.exposeInMainWorld('electronAPI', {
  onTriggerScreenshot: (callback) => ipcRenderer.on('trigger-screenshot', callback),
  getSources: () => ipcRenderer.invoke('get-sources'),
  askChatGPT: (question) => ipcRenderer.invoke('ask-chatgpt', question),
  runOCR: async (image) => {
    const { data: { text } } = await Tesseract.recognize(image, 'eng');
    return text;
  }
});