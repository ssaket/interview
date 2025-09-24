/**
 * Minimal CodeMirror renderer - fixes extension conflicts
 * Uses the minimal interface to avoid CodeMirror module conflicts
 */

const { ipcRenderer } = require('electron');
const path = require('path');
const CodeMirrorInterface = require(path.join(__dirname, 'src', 'js', 'codemirror-interface'));

class CodeMirrorRenderer {
  constructor() {
    this.interface = null;
    this.sessionCount = 0;
    this.aiFlow = 'LOCAL';

    // Status tracking
    this.status = {
      ocr: 'Ready',
      speech: 'Ready',
      ai: 'LOCAL',
    };
  }

  async initialize() {
    try {
      console.log('🚀 Initializing minimal CodeMirror renderer...');

      const container = document.getElementById('codemirror-container');
      if (!container) {
        throw new Error('CodeMirror container not found');
      }

      // Create CodeMirror interface
      this.interface = new CodeMirrorInterface(container);

      // Setup IPC listeners
      this.setupEventListeners();

      console.log('✅ Minimal CodeMirror renderer initialized');
    } catch (error) {
      console.error('❌ Failed to initialize minimal renderer:', error);
      this.showError(error.message);
    }
  }

  setupEventListeners() {
    console.log('🔧 Setting up IPC event listeners...');

    // Screenshot events (region only)
    ipcRenderer.on('trigger-overlay-region-screenshot', () => this.handleScreenshot());
    ipcRenderer.on('trigger-screenshot-region', () => this.handleScreenshot());

    // Speech events
    ipcRenderer.on('start-speech-recording', () => this.handleSpeechStart());
    ipcRenderer.on('stop-speech-recording', () => this.handleSpeechStop());
    ipcRenderer.on('speech-status-update', (event, status) => this.updateSpeechStatus(status));
    ipcRenderer.on('transcription-received', (event, text, metadata) => {
      this.handleTranscription(text, metadata);
    });

    // AI events
    ipcRenderer.on('ai-chunk', (event, chunk) => this.streamAIResponse(chunk));
    ipcRenderer.on('ai-processing-started', () => this.startAIProcessing());
    ipcRenderer.on('ai-processing-complete', () => this.completeAIProcessing());

    // Session and flow events
    ipcRenderer.on('session-length', (event, length) => {
      this.sessionCount = length;
      this.updateStatusDisplay();
    });

    ipcRenderer.on('cycle-ai-flow', () => this.cycleAIFlow());
    ipcRenderer.on('session-reset', () => this.resetSession());
    ipcRenderer.on('toggle-theme', () => this.toggleTheme());
    ipcRenderer.on('toggle-syntax-highlighting', () => this.toggleSyntaxHighlighting());

    // Provider events
    ipcRenderer.on('provider-switched', (event, data) => {
      this.showTransientMessage(`✅ Switched to ${data.to}`, 2000);
    });

    ipcRenderer.on('model-switched', (event, data) => {
      this.showTransientMessage(`🔄 Model: ${data.model}`, 2000);
    });

    // Error events
    ipcRenderer.on('speech-error', (event, error) => {
      this.updateSpeechStatus('error');
      this.showPersistentMessage(`❌ Speech error: ${error}`);
    });

    // Window control
    ipcRenderer.on('hide-ui', () => this.hideInterface());
    ipcRenderer.on('show-ui', () => this.showInterface());

    // Screenshot stack events
    ipcRenderer.on('add-screenshot-to-stack', (event, type) => {
      this.addScreenshotToStack(type);
    });
    ipcRenderer.on('process-screenshot-stack', () => this.processScreenshotStack());
    ipcRenderer.on('clear-screenshot-stack', () => this.clearScreenshotStack());

    // Integrated speech-to-AI events
    ipcRenderer.on('speech-to-ai-started', (event, data) => {
      this.handleSpeechToAIStarted(data);
    });
    ipcRenderer.on('speech-to-ai-completed', (event, data) => {
      this.handleSpeechToAICompleted(data);
    });
    ipcRenderer.on('speech-to-ai-error', (event, data) => {
      this.handleSpeechToAIError(data);
    });

    // Scrolling events
    ipcRenderer.on('scroll-page', (event, direction) => {
      this.handleScrollPage(direction);
    });

    // Help toggle event
    ipcRenderer.on('toggle-help', () => {
      this.toggleHelp();
    });

    console.log('✅ IPC event listeners setup complete');
  }

