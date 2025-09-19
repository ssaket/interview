const { ipcRenderer } = require('electron');
const path = require('path');
// `__dirname` points to the project root when running inside a <script> tag,
// so jump into the source folder explicitly.
const DeepSeekFormatter = require(path.join(__dirname, 'src', 'js', 'formatter.js'));
const dsFormatter = new DeepSeekFormatter();

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
    return await this._streamingQuery(text, this.currentAiFlow || 'local');
  },

  // Unified streaming query handler for all AI flows
  async _streamingQuery(text, flow) {
    const flowConfig = {
      local: { icon: '🤖', name: 'Local AI' },
      cloud: { icon: '☁️', name: 'Cloud AI' },
      hybrid: { icon: '🚀', name: 'Hybrid AI' }
    };

    const config = flowConfig[flow] || flowConfig.local;
    UI.setOutput(`${config.icon} **${config.name} Processing...**\n\n`);

    const chunkHandler = (event, chunk) => UI.appendOutput(chunk);
    ipcRenderer.on('ai-chunk', chunkHandler);

    try {
      return await ipcRenderer.invoke('ask-chatgpt', text, { flow, onChunk: true });
    } finally {
      ipcRenderer.removeListener('ai-chunk', chunkHandler);
    }
  }
};

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

  appendOutput(text) {
    this.output.textContent += text;
  },

  setOutputHTML(html) {
    this.output.innerHTML = html;
    // Render math formulas after setting HTML content
    this.renderMathFormulas();
  },

  /**
   * Render math formulas using KaTeX
   */
  renderMathFormulas() {
    if (typeof katex === 'undefined') {
      console.warn('KaTeX not loaded, math formulas will not be rendered');
      return;
    }

    // Find all math elements and render them
    const mathElements = this.output.querySelectorAll('.math-inline, .math-block');
    
    mathElements.forEach(element => {
      const formula = element.getAttribute('data-formula');
      const displayMode = element.hasAttribute('data-display');
      
      if (formula) {
        try {
          // Render the math formula directly into the element
          katex.render(formula, element, {
            displayMode: displayMode,
            throwOnError: false,
            strict: false
          });
          
          // Add styling classes
          if (displayMode) {
            element.classList.add('katex-display');
          }
        } catch (error) {
          console.warn('Failed to render math formula:', formula, error);
          // Fallback: show the raw formula
          element.textContent = displayMode ? `$$${formula}$$` : `$${formula}$`;
          element.style.color = '#d63384'; // Bootstrap danger color
          element.title = `Math rendering error: ${error.message}`;
        }
      }
    });
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
        case 'ai-processing':
          this.speechIndicator.style.backgroundColor = '#8800ff'; // Purple for AI processing
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

  UI.setOutput(isRegion ? 'Capturing window area...' : 'Capturing screen...');

  const image = isRegion
    ? await ipcRenderer.invoke('capture-screen-region')
    : await ipcRenderer.invoke('capture-screen');

  UI.showScreenshot(image);

  UI.setOutput('Running OCR...');
  const ocrText = await ipcRenderer.invoke('perform-ocr', image);

  if (!ocrText || !ocrText.trim()) {
    UI.setOutput('❌ No text found in screenshot', 3000);
    FlowManager.setFlow(FlowManager.flows.IDLE);
    return;
  }

  const answer = await FlowManager.queryAI(ocrText);

  lastAssistantResponse = answer;
  saveLastAssistantResponse(answer);

  UI.hideInstructions();
  UI.hideScreenshot();

  // All AI flows now use streaming, so output is already set during streaming
  // Return to idle state after screenshot processing is complete
  FlowManager.setFlow(FlowManager.flows.IDLE);
}

ipcRenderer.on('trigger-screenshot', async () => {
  await captureScreenshot();
});

ipcRenderer.on('trigger-overlay-region-screenshot', async () => {
  await captureScreenshot(true);
});

ipcRenderer.on('trigger-screenshot-region', async () => {
  await captureScreenshot(true);
});

// Listen for OCR filtering changes from main process
ipcRenderer.on('ocr-filtering-changed', (event, enabled) => {
  UI.updateOcrIndicator(enabled);
  UI.setOutput(`OCR Filtering: ${enabled ? 'ON' : 'OFF'}`, 2000);
});



