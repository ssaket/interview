const { ipcRenderer } = require('electron');
// --- Unified formatter (DeepSeekFormatter) ---
const path = require('path');
// `__dirname` points to the project root when running inside a <script> tag,
// so jump into the source folder explicitly.
const DeepSeekFormatter = require(path.join(__dirname, 'src', 'js', 'formatter.js'));
const dsFormatter = new DeepSeekFormatter();

// --- UI Controller ---
const UI = {
  get output() {
    return document.getElementById('output');
  },
  get screenshot() {
    return document.getElementById('screenshot');
  },
  get container() {
    return document.getElementById('container');
  },
  get ocrIndicator() {
    return document.getElementById('ocr-filter-indicator');
  },
  get title() {
    return document.querySelector('h2');
  },
  get instructions() {
    return document.querySelectorAll('p');
  },

  get session() {
    return document.getElementById('session-length');
  },

  setOutput(text, timeout = 0) {
    this.output.textContent = text;
    if (timeout > 0) {
      setTimeout(() => {
        if (this.output.textContent === text) {
          this.output.textContent = 'Waiting for action...';
        }
      }, timeout);
    }
  },

  setOutputHTML(html) {
    this.output.innerHTML = html;
  },

  setSession(number) {
    this.session.textContent = `L: ${number}`;
  },

  showScreenshot(src) {
    this.screenshot.src = src;
    this.screenshot.style.display = 'block';
  },

  hideScreenshot() {
    this.screenshot.style.display = 'none';
  },

  hideInstructions() {
    if (this.title) this.title.style.display = 'none';
    this.instructions.forEach((p) => (p.style.display = 'none'));
  },

  showInstructions() {
    if (this.title) this.title.style.display = '';
    this.instructions.forEach((p) => (p.style.display = ''));
  },

  updateOcrIndicator(enabled) {
    if (this.ocrIndicator) {
      this.ocrIndicator.style.display = enabled ? 'inline-block' : 'none';
    }
    ocrFilteringEnabled = enabled;
  },

  hideUI() {
    this.container.style.display = 'none';
  },

  showUI() {
    this.container.style.display = 'block';
  },
};

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

// Function to update OCR filtering indicator
function updateOcrFilterIndicator(enabled) {
  UI.updateOcrIndicator(enabled);
}

// Function to toggle OCR filtering
async function toggleOcrFiltering() {
  const newState = await ipcRenderer.invoke('toggle-ocr-filtering');
  UI.updateOcrIndicator(newState);
  UI.setOutput(`OCR Filtering: ${newState ? 'ON' : 'OFF'}`, 2000);
}

// Initialize OCR filtering state
async function initOcrFilteringState() {
  const state = await ipcRenderer.invoke('get-ocr-filtering-state');
  UI.updateOcrIndicator(state);
}

function saveLastAssistantResponse(response) {
  if (response) {
    localStorage.setItem('lastAssistantResponse', response);
  }
}

function getLastAssistantResponse() {
  return localStorage.getItem('lastAssistantResponse');
}

let formatterEnabled = true;
let lastAssistantResponse = getLastAssistantResponse();

// Listen for formatter toggle from main process
ipcRenderer.on('formatter-toggled', (event, enabled) => {
  formatterEnabled = enabled;
  UI.setOutput(`Formatter: ${enabled ? 'ON' : 'OFF'}`, 1500);

  if (!lastAssistantResponse) return;

  const { text, html } = dsFormatter.formatResponse(lastAssistantResponse, formatterEnabled);
  if (formatterEnabled) {
    UI.setOutputHTML(html);
  } else {
    UI.setOutput(text);
  }
});

async function captureScreenshot(isRegion = false) {
  UI.setOutput(isRegion ? 'Capturing behind overlay...' : 'Capturing screen...');
  const image = isRegion
    ? await ipcRenderer.invoke('capture-screen-region')
    : await ipcRenderer.invoke('capture-screen');

  UI.showScreenshot(image);

  UI.setOutput('Running OCR...');
  const text = await ipcRenderer.invoke('perform-ocr', image);

  UI.setOutput(`Extracted:\n${text}\n\nQuerying model...`);
  const answer = await ipcRenderer.invoke('ask-chatgpt', text);

  lastAssistantResponse = answer;
  saveLastAssistantResponse(answer);

  UI.hideInstructions();
  UI.hideScreenshot();
  const { text: plain, html } = dsFormatter.formatResponse(answer, formatterEnabled);
  if (formatterEnabled) {
    UI.setOutputHTML(html);
  } else {
    UI.setOutput(plain);
  }
}

ipcRenderer.on('trigger-screenshot', async () => {
  await captureScreenshot();
});

ipcRenderer.on('trigger-overlay-region-screenshot', async () => {
  await captureScreenshot(true);
});

