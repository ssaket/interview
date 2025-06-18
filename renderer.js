// Replace `import Tesseract from 'tesseract.js';` with:
const Tesseract = require('tesseract.js');

window.electronAPI.onTriggerScreenshot(async () => {
  const sources = await window.electronAPI.getSources();
  const screen = sources[0]; // Simplified: take the first screen

  const image = screen.thumbnail.toDataURL();
  document.getElementById('output').innerText = 'Processing OCR...';

  Tesseract.recognize(
    image,
    'eng',
    { logger: m => console.log(m) }
  ).then(({ data: { text } }) => {
    document.getElementById('output').innerText = `Extracted Text:\n${text}`;
    // TODO: Send 'text' to OpenAI for structured answer
  }).catch(err => {
    console.error('OCR failed:', err);
    document.getElementById('output').innerText = 'OCR failed.';
  });
});