  // Screenshot handling (region only)
  async handleScreenshot() {
    this.updateOCRStatus('capturing');
    this.showTransientMessage('📸 Capturing region...', 2000);

    try {
      const image = await ipcRenderer.invoke('capture-screen-region');

      this.updateOCRStatus('processing');
      this.showTransientMessage('🔍 Running OCR...', 3000);

      const ocrText = await ipcRenderer.invoke('perform-ocr', image);

      if (!ocrText || !ocrText.trim()) {
        this.updateOCRStatus('error');
        this.showPersistentMessage('❌ No text found in screenshot');
        setTimeout(() => this.updateOCRStatus('idle'), 3000);
        return;
      }

      this.updateOCRStatus('completed');

      // Update status and start AI processing with complete clearing
      this.status.ai = `${this.aiFlow} Processing`;
      this.updateStatusDisplay();
      this.interface.startAIResponse();

      await this.queryAI(ocrText);

      setTimeout(() => this.updateOCRStatus('idle'), 2000);
    } catch (error) {
      this.updateOCRStatus('error');
      this.showPersistentMessage(`❌ Screenshot error: ${error.message}`);
      setTimeout(() => this.updateOCRStatus('idle'), 3000);
    }
  }

  // Speech handling
  handleSpeechStart() {
    this.updateSpeechStatus('recording');
    this.showTransientMessage('🎤 Recording started...', 1500);
  }

  handleSpeechStop() {
    this.updateSpeechStatus('processing');
    this.showTransientMessage('📝 Processing audio...', 2000);
  }

  updateSpeechStatus(status) {
    const statusMap = {
      recording: 'Recording',
      processing: 'Processing',
      transcribing: 'Transcribing',
      'ai-processing': 'AI Processing',
      completed: 'Completed',
      error: 'Error',
      idle: 'Ready',
    };

    this.status.speech = statusMap[status] || status;
    this.updateStatusDisplay();
  }

  handleTranscription(text, metadata) {
    this.updateSpeechStatus('completed');
    this.showTransientMessage(`📝 Transcribed: "${text}"`, 3000);

    setTimeout(() => {
      this.updateSpeechStatus('idle');
    }, 3000);
  }

  // Integrated speech-to-AI workflow
  handleSpeechToAIStarted(data) {
    this.updateSpeechStatus('ai-processing');

    // Update status and start AI processing with complete clearing
    this.status.ai = `${this.aiFlow} Processing`;
    this.updateStatusDisplay();
    this.interface.startAIResponse();
  }

  handleSpeechToAICompleted(data) {
    this.updateSpeechStatus('completed');
    this.interface.completeAIResponse();
    const confidenceText = data.confidence
      ? ` (${(data.confidence * 100).toFixed(1)}% confidence)`
      : '';
    this.showTransientMessage(`✅ Speech processed${confidenceText}`, 2000);

    setTimeout(() => this.updateSpeechStatus('idle'), 3000);
  }

  handleSpeechToAIError(data) {
    this.updateSpeechStatus('error');
    this.showPersistentMessage(`❌ Speech processing failed: ${data.error}`);

    setTimeout(() => this.updateSpeechStatus('idle'), 5000);
  }

  // OCR status
  updateOCRStatus(status) {
    const statusMap = {
      capturing: 'Capturing',
      processing: 'Processing',
      completed: 'Completed',
      error: 'Error',
      idle: 'Ready',
    };

    this.status.ocr = statusMap[status] || status;
    this.updateStatusDisplay();
  }

  // AI handling
  async queryAI(text) {
    return await ipcRenderer.invoke('ask-chatgpt', text, {
      flow: this.aiFlow.toLowerCase(),
      onChunk: true,
    });
  }

  startAIProcessing() {
    this.status.ai = `${this.aiFlow} Processing`;
    this.updateStatusDisplay();
  }

  streamAIResponse(chunk) {
    if (this.interface) {
      this.interface.streamAIChunk(chunk);
    }
  }

  completeAIProcessing() {
    this.status.ai = this.aiFlow;
    this.updateStatusDisplay();

    if (this.interface) {
      this.interface.completeAIResponse();
    }
  }

  // Flow management
  cycleAIFlow() {
    const flows = ['LOCAL', 'CLOUD', 'HYBRID'];
    const currentIndex = flows.indexOf(this.aiFlow);
    const nextIndex = (currentIndex + 1) % flows.length;
    this.aiFlow = flows[nextIndex];

    this.status.ai = this.aiFlow;
    this.updateStatusDisplay();
    this.showTransientMessage(`🔄 AI Flow: ${this.aiFlow}`, 2000);
  }

  // Screenshot stack operations
  async addScreenshotToStack(type) {
    this.showTransientMessage(`📸 Adding ${type} screenshot to stack...`, 1500);

    try {
      const result = await ipcRenderer.invoke('add-screenshot-to-stack', type);
      if (result.success) {
        this.showTransientMessage(`✅ Added to stack (${result.count} total)`, 2000);
      } else {
        this.showPersistentMessage(`❌ Failed: ${result.error}`);
      }
    } catch (error) {
      this.showPersistentMessage(`❌ Stack error: ${error.message}`);
    }
  }