// Listen for hide/show commands
ipcRenderer.on('hide-ui', () => {
  UI.hideUI();
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
  
  // Note: AI processing is now handled automatically by the app-controller's handleSpeechToAI method
  // This avoids duplicate requests and provides better integration with session history
  
  // Return to idle state after showing transcription
  if (transcriptionText && transcriptionText.trim()) {
    FlowManager.setFlow(FlowManager.flows.IDLE);
  }
});

ipcRenderer.on('speech-error', (event, error) => {
  UI.updateSpeechStatus('error', error);
});

// AI Flow cycling
ipcRenderer.on('cycle-ai-flow', () => {
  const flows = ['local', 'cloud', 'hybrid'];
  const currentIndex = flows.indexOf(FlowManager.currentAiFlow);
  const nextIndex = (currentIndex + 1) % flows.length;
  const nextFlow = flows[nextIndex];

  FlowManager.setAiFlow(nextFlow);

  const flowNames = {
    'local': 'LOCAL (Ollama only)',
    'cloud': 'CLOUD (DeepSeek API)',
    'hybrid': 'HYBRID (Local + DeepSeek)'
  };

  UI.setOutput(`AI FLOW: ${flowNames[nextFlow]}`, 3000);
});

// Initialize OCR filtering state when page loads
// Speech-to-AI integrated workflow event handlers
ipcRenderer.on('speech-to-ai-started', (event, data) => {
  console.log('Speech-to-AI workflow started:', data);
  
  // Show speech context indicator
  if (data.hasSessionHistory) {
    UI.setOutput(`🎤💬 Processing speech with conversation context: "${data.text}"`);
  } else {
    UI.setOutput(`🎤 Processing speech with AI: "${data.text}"`);
  }
  
  // Update speech indicator to show AI processing
  UI.updateSpeechStatus('ai-processing', `AI is processing: "${data.text}"`);
});

ipcRenderer.on('speech-to-ai-completed', (event, data) => {
  console.log('Speech-to-AI workflow completed:', data);
  
  // Store the assistant response
  lastAssistantResponse = data.aiResponse;
  saveLastAssistantResponse(data.aiResponse);
  
  // Display the AI response
  UI.hideInstructions();
  const { text: plain, html } = dsFormatter.formatResponse(data.aiResponse, formatterEnabled);
  if (formatterEnabled) {
    UI.setOutputHTML(html);
  } else {
    UI.setOutput(plain);
  }
  
  // Show completion status with confidence
  const confidenceText = data.confidence ? ` (${(data.confidence * 100).toFixed(1)}% confidence)` : '';
  UI.updateSpeechStatus('completed', `✅ Speech processed${confidenceText}`);
  
  // Reset speech indicator after a delay
  setTimeout(() => {
    UI.updateSpeechStatus('idle', 'Speech ready');
  }, 3000);
});

ipcRenderer.on('speech-to-ai-error', (event, data) => {
  console.error('Speech-to-AI workflow error:', data);
  
  UI.setOutput(`❌ Failed to process speech: ${data.error}`, 5000);
  UI.updateSpeechStatus('error', `Failed: ${data.error}`);
  
  // Reset after error display
  setTimeout(() => {
    UI.updateSpeechStatus('idle', 'Speech ready');
  }, 5000);
});

document.addEventListener('DOMContentLoaded', () => {
  initOcrFilteringState();
  // Initialize AI flow indicator
  console.log('[FlowManager] Initializing with AI flow:', FlowManager.currentAiFlow);
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

// Mouse tracking functionality
let mouseTrackingActive = false;

ipcRenderer.on('mouse-tracking-started', () => {
  mouseTrackingActive = true;
  console.log('[Renderer] Mouse tracking started - click anywhere to trigger region screenshot + AI');

  // Add global click listener
  document.addEventListener('click', handleMouseTrackingClick, { once: false });
});

ipcRenderer.on('mouse-tracking-stopped', () => {
  mouseTrackingActive = false;
  console.log('[Renderer] Mouse tracking stopped');

  // Remove click listener
  document.removeEventListener('click', handleMouseTrackingClick);
});

ipcRenderer.on('trigger-screenshot-region-with-ai', async () => {
  console.log('[Renderer] Triggering region screenshot with auto AI query');

  // Use the existing region screenshot workflow
  await captureScreenshot(true);
});

function handleMouseTrackingClick(event) {
  if (!mouseTrackingActive) return;

  console.log('[Renderer] Click detected during mouse tracking');

  // Prevent default click behavior
  event.preventDefault();
  event.stopPropagation();

  // Notify main process to handle the click
  ipcRenderer.send('mouse-tracking-click-detected');
}