// Listen for OCR filtering changes from main process
ipcRenderer.on('ocr-filtering-changed', (event, enabled) => {
  UI.updateOcrIndicator(enabled);
  UI.setOutput(`OCR Filtering: ${enabled ? 'ON' : 'OFF'}`, 2000);
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
  UI.setOutput('🎙️ Recording audio…');
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
      UI.setOutput(`📝 Transcript:\n${transcript}`);
      resolve();
    };
    mediaRecorder.stop();
    UI.setOutput('🎙️ Recording stopped');
  });
}

ipcRenderer.on('start-audio', startAudioCapture);
ipcRenderer.on('stop-audio', stopAudioCapture);

// Listen for hide/show commands
ipcRenderer.on('hide-ui', () => {
  UI.hideUI();
  // document.getElementById("selLayer").style.display = "none";
});
ipcRenderer.on('show-ui', () => {
  UI.showUI();
  // Leave selLayer hidden unless region mode is active
});

// Listen for session reset from keyboard shortcut
ipcRenderer.on('session-reset', () => {
  // Session reset handled in main process, no UI updates needed
  UI.setOutput('Session reset. Ready for new conversation.', 2000);
  UI.setOutputHTML(''); // Clear output
  lastAssistantResponse = null;
});

// Listen for provider switching events
ipcRenderer.on('provider-switching', (event, data) => {
  UI.setOutput(`Switching to ${data.to}... (${data.sessionLength} messages preserved)`);
});

ipcRenderer.on('provider-switched', (event, data) => {
  const providerName = data.isOllama ? 'Ollama' : 'HuggingFace';
  UI.setOutput(
    `✅ Switched to ${providerName} (${data.sessionPreserved} messages preserved)`,
    2000
  );
});

ipcRenderer.on('provider-switch-failed', (event, data) => {
  UI.setOutput(`❌ Switch failed: ${data.error}`, 3000);
});

// Listen for AI processing events
ipcRenderer.on('ai-processing-started', (event, message) => {
  UI.setOutput(message || '🤔 AI Processing...');
});

ipcRenderer.on('ai-processing-complete', (event) => {
  // Processing complete - response will be shown separately
});

// Listen for model warmup events
ipcRenderer.on('model-warmup-started', (event, message) => {
  UI.setOutput(message || '🔥 Warming up model...');
});

// Listen for model switch events
ipcRenderer.on('model-switched', (event, data) => {
  const exchangeText = data.exchanges === 1 ? 'exchange' : 'exchanges';
  UI.setOutput(
    `🔄 Switched to ${data.model}\n💬 Session preserved: ${data.exchanges} ${exchangeText} (${data.sessionLength} messages)`,
    3000
  );
  // ask-chatgpt to answer a question with the new model
  if (data.question) {
    const question = data.question;
    ipcRenderer.invoke('ask-chatgpt', question).then((response) => {
      lastAssistantResponse = response;
      saveLastAssistantResponse(response);
      const { text, html } = dsFormatter.formatResponse(response, formatterEnabled);
      if (formatterEnabled) {
        UI.setOutputHTML(html);
      } else {
        UI.setOutput(text);
      }
    });
  }
});

// Listen for theme toggle event from main process
ipcRenderer.on('toggle-theme', () => {
  toggleTheme();
  const themeText = currentTheme === 'light' ? 'Light' : 'Dark';
  UI.setOutput(`Theme switched to ${themeText}`, 1000);
  // 2) …then put back the last response
  setTimeout(() => {
    if (lastAssistantResponse) {
      const { text, html } = dsFormatter.formatResponse(lastAssistantResponse, formatterEnabled);
      if (formatterEnabled) {
        UI.setOutputHTML(html);
      } else {
        UI.setOutput(text);
      }
    }
  }, 1000);
});

// Listen for session length updates
ipcRenderer.on('session-length', (event, length) => {
  UI.setSession(length);
});

// Listen for page scroll events
ipcRenderer.on('scroll-page', (event, direction) => {
  const scrollAmount = UI.container.clientHeight * 0.2;

  if (direction === 'up') {
    UI.container.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
  } else if (direction === 'down') {
    UI.container.scrollBy({ top: scrollAmount, behavior: 'smooth' });
  }
});

// Initialize OCR filtering state when page loads
document.addEventListener('DOMContentLoaded', () => {
  initOcrFilteringState();
  initTheme();
  if (lastAssistantResponse) {
    const { text, html } = dsFormatter.formatResponse(lastAssistantResponse, formatterEnabled);
    if (formatterEnabled) {
      UI.setOutputHTML(html);
    } else {
      UI.setOutput(text);
    }
  }
  // Auto-hide shortcuts after 2 seconds
  setTimeout(() => {
    const shortcuts = document.getElementById('shortcuts');
    if (shortcuts) shortcuts.style.display = 'none';
  }, 2000);
});