  async processScreenshotStack() {
    this.showTransientMessage('📸 Processing screenshot stack...', 2000);

    try {
      const result = await ipcRenderer.invoke('process-screenshot-stack');
      if (result.success) {
        const count = result.text.split('---').length;

        // Update status and start AI processing with complete clearing
        this.status.ocr = 'Processing Stack';
        this.status.ai = `${this.aiFlow} Processing`;
        this.updateStatusDisplay();
        this.interface.startAIResponse();

        await this.queryAI(result.text);
      } else {
        this.showPersistentMessage(`❌ Processing failed: ${result.error}`);
      }
    } catch (error) {
      this.showPersistentMessage(`❌ Stack error: ${error.message}`);
    }
  }

  async clearScreenshotStack() {
    try {
      const result = await ipcRenderer.invoke('clear-screenshot-stack');
      if (result.success) {
        this.showTransientMessage('📸 Screenshot stack cleared', 1500);
      }
    } catch (error) {
      this.showPersistentMessage(`❌ Clear error: ${error.message}`);
    }
  }

  // Interface control
  hideInterface() {
    if (this.interface?.container) {
      this.interface.container.style.display = 'none';
    }
  }

  showInterface() {
    if (this.interface?.container) {
      this.interface.container.style.display = 'block';
    }
  }

  resetSession() {
    this.sessionCount = 0;
    this.updateStatusDisplay();

    if (this.interface) {
      // Clear all transient messages before clearing content
      this.interface.clearAllTransientMessages();
      this.interface.clearContent();
    }

    this.showTransientMessage('🔄 Session reset - ready for new conversation', 3000);
  }

  toggleTheme() {
    if (this.interface) {
      this.interface.toggleTheme();
    }
  }

  toggleSyntaxHighlighting() {
    if (this.interface) {
      this.interface.toggleSyntaxHighlighting();
    }
  }

  // Scrolling handling
  handleScrollPage(direction) {
    if (this.interface) {
      this.interface.scrollPage(direction);
    }
  }

  // Help toggle handling
  toggleHelp() {
    if (this.interface) {
      this.interface.toggleHelp();
    }
  }


  // Utility methods
  updateStatusDisplay() {
    if (this.interface) {
      this.interface.updateStatus(
        this.status.ocr,
        this.status.speech,
        this.status.ai,
        this.sessionCount
      );
    }
  }

  showMessage(message) {
    if (this.interface) {
      const timestamp = new Date().toLocaleTimeString();
      this.interface.appendContent(`[${timestamp}] ${message}`, false);
    }
  }

  // Show transient message that auto-removes after timeout
  showTransientMessage(message, timeout = 1000) {
    if (this.interface) {
      const timestamp = new Date().toLocaleTimeString();
      return this.interface.appendTransientContent(`[${timestamp}] ${message}`, timeout, false);
    }
    return null;
  }

  // Show persistent message that stays visible
  showPersistentMessage(message) {
    if (this.interface) {
      const timestamp = new Date().toLocaleTimeString();
      this.interface.appendContent(`[${timestamp}] ${message}`, false);
    }
  }

  showError(message) {
    const container = document.getElementById('codemirror-container');
    if (container) {
      container.innerHTML = `
        <div style="padding: 20px; color: #d63031; font-family: monospace; background: #fff5f5; border: 1px solid #ff6b6b; border-radius: 8px; margin: 20px;">
          <h2>❌ CodeMirror Renderer Error</h2>
          <p><strong>Message:</strong> ${message}</p>
          <p><strong>Suggestion:</strong> This may be due to CodeMirror module conflicts.</p>
          <p><strong>Action:</strong> Try refreshing the application.</p>
          <p><strong>If issue persists:</strong> Check console for detailed error information.</p>
        </div>
      `;
    }
  }

  destroy() {
    if (this.interface) {
      this.interface.destroy();
    }
  }
}

// Initialize when DOM is ready
let renderer = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('🚀 Starting minimal CodeMirror renderer initialization...');

    renderer = new CodeMirrorRenderer();
    await renderer.initialize();

    // Make available for debugging
    window.codeMirrorRenderer = renderer;

    console.log('✅ Minimal CodeMirror renderer ready');
  } catch (error) {
    console.error('❌ Failed to initialize minimal renderer:', error);

    // Show error in container
    const container = document.getElementById('codemirror-container');
    if (container) {
      container.innerHTML = `
        <div style="padding: 20px; color: #d63031; font-family: monospace; background: #fff5f5;">
          <h2>❌ Initialization Error</h2>
          <p><strong>Message:</strong> ${error.message}</p>
          <p><strong>Details:</strong> Failed to initialize CodeMirror renderer</p>
          <p><strong>Action:</strong> Please check the console and try refreshing</p>
        </div>
      `;
    }
  }
});

module.exports = CodeMirrorRenderer;
