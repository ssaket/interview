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

    // Content storage for code-only toggle
    this.originalContent = null;
    this.isCodeOnlyMode = false;

    // Status tracking
    this.status = {
      ocr: 'Ready',
      speech: 'Ready',
      ai: 'LOCAL',
    };

    // Event listener tracking for cleanup
    this.eventListeners = [];

    // Performance optimizations
    this.statusUpdateDebounced = this.debounce(this.updateStatusDisplay.bind(this), 100);
    this.contentProcessingCache = new Map();
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

    // Helper to track event listeners for cleanup
    const addListener = (channel, handler) => {
      ipcRenderer.on(channel, handler);
      this.eventListeners.push({ channel, handler });
    };

    // Screenshot events (region only)
    addListener('trigger-overlay-region-screenshot', () => this.handleScreenshot());
    addListener('trigger-screenshot-region', () => this.handleScreenshot());

    // Speech events
    addListener('start-speech-recording', () => this.handleSpeechStart());
    addListener('stop-speech-recording', () => this.handleSpeechStop());
    addListener('speech-status-update', (event, status) => this.updateSpeechStatus(status));
    addListener('transcription-received', (event, text, metadata) => {
      this.handleTranscription(text, metadata);
    });

    // AI events
    addListener('ai-chunk', (event, chunk) => this.streamAIResponse(chunk));
    addListener('ai-processing-started', () => this.startAIProcessing());
    addListener('ai-processing-complete', () => this.completeAIProcessing());

    // Session and flow events
    addListener('session-length', (event, length) => {
      this.sessionCount = length;
      this.statusUpdateDebounced();
    });

    addListener('cycle-ai-flow', () => this.cycleAIFlow());
    addListener('session-reset', () => this.resetSession());
    addListener('toggle-theme', () => this.toggleTheme());
    addListener('toggle-syntax-highlighting', () => this.toggleSyntaxHighlighting());
    addListener('toggle-syntax-code-only', () => this.toggleCodeOnlyMode());

    // Syntax mode toggle events
    addListener('syntax-mode-toggled', (event, data) => {
      this.handleSyntaxModeToggled(data);
    });

    // Provider events
    addListener('provider-switched', (event, data) => {
      this.showMessage('info', `✅ Switched to ${data.to}`, { timeout: 2000 });
    });

    addListener('model-switched', (event, data) => {
      this.showMessage('info', `🔄 Model: ${data.model}`, { timeout: 2000 });
    });

    // Error events
    addListener('speech-error', (event, error) => {
      this.updateSpeechStatus('error');
      this.showMessage('error', `❌ Speech error: ${error}`, { persistent: true });
    });

    // Window control
    addListener('hide-ui', () => this.hideInterface());
    addListener('show-ui', () => this.showInterface());

    // Screenshot stack events
    addListener('add-screenshot-to-stack', (event, type) => {
      this.addScreenshotToStack(type);
    });
    addListener('process-screenshot-stack', () => this.processScreenshotStack());
    addListener('clear-screenshot-stack', () => this.clearScreenshotStack());

    // Integrated speech-to-AI events
    addListener('speech-to-ai-started', (event, data) => {
      this.handleSpeechToAIStarted(data);
    });
    addListener('speech-to-ai-completed', (event, data) => {
      this.handleSpeechToAICompleted(data);
    });
    addListener('speech-to-ai-error', (event, data) => {
      this.handleSpeechToAIError(data);
    });

    // Scrolling events
    addListener('scroll-page', (event, direction) => {
      this.handleScrollPage(direction);
    });

    // Help toggle event
    addListener('toggle-help', () => {
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

      // Clear stored content when new AI response starts
      this.originalContent = null;
      this.isCodeOnlyMode = false;

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
    this.statusUpdateDebounced();
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

    // Clear stored content when new AI response starts
    this.originalContent = null;
    this.isCodeOnlyMode = false;

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
    this.statusUpdateDebounced();
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
    this.statusUpdateDebounced();
  }

  streamAIResponse(chunk) {
    if (this.interface) {
      this.interface.streamAIChunk(chunk);
    }
  }

  completeAIProcessing() {
    this.status.ai = this.aiFlow;
    this.statusUpdateDebounced();

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
    this.statusUpdateDebounced();
    this.showMessage('info', `🔄 AI Flow: ${this.aiFlow}`, { timeout: 2000 });
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

        // Clear stored content when new AI response starts
        this.originalContent = null;
        this.isCodeOnlyMode = false;

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

    // Clear code-only mode state
    this.originalContent = null;
    this.isCodeOnlyMode = false;
    this.contentProcessingCache.clear();

    this.statusUpdateDebounced();

    if (this.interface) {
      // Clear all transient messages before clearing content
      this.interface.clearAllTransientMessages();
      this.interface.clearContent();
    }

    this.showMessage('info', '🔄 Session reset - ready for new conversation', { timeout: 3000 });
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

  // Generic status handler to reduce duplication
  createStatusHandler(type) {
    const statusMaps = {
      ocr: {
        capturing: 'Capturing',
        processing: 'Processing',
        completed: 'Completed',
        error: 'Error',
        idle: 'Ready',
      },
      speech: {
        recording: 'Recording',
        processing: 'Processing',
        transcribing: 'Transcribing',
        'ai-processing': 'AI Processing',
        completed: 'Completed',
        error: 'Error',
        idle: 'Ready',
      },
    };

    return {
      update: (status) => {
        const statusMap = statusMaps[type] || {};
        this.status[type] = statusMap[status] || status;
        this.statusUpdateDebounced();
      },
      show: (message, options) => this.showMessage(type, message, options),
    };
  }

  // Performance utilities
  debounce(func, wait) {
    let timeout;
    const debounced = (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
    debounced.cancel = () => clearTimeout(timeout);
    return debounced;
  }

  // Unified message handling
  showMessage(type, message, options = {}) {
    const { persistent = false, timeout = 2000 } = options;

    if (!this.interface) return null;

    const timestamp = new Date().toLocaleTimeString();
    const formattedMessage = `[${timestamp}] ${message}`;

    if (persistent) {
      this.interface.appendContent(formattedMessage, false);
      return null;
    } else {
      return this.interface.appendTransientContent(formattedMessage, timeout, false);
    }
  }

  // Legacy methods for backward compatibility
  showTransientMessage(message, timeout = 2000) {
    return this.showMessage('info', message, { timeout });
  }

  showPersistentMessage(message) {
    return this.showMessage('info', message, { persistent: true });
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

  /* ---------- Code-Only Toggle Functionality ---------- */

  /**
   * Toggle between full content and code-only view
   */
  toggleCodeOnlyMode() {
    if (!this.interface) {
      console.warn('[CodeMirrorRenderer] Interface not available for toggle');
      return;
    }

    try {
      if (this.isCodeOnlyMode) {
        // Restore original content
        this.restoreOriginalContent();
      } else {
        // Switch to code-only mode
        this.showCodeOnlyContent();
      }
    } catch (error) {
      console.error('[CodeMirrorRenderer] Failed to toggle code-only mode:', error);
      this.showMessage('error', '❌ Failed to toggle code view', { timeout: 3000 });
    }
  }

  /**
   * Handle syntax mode toggle event from shortcut manager
   * @param {Object} data - Toggle data with mode information
   */
  handleSyntaxModeToggled(data) {
    console.log('[CodeMirrorRenderer] Syntax mode toggled:', data);

    if (data.mode === 'CODE_ONLY') {
      if (!this.isCodeOnlyMode) {
        this.showCodeOnlyContent();
      }
    } else {
      if (this.isCodeOnlyMode) {
        this.restoreOriginalContent();
      }
    }
  }

  /**
   * Extract and show only code from the current content (async)
   */
  async showCodeOnlyContent() {
    const currentContent = this.interface.getContent();

    if (!currentContent || !currentContent.trim()) {
      this.showMessage('warning', '⚠️ No content to filter', { timeout: 2000 });
      return;
    }

    // Store original content
    this.originalContent = currentContent;

    // Show processing message
    this.showMessage('info', '🔄 Processing content...', { timeout: 1000 });

    try {
      // Extract code asynchronously
      const codeOnlyContent = await this.extractCodeFromContentAsync(currentContent);

      if (!codeOnlyContent || !codeOnlyContent.trim()) {
        this.showMessage('warning', '⚠️ No code blocks found', { timeout: 2000 });
        return;
      }

      // Update content and state
      this.interface.setContent(codeOnlyContent);
      this.isCodeOnlyMode = true;

      this.showMessage('success', '🔍 Code-only view enabled', { timeout: 2000 });
    } catch (error) {
      console.error('Failed to extract code:', error);
      this.showMessage('error', '❌ Failed to process content', { timeout: 3000 });
    }
  }

  /**
   * Restore the original full content
   */
  restoreOriginalContent() {
    if (!this.originalContent) {
      this.showMessage('warning', '⚠️ No original content to restore', { timeout: 2000 });
      return;
    }

    this.interface.setContent(this.originalContent);
    this.isCodeOnlyMode = false;
    this.originalContent = null;

    this.showMessage('success', '📄 Full content restored', { timeout: 2000 });
  }

  /**
   * Extract only code blocks and inline code from content (async with caching)
   * @param {string} content - Full content to filter
   * @returns {Promise<string>} Content with only code
   */
  async extractCodeFromContentAsync(content) {
    // Check cache first
    const cacheKey = this.hashString(content);
    if (this.contentProcessingCache.has(cacheKey)) {
      return this.contentProcessingCache.get(cacheKey);
    }

    return new Promise((resolve) => {
      // Use requestIdleCallback for better performance
      const processContent = () => {
        try {
          const result = this.extractCodeFromContent(content);
          // Cache the result
          this.contentProcessingCache.set(cacheKey, result);
          // Limit cache size
          if (this.contentProcessingCache.size > 50) {
            const firstKey = this.contentProcessingCache.keys().next().value;
            this.contentProcessingCache.delete(firstKey);
          }
          resolve(result);
        } catch (error) {
          console.error('Content processing error:', error);
          resolve('## Processing Error\n\nFailed to extract code from content.');
        }
      };

      // Use requestIdleCallback if available, otherwise setTimeout
      if (window.requestIdleCallback) {
        requestIdleCallback(processContent, { timeout: 1000 });
      } else {
        setTimeout(processContent, 0);
      }
    });
  }

  /**
   * Extract only code blocks and inline code from content (synchronous)
   * @param {string} content - Full content to filter
   * @returns {string} Content with only code
   */
  extractCodeFromContent(content) {
    const lines = content.split('\n');
    const codeLines = [];
    let inCodeBlock = false;
    let codeBlockLanguage = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for fenced code block start
      const codeBlockMatch = line.match(/^```(\w+)?/);
      if (codeBlockMatch) {
        if (!inCodeBlock) {
          // Starting a code block
          inCodeBlock = true;
          codeBlockLanguage = codeBlockMatch[1] || '';
          codeLines.push(
            `## ${codeBlockLanguage ? codeBlockLanguage.toUpperCase() + ' ' : ''}Code Block`
          );
          codeLines.push('```' + codeBlockLanguage);
        } else {
          // Ending a code block
          codeLines.push('```');
          codeLines.push(''); // Add spacing between blocks
          inCodeBlock = false;
          codeBlockLanguage = '';
        }
        continue;
      }

      // If inside code block, include the line
      if (inCodeBlock) {
        codeLines.push(line);
        continue;
      }

      // Check for inline code (lines with backticks)
      if (line.includes('`')) {
        const inlineCodeMatches = line.match(/`([^`]+)`/g);
        if (inlineCodeMatches) {
          codeLines.push(`## Inline Code`);
          inlineCodeMatches.forEach((match) => {
            const code = match.replace(/`/g, '');
            if (code.trim()) {
              codeLines.push(code.trim());
            }
          });
          codeLines.push(''); // Add spacing
        }
        continue;
      }

      // Check for indented code (4+ spaces at start)
      if (line.match(/^    \S/)) {
        // This looks like indented code
        codeLines.push(line);
        continue;
      }
    }

    // If no code found, return a message
    if (codeLines.length === 0) {
      return '## No Code Blocks Found\n\nThe current content does not contain any recognizable code blocks or inline code.';
    }

    return codeLines.join('\n');
  }

  /**
   * Simple hash function for cache keys
   * @param {string} str - String to hash
   * @returns {string} Hash value
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  destroy() {
    // Clean up event listeners
    this.eventListeners.forEach(({ channel, handler }) => {
      ipcRenderer.removeListener(channel, handler);
    });
    this.eventListeners = [];

    // Clear cache
    this.contentProcessingCache.clear();

    // Cancel any pending debounced calls
    if (this.statusUpdateDebounced.cancel) {
      this.statusUpdateDebounced.cancel();
    }

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
