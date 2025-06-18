const { ipcRenderer } = require('electron');

let mediaRecorder, audioChunks = [];

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

// Call this when you want to start recording (e.g. hotkey or button)
async function startAudioCapture() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  audioChunks = [];

  mediaRecorder.ondataavailable = e => {
    if (e.data.size > 0) audioChunks.push(e.data);
  };

  mediaRecorder.start();
  document.getElementById('output').textContent = '🎙️ Recording audio…';
}

// Call this to stop and process the recording
function stopAudioCapture() {
  return new Promise(resolve => {
    mediaRecorder.onstop = async () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      // You can play it back:
      const url = URL.createObjectURL(blob);
      new Audio(url).play();

      // Or send it to your main process for saving/transcription:
      const arrayBuffer = await blob.arrayBuffer();
      const base64Audio = Buffer.from(arrayBuffer).toString('base64');
      const transcript = await ipcRenderer.invoke('transcribe-audio', base64Audio);
      document.getElementById('output').textContent = `📝 Transcript:\n${transcript}`;
      resolve();
    };
    mediaRecorder.stop();
    document.getElementById('output').textContent = '🎙️ Recording stopped';
  });
}

ipcRenderer.on('start-audio', startAudioCapture);
ipcRenderer.on('stop-audio', stopAudioCapture);