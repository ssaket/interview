const { ipcRenderer } = require('electron');
// --- Unified formatter (DeepSeekFormatter) ---
const path = require('path');
// `__dirname` points to the project root when running inside a <script> tag,
// so jump into the source folder explicitly.
const DeepSeekFormatter = require(path.join(__dirname, 'src', 'js', 'formatter.js'));
const dsFormatter = new DeepSeekFormatter();

// --- Flow Manager ---
const FlowManager = {
  currentFlow: null,
  flows: {
    SCREENSHOT: 'screenshot',
    SPEECH: 'speech',
    IDLE: 'idle'
  },
  
  aiFlows: {
    LOCAL: 'local',      // Ollama local models only (default)
    CLOUD: 'cloud',      // DeepSeek API only
    HYBRID: 'hybrid'     // Fast local + background DeepSeek append
  },
  
  currentAiFlow: 'local', // Default to local

  setFlow(flowType) {
    if (this.currentFlow !== flowType) {
      this.clearCurrentFlow();
      this.currentFlow = flowType;
      this.activateFlow(flowType);
    }
  },

  clearCurrentFlow() {
    if (this.currentFlow === this.flows.SPEECH) {
      this.clearSpeechFlow();
    } else if (this.currentFlow === this.flows.SCREENSHOT) {
      this.clearScreenshotFlow();
    }
  },

  activateFlow(flowType) {
    // Each flow can initialize its UI state here if needed
    switch(flowType) {
      case this.flows.SPEECH:
        // Speech flow is active - transcription can be shown
        break;
      case this.flows.SCREENSHOT:
        // Screenshot flow is active - hide speech UI
        this.clearSpeechFlow();
        break;
      case this.flows.IDLE:
        // Idle state - both flows can coexist
        break;
    }
  },

  clearSpeechFlow() {
    if (UI.speechIndicator) {
      UI.speechIndicator.style.display = 'none';
    }
    if (UI.transcriptionResults) {
      UI.transcriptionResults.style.display = 'none';
    }
  },

  clearScreenshotFlow() {
    UI.hideScreenshot();
  },

  isFlowActive(flowType) {
    return this.currentFlow === flowType;
  },

  // AI Flow Management
  setAiFlow(aiFlowType) {
    if (Object.values(this.aiFlows).includes(aiFlowType)) {
      this.currentAiFlow = aiFlowType;
      console.log(`[FlowManager] AI flow set to: ${aiFlowType.toUpperCase()}`);
      this.updateAiFlowIndicator(aiFlowType);
    }
  },

  updateAiFlowIndicator(flowType) {
    if (UI.aiFlowIndicator) {
      const colors = {
        [this.aiFlows.LOCAL]: '#44aa44',   // Green for local
        [this.aiFlows.CLOUD]: '#4488ff',   // Blue for cloud
        [this.aiFlows.HYBRID]: '#ff8844'   // Orange for hybrid
      };
      
      const titles = {
        [this.aiFlows.LOCAL]: 'AI Flow: LOCAL (Ollama only)',
        [this.aiFlows.CLOUD]: 'AI Flow: CLOUD (DeepSeek API)',
        [this.aiFlows.HYBRID]: 'AI Flow: HYBRID (Local + DeepSeek)'
      };
      
      UI.aiFlowIndicator.style.backgroundColor = colors[flowType] || colors[this.aiFlows.LOCAL];
      UI.aiFlowIndicator.title = titles[flowType] || titles[this.aiFlows.LOCAL];
    }
  },

  getAiFlow() {
    return this.currentAiFlow;
  },

  async queryAI(text, options = {}) {
    const flowType = this.currentAiFlow;
    
    switch(flowType) {
      case this.aiFlows.LOCAL:
        return await this.queryLocal(text, options);
      
      case this.aiFlows.CLOUD:
        return await this.queryCloud(text, options);
      
      case this.aiFlows.HYBRID:
        return await this.queryHybrid(text, options);
      
      default:
        return await this.queryLocal(text, options);
    }
  },

  async queryLocal(text, options = {}) {
    console.log('[AI Flow] LOCAL: Querying Ollama...');
    UI.setOutput('LOCAL AI: Processing with Ollama local model...');
    
    const answer = await ipcRenderer.invoke('ask-chatgpt', text);
    return answer;
  },

  async queryCloud(text, options = {}) {
    console.log('[AI Flow] CLOUD: Querying DeepSeek API...');
    UI.setOutput('CLOUD AI: Processing with DeepSeek API...');
    
    // Switch to DeepSeek provider temporarily
    const originalProvider = await ipcRenderer.invoke('get-provider-status');
    await ipcRenderer.invoke('switch-to-deepseek');
    
    try {
      const answer = await ipcRenderer.invoke('ask-chatgpt', text);
      return answer;
    } finally {
      // Switch back to original provider if needed
      if (originalProvider.provider !== 'deepseek') {
        await ipcRenderer.invoke('switch-to-ollama');
      }
    }
  },

  async queryHybrid(text, options = {}) {
    console.log('[AI Flow] HYBRID: Fast local + background cloud...');
    UI.setOutput('HYBRID AI: Getting fast local response, DeepSeek processing in background...');
    
    // Fast local prompt - make it more concise for speed
    const fastPrompt = `Brief answer: ${text}`;
    
    // Start local query immediately for fast response
    const localPromise = this.queryLocal(fastPrompt, options);
    
    // Start background DeepSeek query
    const cloudPromise = this.queryCloud(text, options).catch(error => {
      console.warn('[AI Flow] HYBRID: Cloud query failed:', error.message);
      return `\n\n---\n**DeepSeek Error:** ${error.message}`;
    });
    
    // Return local response first
    const localResponse = await localPromise;
    
    // Update UI with local response immediately
    const { text: plainLocal, html: htmlLocal } = dsFormatter.formatResponse(localResponse, formatterEnabled);
    if (formatterEnabled) {
      UI.setOutputHTML(htmlLocal + '\n\n<div style="opacity:0.7;">🔄 DeepSeek processing...</div>');
    } else {
      UI.setOutput(plainLocal + '\n\n🔄 DeepSeek processing...');
    }
    
    // Wait for cloud response and append
    const cloudResponse = await cloudPromise;
    const combinedResponse = `${localResponse}\n\n---\n\n**DeepSeek Analysis:**\n${cloudResponse}`;
    
    return combinedResponse;
  }
};

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

  get stackCount() {
    return document.getElementById('stack-count');
  },

  get speechIndicator() {
    return document.getElementById('speech-indicator');
  },

  get aiFlowIndicator() {
    return document.getElementById('ai-flow-indicator');
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


  updateSpeechStatus(status, message) {
    if (this.speechIndicator) {
      switch(status) {
        case 'recording':
          this.speechIndicator.style.backgroundColor = '#ff4444'; // Red for recording
          this.speechIndicator.style.display = 'inline-block';
          break;
        case 'processing':
          this.speechIndicator.style.backgroundColor = '#ff8800'; // Orange for processing
          this.speechIndicator.style.display = 'inline-block';
          break;
        case 'transcribing':
          this.speechIndicator.style.backgroundColor = '#0088ff'; // Blue for transcribing
          this.speechIndicator.style.display = 'inline-block';
          break;
        case 'completed':
          this.speechIndicator.style.backgroundColor = '#44aa44'; // Green for completed
          this.speechIndicator.style.display = 'inline-block';
          // Hide the indicator after 2 seconds for completed state
          setTimeout(() => {
            if (this.speechIndicator) {
              this.speechIndicator.style.display = 'none';
            }
          }, 2000);
          break;
        case 'error':
          this.speechIndicator.style.backgroundColor = '#aa4444'; // Dark red for error
          this.speechIndicator.style.display = 'inline-block';
          // Hide the indicator after 5 seconds for error state
          setTimeout(() => {
            if (this.speechIndicator) {
              this.speechIndicator.style.display = 'none';
            }
          }, 5000);
          break;
        default:
          this.speechIndicator.style.display = 'none';
      }
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
    if (this.speechIndicator) {
      this.speechIndicator.style.display = 'none';
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
  // Activate screenshot flow
  FlowManager.setFlow(FlowManager.flows.SCREENSHOT);
  
  UI.setOutput(isRegion ? 'Capturing behind overlay...' : 'Capturing screen...');

  const image = isRegion
    ? await ipcRenderer.invoke('capture-screen-region')
    : await ipcRenderer.invoke('capture-screen');

  UI.showScreenshot(image);

  UI.setOutput('Running OCR...');
  const text = await ipcRenderer.invoke('perform-ocr', image);

  const answer = await FlowManager.queryAI(text);

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
  
  // Return to idle state after screenshot processing is complete
  FlowManager.setFlow(FlowManager.flows.IDLE);
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
    FlowManager.queryAI(question).then((response) => {
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
  // Activate screenshot flow
  FlowManager.setFlow(FlowManager.flows.SCREENSHOT);
  
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
      UI.setOutput(`Processing ${result.text.split('---').length} screenshots with AI...`);
      
      const answer = await FlowManager.queryAI(result.text);
      
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
    // Activate speech flow
    FlowManager.setFlow(FlowManager.flows.SPEECH);
    UI.updateSpeechStatus('recording', 'Initializing microphone and beginning audio capture...');
    await ipcRenderer.invoke('start-speech-recording');
  } catch (error) {
    UI.updateSpeechStatus('error', `Failed to start recording: ${error.message}`);
  }
});

ipcRenderer.on('stop-speech-recording', async () => {
  try {
    UI.updateSpeechStatus('processing', 'Stopping recording and preparing audio for transcription...');
    await ipcRenderer.invoke('stop-speech-recording');
  } catch (error) {
    UI.updateSpeechStatus('error', `Failed to stop recording: ${error.message}`);
  }
});

ipcRenderer.on('speech-status-update', (event, status, message) => {
  UI.updateSpeechStatus(status, message);
});

ipcRenderer.on('transcription-received', async (event, transcriptionText, metadata) => {
  // Only show transcription if speech flow is still active or idle
  if (FlowManager.isFlowActive(FlowManager.flows.SPEECH) || FlowManager.currentFlow === FlowManager.flows.IDLE) {
    UI.showTranscription(transcriptionText, metadata);
  }
  
  // Automatically query AI with the transcribed text
  if (transcriptionText && transcriptionText.trim()) {
    try {
      UI.hideInstructions();
      UI.setOutput('QUERYING AI: Processing transcribed speech with AI provider...');
      
      const answer = await FlowManager.queryAI(transcriptionText);
      
      lastAssistantResponse = answer;
      saveLastAssistantResponse(answer);
      
      const { text: plain, html } = dsFormatter.formatResponse(answer, formatterEnabled);
      if (formatterEnabled) {
        UI.setOutputHTML(html);
      } else {
        UI.setOutput(plain);
      }
      
      // After AI response, return to idle state
      FlowManager.setFlow(FlowManager.flows.IDLE);
    } catch (error) {
      UI.setOutput(`❌ AI Query error: ${error.message}`, 3000);
      FlowManager.setFlow(FlowManager.flows.IDLE);
    }
  }
});

ipcRenderer.on('speech-error', (event, error) => {
  UI.updateSpeechStatus('error', error);
});

// AI Flow cycling
ipcRenderer.on('cycle-ai-flow', () => {
  const flows = Object.values(FlowManager.aiFlows);
  const currentIndex = flows.indexOf(FlowManager.currentAiFlow);
  const nextIndex = (currentIndex + 1) % flows.length;
  const nextFlow = flows[nextIndex];
  
  FlowManager.setAiFlow(nextFlow);
  
  // Display flow change notification
  const flowNames = {
    [FlowManager.aiFlows.LOCAL]: 'LOCAL (Ollama only)',
    [FlowManager.aiFlows.CLOUD]: 'CLOUD (DeepSeek API)',
    [FlowManager.aiFlows.HYBRID]: 'HYBRID (Local + DeepSeek)'
  };
  
  UI.setOutput(`AI FLOW: Switched to ${flowNames[nextFlow]}`, 3000);
});

// Initialize OCR filtering state when page loads
document.addEventListener('DOMContentLoaded', () => {
  initOcrFilteringState();
  // Initialize AI flow indicator
  FlowManager.updateAiFlowIndicator(FlowManager.currentAiFlow);
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
