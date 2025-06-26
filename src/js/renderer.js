const { ipcRenderer } = require('electron');

let mediaRecorder,
  audioChunks = [];

// Theme state
let currentTheme = 'light';

// Function to toggle theme
function toggleTheme() {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);
  localStorage.setItem('theme', currentTheme);
}

// Initialize theme from localStorage
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    currentTheme = savedTheme;
    document.documentElement.setAttribute('data-theme', currentTheme);
  }
}

// OCR filtering state
let ocrFilteringEnabled = true;

// Function to format and highlight DeepSeek responses
function formatDeepSeekResponse(text) {
  if (!text) return '';

  // Escape HTML first
  let highlighted = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Highlight code blocks with language labels
  highlighted = highlighted.replace(
    /\[([A-Z]+) CODE\]\n([\s\S]*?)\n\[\/CODE\]/g,
    '<div class="code-section"><div class="code-language">$1</div><pre class="code-block"><code>$2</code></pre></div>'
  );

  // Highlight complexity analysis
  highlighted = highlighted.replace(
    /📊 (.*?(?:Time|Space).*?Complexity.*?O\([^)]+\).*?)$/gm,
    '<div class="complexity-section"><span class="complexity-icon">📊</span><span class="complexity-text">$1</span></div>'
  );

  // Highlight reasoning sections
  highlighted = highlighted.replace(
    /💭 REASONING:\n([\s\S]*?)(?=\n\n|\n$|$)/g,
    '<div class="thinking-section"><div class="thinking-header">💭 Reasoning Process</div><div class="thinking-content">$1</div></div>'
  );

  // Highlight inline code (backticks)
  highlighted = highlighted.replace(/`([^`]+)`/g, '<span class="inline-code">$1</span>');

  // Convert remaining newlines to <br> tags
  highlighted = highlighted.replace(/\n/g, '<br>');

  return `<div class="deepseek-response">${highlighted}</div>`;
}

// Function to update OCR filtering indicator
function updateOcrFilterIndicator(enabled) {
  const indicator = document.getElementById('ocr-filter-indicator');
  if (indicator) {
    indicator.style.display = enabled ? 'inline-block' : 'none';
  }
  ocrFilteringEnabled = enabled;
}

// Function to toggle OCR filtering
async function toggleOcrFiltering() {
  const newState = await ipcRenderer.invoke('toggle-ocr-filtering');
  updateOcrFilterIndicator(newState);
  const output = document.getElementById('output');
  output.textContent = `OCR Filtering: ${newState ? 'ON' : 'OFF'}`;
  setTimeout(() => {
    if (output.textContent.includes('OCR Filtering:')) {
      output.textContent = 'Waiting for action...';
    }
  }, 2000);
}

// Initialize OCR filtering state
async function initOcrFilteringState() {
  const state = await ipcRenderer.invoke('get-ocr-filtering-state');
  updateOcrFilterIndicator(state);
}

async function captureScreenshot(isRegion = false) {
  const output = document.getElementById('output');
  const img = document.getElementById('screenshot');

  output.textContent = isRegion ? 'Capturing behind overlay...' : 'Capturing screen...';
  const image = isRegion
    ? await ipcRenderer.invoke('capture-screen-region')
    : await ipcRenderer.invoke('capture-screen');

  img.src = image;
  img.style.display = 'block';

  output.textContent = 'Running OCR...';
  const text = await ipcRenderer.invoke('perform-ocr', image);

  output.textContent = `Extracted:\n${text}\n\nQuerying model...`;
  const answer = await ipcRenderer.invoke('ask-chatgpt', text);

  // Hide all UI elements except the response
  const title = document.querySelector('h2');
  const instructions = document.querySelectorAll('p');

  if (title) title.style.display = 'none';
  instructions.forEach((p) => (p.style.display = 'none'));
  img.style.display = 'none';

  // Format and highlight the DeepSeek response
  console.info(answer);
  output.innerHTML = formatDeepSeekResponse(answer);
  // Scroll to top when new answer arrives
  container.scrollTop = 0;
}

ipcRenderer.on('trigger-screenshot', async () => {
  await captureScreenshot();
});

ipcRenderer.on('trigger-overlay-region-screenshot', async () => {
  await captureScreenshot(true);
});

// Listen for OCR filtering changes from main process
ipcRenderer.on('ocr-filtering-changed', (event, enabled) => {
  updateOcrFilterIndicator(enabled);
  const output = document.getElementById('output');
  output.textContent = `OCR Filtering: ${enabled ? 'ON' : 'OFF'}`;
  setTimeout(() => {
    if (output.textContent.includes('OCR Filtering:')) {
      output.textContent = 'Waiting for action...';
    }
  }, 2000);
});

// Call this when you want to start recording (e.g. hotkey or button)
async function startAudioCapture() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  audioChunks = [];

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) audioChunks.push(e.data);
  };

  mediaRecorder.start();
  document.getElementById('output').textContent = '🎙️ Recording audio…';
}

// Call this to stop and process the recording
function stopAudioCapture() {
  return new Promise((resolve) => {
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

// Listen for hide/show commands
ipcRenderer.on('hide-ui', () => {
  document.getElementById('container').style.display = 'none';
  // document.getElementById("selLayer").style.display = "none";
});
ipcRenderer.on('show-ui', () => {
  document.getElementById('container').style.display = 'block';
  // Leave selLayer hidden unless region mode is active
});

// Listen for session reset from keyboard shortcut
ipcRenderer.on('session-reset', () => {
  // Session reset handled in main process, no UI updates needed
});

// Listen for provider switching events
ipcRenderer.on('provider-switching', (event, data) => {
  const output = document.getElementById('output');
  output.textContent = `Switching to ${data.to}... (${data.sessionLength} messages preserved)`;
});

ipcRenderer.on('provider-switched', (event, data) => {
  const output = document.getElementById('output');
  const providerName = data.isOllama ? 'Ollama' : 'HuggingFace';
  output.textContent = `✅ Switched to ${providerName} (${data.sessionPreserved} messages preserved)`;

  setTimeout(() => {
    if (output.textContent.includes('Switched to')) {
      output.textContent = 'Waiting for action...';
    }
  }, 2000);
});

ipcRenderer.on('provider-switch-failed', (event, data) => {
  const output = document.getElementById('output');
  output.textContent = `❌ Switch failed: ${data.error}`;

  setTimeout(() => {
    if (output.textContent.includes('Switch failed')) {
      output.textContent = 'Waiting for action...';
    }
  }, 3000);
});

// Listen for AI processing events
ipcRenderer.on('ai-processing-started', (event, message) => {
  const output = document.getElementById('output');
  output.textContent = message || '🤔 AI Processing...';
});

ipcRenderer.on('ai-processing-complete', (event) => {
  // Processing complete - response will be shown separately
});

// Listen for model warmup events
ipcRenderer.on('model-warmup-started', (event, message) => {
  const output = document.getElementById('output');
  output.textContent = message || '🔥 Warming up model...';
});

// Listen for theme toggle event from main process
ipcRenderer.on('toggle-theme', () => {
  toggleTheme();
  const output = document.getElementById('output');
  const themeText = currentTheme === 'light' ? 'Light' : 'Dark';
  output.textContent = `Theme switched to ${themeText}`;
  setTimeout(() => {
    if (output.textContent.includes('Theme switched')) {
      output.textContent = 'Waiting for action...';
    }
  }, 2000);
});

// Listen for page scroll events
ipcRenderer.on('scroll-page', (event, direction) => {
  const container = document.getElementById('container');
  const scrollAmount = container.clientHeight * 0.2;

  if (direction === 'up') {
    container.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
  } else if (direction === 'down') {
    container.scrollBy({ top: scrollAmount, behavior: 'smooth' });
  }
});

// Initialize OCR filtering state when page loads
document.addEventListener('DOMContentLoaded', () => {
  initOcrFilteringState();
  initTheme();
});
