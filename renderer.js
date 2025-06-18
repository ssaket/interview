const { ipcRenderer } = require('electron');

ipcRenderer.on('trigger-screenshot', async () => {
  const output = document.getElementById('output');
  const img = document.getElementById('screenshot');

  output.textContent = 'Capturing screen...';
  const image = await ipcRenderer.invoke('capture-screen');
  img.src = image; img.style.display = 'block';

  output.textContent = 'Running OCR...';
  const text = await ipcRenderer.invoke('perform-ocr', image);

  output.textContent = `Extracted:\n${text}\n\nQuerying ChatGPT...`;
  const answer = await ipcRenderer.invoke('ask-chatgpt', text);
  output.textContent = `Q: ${text}\n\nA: ${answer}`;
});