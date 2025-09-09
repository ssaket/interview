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
  get burnModeIndicator() {
    return document.getElementById('burn-mode-indicator');
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

  get stackCount() {
    return document.getElementById('stack-count');
  },

  get speechStatus() {
    return document.getElementById('speech-status');
  },

  get speechStatusText() {
    return document.getElementById('speech-status-text');
  },

  get transcriptionResults() {
    return document.getElementById('transcription-results');
  },

  get transcriptionText() {
    return document.getElementById('transcription-text');
  },

  get transcriptionMeta() {
    return document.getElementById('transcription-meta');
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

  setStackCount(count) {
    if (count > 0) {
      this.stackCount.textContent = `S: ${count}`;
      this.stackCount.style.display = 'inline-block';
    } else {
      this.stackCount.style.display = 'none';
    }
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

  updateBurnModeIndicator(enabled) {
    if (this.burnModeIndicator) {
      this.burnModeIndicator.style.display = enabled ? 'inline-block' : 'none';
    }
  },

  updateSpeechStatus(status, message) {
    if (this.speechStatus && this.speechStatusText) {
      this.speechStatusText.textContent = message;
      this.speechStatus.style.display = 'block';
    }
  },

  showTranscription(text, metadata) {
    if (this.transcriptionResults && this.transcriptionText && this.transcriptionMeta) {
      this.transcriptionText.textContent = text;
      
      let metaInfo = '';
      if (metadata) {
        if (metadata.confidence) {
          metaInfo += `Confidence: ${(metadata.confidence * 100).toFixed(1)}%`;
        }
        if (metadata.duration) {
          metaInfo += ` | Duration: ${metadata.duration.toFixed(1)}s`;
        }
        if (metadata.language) {
          metaInfo += ` | Language: ${metadata.language}`;
        }
      }
      
      this.transcriptionMeta.textContent = metaInfo;
      this.transcriptionResults.style.display = 'block';
    }
  },

  hideSpeechUI() {
    if (this.speechStatus) {
      this.speechStatus.style.display = 'none';
    }
    if (this.transcriptionResults) {
      this.transcriptionResults.style.display = 'none';
    }
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

// Initialize OCR filtering state
async function initOcrFilteringState() {
  const state = await ipcRenderer.invoke('get-ocr-filtering-state');
  UI.updateOcrIndicator(state);
}

//Initialize Burn Mode state
async function initBurnModeState() {
  const state = await ipcRenderer.invoke('get-burn-mode-state');
  UI.updateBurnModeIndicator(state);
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

  // Check burn mode status for better messaging
  const burnModeEnabled = await ipcRenderer.invoke('get-burn-mode-state');

  if (burnModeEnabled) {
    UI.setOutput(`🤖 Querying Ollama (local) + 🔥 DeepSeek (cloud)... \n\nExtracted:\n${text}`);
  } else {
    UI.setOutput(`🤖 Querying Ollama (local)...\n\nExtracted:\n${text}`);
  }

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

// Listen for burn mode changes from main process
ipcRenderer.on('burn-mode-changed', (event, enabled) => {
  UI.updateBurnModeIndicator(enabled);
  if (enabled) {
    UI.setOutput(
      `🔥 Burn Mode: ON\nOCR queries will use both Ollama (local) + DeepSeek (cloud)`,
      3000
    );
  } else {
    UI.setOutput(`🤖 Burn Mode: OFF\nOCR queries will use Ollama (local) only`, 3000);
  }
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
  UI.setOutput(
    `✅ Switched to ${data.to} from ${data.from} (${data.sessionPreserved || 0} messages preserved)`
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

// Listen for movement step changes
ipcRenderer.on('movement-step-changed', (event, step) => {
  UI.setOutput(`Movement step: ${step}px`, 1500);
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

// Listen for page scroll events
ipcRenderer.on('scroll-page', (event, direction) => {
  const scrollAmount = UI.container.clientHeight * 0.2;

  if (direction === 'up') {
    UI.container.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
  } else if (direction === 'down') {
    UI.container.scrollBy({ top: scrollAmount, behavior: 'smooth' });
  }
});

// Handle mouse scroll for movement step adjustment
document.addEventListener('wheel', (event) => {
  // Only handle vertical scrolling with Ctrl/Cmd modifier
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
    event.stopPropagation();

    // Determine scroll direction
    const direction = event.deltaY > 0 ? 'decrease' : 'increase';

    // Send to main process
    ipcRenderer.invoke('adjust-movement-step', direction);
  }
}, { passive: false });

// Stack screenshot functions
async function addScreenshotToStack(type) {
  UI.setOutput(`Adding ${type} screenshot to stack...`);
  
  try {
    const result = await ipcRenderer.invoke('add-screenshot-to-stack', type);
    if (result.success) {
      UI.setOutput(`✅ Added to stack (${result.count} total)`, 2000);
    } else {
      UI.setOutput(`❌ Failed to add: ${result.error}`, 3000);
    }
  } catch (error) {
    UI.setOutput(`❌ Stack error: ${error.message}`, 3000);
  }
}

async function processScreenshotStack() {
  UI.setOutput('Processing screenshot stack...');
  
  try {
    const result = await ipcRenderer.invoke('process-screenshot-stack');
    if (result.success) {
      // Check burn mode status for better messaging
      const burnModeEnabled = await ipcRenderer.invoke('get-burn-mode-state');
      
      if (burnModeEnabled) {
        UI.setOutput(`🤖 Querying Ollama (local) + 🔥 DeepSeek (cloud)... \n\nExtracted from stack:\n${result.text}`);
      } else {
        UI.setOutput(`🤖 Querying Ollama (local)...\n\nExtracted from stack:\n${result.text}`);
      }
      
      const answer = await ipcRenderer.invoke('ask-chatgpt', result.text);
      
      lastAssistantResponse = answer;
      saveLastAssistantResponse(answer);
      
      UI.hideInstructions();
      const { text: plain, html } = dsFormatter.formatResponse(answer, formatterEnabled);
      if (formatterEnabled) {
        UI.setOutputHTML(html);
      } else {
        UI.setOutput(plain);
      }
    } else {
      UI.setOutput(`❌ Processing failed: ${result.error}`, 3000);
    }
  } catch (error) {
    UI.setOutput(`❌ Stack processing error: ${error.message}`, 3000);
  }
}

async function clearScreenshotStack() {
  try {
    const result = await ipcRenderer.invoke('clear-screenshot-stack');
    if (result.success) {
      UI.setOutput('📸 Screenshot stack cleared', 1500);
    }
  } catch (error) {
    UI.setOutput(`❌ Clear error: ${error.message}`, 3000);
  }
}

// Listen for stack screenshot events
ipcRenderer.on('add-screenshot-to-stack', async (event, type) => {
  await addScreenshotToStack(type);
});

ipcRenderer.on('process-screenshot-stack', async () => {
  await processScreenshotStack();
});

ipcRenderer.on('clear-screenshot-stack', async () => {
  await clearScreenshotStack();
});

// Listen for stack updates from main process
ipcRenderer.on('screenshot-stack-updated', (event, data) => {
  UI.setStackCount(data.count);
});

// Speech-to-text event handlers
ipcRenderer.on('start-speech-recording', async () => {
  try {
    UI.updateSpeechStatus('recording', 'Starting speech recording...');
    await ipcRenderer.invoke('start-speech-recording');
  } catch (error) {
    UI.updateSpeechStatus('error', `Failed to start recording: ${error.message}`);
  }
});

ipcRenderer.on('stop-speech-recording', async () => {
  try {
    UI.updateSpeechStatus('processing', 'Stopping recording...');
    await ipcRenderer.invoke('stop-speech-recording');
  } catch (error) {
    UI.updateSpeechStatus('error', `Failed to stop recording: ${error.message}`);
  }
});

ipcRenderer.on('speech-status-update', (event, status, message) => {
  UI.updateSpeechStatus(status, message);
});

ipcRenderer.on('transcription-received', async (event, transcriptionText, metadata) => {
  UI.showTranscription(transcriptionText, metadata);
  
  // Automatically query AI with the transcribed text
  if (transcriptionText && transcriptionText.trim()) {
    try {
      UI.hideInstructions();
      UI.setOutput('🎤 Querying AI with transcribed speech...');
      
      const answer = await ipcRenderer.invoke('ask-chatgpt', transcriptionText);
      
      lastAssistantResponse = answer;
      saveLastAssistantResponse(answer);
      
      const { text: plain, html } = dsFormatter.formatResponse(answer, formatterEnabled);
      if (formatterEnabled) {
        UI.setOutputHTML(html);
      } else {
        UI.setOutput(plain);
      }
    } catch (error) {
      UI.setOutput(`❌ AI Query error: ${error.message}`, 3000);
    }
  }
});

ipcRenderer.on('speech-error', (event, error) => {
  UI.updateSpeechStatus('error', error);
});

// Initialize OCR filtering state when page loads
document.addEventListener('DOMContentLoaded', () => {
  initOcrFilteringState();
  initBurnModeState();
  // Initialize theme and set last response if available
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
