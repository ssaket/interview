/**
 * Streamlined Text Interface - Simplified CodeMirror implementation
 * Combines interface and renderer functionality for better performance and maintainability
 */

const { ipcRenderer } = require('electron');
const { EditorState, Compartment } = require('@codemirror/state');
const { EditorView } = require('@codemirror/view');
const { markdown } = require('@codemirror/lang-markdown');
const { syntaxHighlighting, defaultHighlightStyle } = require('@codemirror/language');
const path = require('path');

// Import formatter for code processing
const InterviewCodeFormatter = require(path.join(__dirname, 'src', 'js', 'formatter'));

class StreamlinedTextInterface {
  constructor(container) {
    this.container = container;
    this.editor = null;

    // Simple state tracking
    this.status = {
      ocr: 'Ready',
      speech: 'Not Ready',
      ai: 'LOCAL',
    };
    this.sessionCount = 0;
    this.aiFlow = 'LOCAL';

    // Streamed AI text waiting for the next animation frame (see streamAIChunk)
    this.pendingChunks = '';
    this.chunkFrame = null;
    // True while the streamed text is inside a ``` code block (see preprocessChunk)
    this.inCodeFence = false;

    // Theme management
    this.isDark = false;
    this.themeCompartment = new Compartment();

    // Editor transparency (0.1 to 1.0)
    this.editorOpacity = 0.6; // Default opacity

    // Syntax highlighting mode: 0=ALL, 1=PYTHON_ONLY
    this.syntaxMode = 0;
    this.syntaxCompartment = new Compartment();

    // Code formatter instance
    this.formatter = new InterviewCodeFormatter();

    // Code-only mode state
    this.isCodeOnlyMode = false;
    this.originalContent = null;

    // OCR flow cancellation flag
    this.ocrFlowCancelled = false;

    // Event listeners for cleanup
    this.eventListeners = [];

    // Simple throttling for updates (single throttle instead of multiple debounce)
    this.updateTimer = null;

    // Status bar management
    this.statusBar = null;
    this.statusBarTimer = null;
    this.lastMessageText = '';

    this.initialize();
  }

  async initialize() {
    try {
      console.log('🚀 Initializing streamlined text interface...');

      // Load preferences
      this.loadPreferences();

      // Create basic CodeMirror editor
      this.createEditor();

      // Setup status bar
      this.statusBar = document.getElementById('status-bar');

      // Setup event handlers
      this.setupEventHandlers();

      // Hide loading screen
      this.hideLoadingScreen();

      console.log('✅ Streamlined text interface ready');
    } catch (error) {
      console.error('❌ Failed to initialize text interface:', error);
      this.showError(error.message);
    }
  }

  loadPreferences() {
    // Load theme
    const savedTheme = localStorage.getItem('codemirror-theme');
    this.isDark = savedTheme ? savedTheme === 'dark' : false;

    // Load editor opacity
    const savedOpacity = localStorage.getItem('codemirror-opacity');
    this.editorOpacity = savedOpacity ? parseFloat(savedOpacity) : 0.6;

    // Load syntax mode
    const savedSyntaxMode = localStorage.getItem('codemirror-syntax-mode');
    this.syntaxMode = savedSyntaxMode ? parseInt(savedSyntaxMode) : 0;
  }

  createEditor() {
    const initialDoc = this.getStatusLine();

    // Essential extensions only
    const extensions = [
      EditorView.lineWrapping,
      this.themeCompartment.of(this.getTheme()),
      this.syntaxCompartment.of(this.getSyntaxHighlighting()),
    ];

    const state = EditorState.create({
      doc: initialDoc,
      extensions: extensions,
    });

    this.editor = new EditorView({
      state,
      parent: this.container,
    });
  }

  getTheme() {
    const baseStyle = {
      height: '100%',
      fontSize: '14px',
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      // overflow: 'hidden',
    };

    const contentStyle = {
      padding: '16px',
      lineHeight: '1.6',
      minHeight: '100%',
    };

    if (this.isDark) {
      return EditorView.theme(
        {
          '&': {
            ...baseStyle,
            backgroundColor: `rgba(13, 17, 23, ${this.editorOpacity})`,
            color: '#e6edf3',
            border: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(8px)',
          },
          // make inner pieces transparent so we only have one background layer
          '.cm-content': {
            ...contentStyle,
            backgroundColor: 'transparent',
            color: 'inherit',
          },
          '.cm-editor': { height: '100%' },
          '.cm-scroller': {
            fontFamily: baseStyle.fontFamily,
            backgroundColor: 'transparent',
            overflow: 'auto', // allow scrolling
            height: '100%',
          },
          // niceties
          '.cm-cursor': { borderLeft: '1px solid #58a6ff' },
          '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
            backgroundColor: '#1f6feb33',
          },
        },
        { dark: true }
      ); // pass dark flag
    } else {
      return EditorView.theme(
        {
          '&': {
            ...baseStyle,
            backgroundColor: `rgba(255, 255, 255, ${this.editorOpacity})`,
            color: '#57729aff',
            border: '1px solid rgba(0,0,0,0.06)',
            backdropFilter: 'blur(8px)',
          },
          '.cm-content': {
            ...contentStyle,
            backgroundColor: 'transparent',
            color: 'inherit',
          },
          '.cm-editor': { height: '100%' },
          '.cm-scroller': {
            fontFamily: baseStyle.fontFamily,
            backgroundColor: 'transparent',
            overflow: 'auto',
            height: '100%',
          },
          '.cm-cursor': { borderLeft: '1px solid #0969da' },
          '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
            backgroundColor: 'rgba(9,105,218,0.16)',
          },
        },
        { dark: false }
      );
    }
  }

  getSyntaxHighlighting() {
    // Simple syntax configuration
    const extensions = [];

    // Add basic syntax highlighting
    extensions.push(syntaxHighlighting(defaultHighlightStyle));

    // Always include Markdown highlighting
    extensions.push(markdown());

    return extensions;
  }

  getStatusLine() {
    return `🔍 OCR: ${this.status.ocr} | 🎤 Speech: ${this.status.speech} | 🧠 AI: ${this.status.ai} | 📊 Session: ${this.sessionCount} messages`;
  }

  setupEventHandlers() {
    console.log('🔧 Setting up event handlers...');

    const addListener = (channel, handler) => {
      ipcRenderer.on(channel, handler);
      this.eventListeners.push({ channel, handler });
    };

    // Core screenshot events
    addListener('trigger-overlay-region-screenshot', () => this.handleScreenshot());
    addListener('trigger-screenshot-region', () => this.handleScreenshot());

    // Speech events
    addListener('speech-status-update', (event, status) => this.updateSpeechStatus(status));
    addListener('transcription-to-editor', (event, data) => this.handleTranscription(data));
    addListener('websocket-connection-status', (event, data) =>
      this.handleWebSocketConnectionStatus(data)
    );

    // AI events
    addListener('ai-processing-started', () => this.startAIProcessing());
    addListener('ai-chunk', (event, chunk) => this.streamAIChunk(chunk));
    addListener('ai-processing-complete', () => this.completeAIProcessing());

    // Session management
    addListener('session-length', (event, length) => {
      this.sessionCount = length;
      this.throttledUpdateStatus();
    });
    addListener('session-reset', () => this.resetSession());

    // UI controls
    addListener('toggle-theme', () => this.toggleTheme());
    addListener('toggle-syntax-highlighting', () => this.toggleSyntaxMode());
    addListener('cycle-ai-flow', () => this.cycleAIFlow());
    addListener('trigger-flow-toggle', () => this.cycleAIFlow()); // Triggered by Opt+Cmd / Alt+Ctrl
    addListener('practice-request', (event, text) => this.sendPracticeRequest(text));
    addListener('increase-transparency', () => this.increaseTransparency());
    addListener('decrease-transparency', () => this.decreaseTransparency());

    // Feature toggles with status messages
    addListener('ocr-filtering-changed', (event, enabled) =>
      this.showMessage(`🔍 OCR Filtering: ${enabled ? 'Enabled' : 'Disabled'}`, 3000)
    );
    addListener('model-switched', (event, data) =>
      this.showMessage(`🔄 Model: ${data.model} (${data.exchanges} exchanges)`, 3500)
    );
    addListener('system-prompts-toggled', (event, data) =>
      this.showMessage(`⚙️ ${data.message}`, 3000)
    );

    // Code-only mode toggle
    addListener('syntax-mode-toggled', (event, data) => this.handleSyntaxModeToggled(data));
    addListener('toggle-help', () => this.toggleHelp());

    // Generic status message handler
    addListener('show-status-message', (event, message, timeout) =>
      this.showMessage(message, timeout || 2000)
    );

    // Scrolling
    addListener('scroll-page', (event, direction) => this.scrollPage(direction));

    // Screenshot stack
    addListener('add-screenshot-to-stack', (event, type) => this.addScreenshotToStack(type));
    addListener('process-screenshot-stack', () => this.processScreenshotStack());
    addListener('clear-screenshot-stack', () => this.clearScreenshotStack());

    // OCR flow cancellation
    addListener('cancel-ocr-flow', () => this.cancelOCRFlow());

    console.log('✅ Event handlers setup complete');
  }

  // Core functionality methods

  async handleScreenshot() {
    // Clear cancellation flag at start of new OCR flow
    this.ocrFlowCancelled = false;

    this.updateOCRStatus('capturing');
    this.showMessage('📸 Capturing region...', 3000);

    try {
      const image = await ipcRenderer.invoke('capture-screen-region');

      // Check if flow was cancelled after screenshot
      if (this.ocrFlowCancelled) {
        this.updateOCRStatus('ready');
        this.showMessage('🛑 OCR flow cancelled', 3000);
        return;
      }

      // Process screenshot with Tesseract OCR
      this.updateOCRStatus('processing');
      this.showMessage('🔍 Running OCR...', 4000);

      const extractedText = await ipcRenderer.invoke('perform-ocr', image, {
        flow: this.aiFlow.toLowerCase(),
      });

      // Check if flow was cancelled after OCR
      if (this.ocrFlowCancelled) {
        this.updateOCRStatus('ready');
        this.showMessage('🛑 OCR flow cancelled', 3000);
        return;
      }

      if (!extractedText || !extractedText.trim()) {
        this.updateOCRStatus('error');
        this.showMessage('❌ No text found in screenshot', 5000);
        setTimeout(() => this.updateOCRStatus('ready'), 3000);
        return;
      }

      this.updateOCRStatus('completed');
      this.startAIResponse();
      await this.queryAI(extractedText);

      setTimeout(() => this.updateOCRStatus('ready'), 2000);
    } catch (error) {
      // Check if error is due to cancellation
      if (this.ocrFlowCancelled) {
        this.updateOCRStatus('ready');
        this.showMessage('🛑 OCR flow cancelled', 3000);
        return;
      }

      this.updateOCRStatus('error');
      this.showMessage(`❌ Screenshot error: ${error.message}`, 5000);
      setTimeout(() => this.updateOCRStatus('ready'), 3000);
    }
  }

  handleTranscription(data) {
    if (!data.text || !data.text.trim()) return;

    const currentContent = this.getContent();
    const separator = currentContent && !currentContent.endsWith(' ') ? ' ' : '';
    const formattedText = `${separator}${data.text.trim()}`;

    this.appendContent(formattedText, false);
    this.showMessage(`📝 Voice text added: "${data.text.trim()}"`, 3000);

    this.updateSpeechStatus('completed');
    setTimeout(() => this.updateSpeechStatus('ready'), 2000);
  }

  async queryAI(text) {
    return await ipcRenderer.invoke('ask-chatgpt', text, {
      flow: this.aiFlow.toLowerCase(),
      onChunk: true,
    });
  }

  startAIProcessing() {
    this.status.ai = `${this.aiFlow} Processing`;
    this.throttledUpdateStatus();
    this.startAIResponse();
  }

  streamAIChunk(chunk) {
    if (!chunk) return;

    // Coalesce chunks into one editor update per frame - dispatching per token cost ~2.5x
    // the main-thread time while streaming (758ms vs 295ms for a 2.5k-token answer)
    this.pendingChunks += chunk;
    if (!this.chunkFrame) {
      this.chunkFrame = requestAnimationFrame(() => this.flushChunks());
    }
  }

  /**
   * Apply buffered AI chunks to the editor now
   * Called each frame while streaming, and before anything reads or replaces the
   * document so the buffered text is never reordered or lost
   */
  flushChunks() {
    if (this.chunkFrame) {
      cancelAnimationFrame(this.chunkFrame);
      this.chunkFrame = null;
    }
    if (!this.pendingChunks || !this.editor) return;

    // Preprocess the whole batch so escape sequences split across chunks still convert
    const processedChunk = this.preprocessChunk(this.pendingChunks);
    this.pendingChunks = '';

    // Preserve scroll position to prevent auto-scroll
    const scroller = this.editor.scrollDOM;
    const scrollTop = scroller ? scroller.scrollTop : 0;

    const docLength = this.editor.state.doc.length;
    this.editor.dispatch({
      changes: { from: docLength, to: docLength, insert: processedChunk },
    });

    // Restore scroll position (prevent auto-scroll)
    if (scroller) {
      scroller.scrollTop = scrollTop;
    }
  }

  /**
   * Clean streamed text before it goes into the editor. Text in ``` code blocks stays as is:
   * in Go, "\n" in a string or rune is code, not a line break. The fence state continues
   * from one batch to the next, and startAIResponse() resets it
   */
  preprocessChunk(chunk) {
    return chunk
      .split('```')
      .map((part, index) => {
        if (index > 0) this.inCodeFence = !this.inCodeFence;
        return this.inCodeFence ? part : this.preprocessProse(part);
      })
      .join('```');
  }

  /**
   * Clean text outside code blocks. Models sometimes write a literal \n, <br> or an HTML
   * entity in markdown table cells
   */
  preprocessProse(text) {
    // Convert literal \n to actual newlines
    let processed = text.replace(/\\n/g, '\n');

    // Convert <br> tags to newlines
    processed = processed.replace(/<br\s*\/?>/gi, '\n');

    // Convert common HTML entities
    processed = processed
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    return processed;
  }

  completeAIProcessing() {
    this.flushChunks(); // Show the final tokens now rather than on the next frame
    this.status.ai = this.aiFlow;
    this.throttledUpdateStatus();

    // Check for math formulas and notify user
    this.detectAndNotifyMathFormulas();
  }

  startAIResponse() {
    // Clear code-only mode when starting new AI response
    this.isCodeOnlyMode = false;
    this.originalContent = null;
    this.inCodeFence = false; // A new response starts outside a code block

    const currentDoc = this.getContent();
    const lines = currentDoc.split('\n');

    // Find current status line
    let statusLine = this.getStatusLine();
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('🔍 OCR:')) {
        statusLine = lines[i];
        break;
      }
    }

    // Preserve scroll position before clearing content
    const scroller = this.editor.scrollDOM;
    const scrollTop = scroller ? scroller.scrollTop : 0;

    // Clear to just status and AI response header
    const newContent = `${statusLine}

## AI Response
`;
    this.setContent(newContent);

    // Restore scroll position after CodeMirror finishes view updates
    if (scroller) {
      requestAnimationFrame(() => {
        scroller.scrollTop = scrollTop;
      });
    }
  }

  // Status management

  updateOCRStatus(status) {
    const statusMap = {
      capturing: 'Capturing',
      processing: 'Processing',
      completed: 'Completed',
      error: 'Error',
      ready: 'Ready',
    };
    this.status.ocr = statusMap[status] || status;
    this.throttledUpdateStatus();
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
    this.throttledUpdateStatus();
  }

  handleWebSocketConnectionStatus(data) {
    const { clientCount } = data;
    // Update speech status based on WebSocket connection
    if (clientCount === 0) {
      this.status.speech = 'Not Ready';
    } else {
      // Only set to Ready if not already in an active state
      if (
        this.status.speech === 'Not Ready' ||
        this.status.speech === 'Ready' ||
        this.status.speech === 'Completed'
      ) {
        this.status.speech = 'Ready';
      }
    }
    this.throttledUpdateStatus();
  }

  throttledUpdateStatus() {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }

    this.updateTimer = setTimeout(() => {
      this.updateStatusInDocument();
    }, 100);
  }

  updateStatusInDocument() {
    const statusLine = this.getStatusLine();
    const currentDoc = this.getContent();
    const lines = currentDoc.split('\n');

    // Find and replace status line (works for both OCR and Vision modes)
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('🔍 OCR:') || lines[i].startsWith('👁️ Vision:')) {
        lines[i] = statusLine;

        // Preserve scroll position before updating content
        const scroller = this.editor.scrollDOM;
        const scrollTop = scroller ? scroller.scrollTop : 0;

        this.setContent(lines.join('\n'));

        // Restore scroll position after CodeMirror finishes view updates
        if (scroller) {
          requestAnimationFrame(() => {
            scroller.scrollTop = scrollTop;
          });
        }
        break;
      }
    }
  }

  // UI Controls

  toggleTheme() {
    this.isDark = !this.isDark;
    localStorage.setItem('codemirror-theme', this.isDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', this.isDark ? 'dark' : 'light');

    this.editor.dispatch({
      effects: this.themeCompartment.reconfigure(this.getTheme()),
    });

    this.showMessage(`🎨 Theme: ${this.isDark ? 'Dark' : 'Light'}`, 3000);
  }

  toggleSyntaxMode() {
    this.syntaxMode = (this.syntaxMode + 1) % 2;
    localStorage.setItem('codemirror-syntax-mode', this.syntaxMode.toString());

    this.editor.dispatch({
      effects: this.syntaxCompartment.reconfigure(this.getSyntaxHighlighting()),
    });
  }

  increaseTransparency() {
    // Decrease opacity (more transparent)
    this.editorOpacity = Math.max(0.1, this.editorOpacity - 0.1);
    this.editorOpacity = Math.round(this.editorOpacity * 10) / 10; // Round to 1 decimal
    localStorage.setItem('codemirror-opacity', this.editorOpacity.toString());

    this.editor.dispatch({
      effects: this.themeCompartment.reconfigure(this.getTheme()),
    });

    const percent = Math.round(this.editorOpacity * 100);
    this.showMessage(`🔍 Transparency: ${100 - percent}% (Opacity: ${percent}%)`, 2500);
  }

  decreaseTransparency() {
    // Increase opacity (less transparent)
    this.editorOpacity = Math.min(1.0, this.editorOpacity + 0.1);
    this.editorOpacity = Math.round(this.editorOpacity * 10) / 10; // Round to 1 decimal
    localStorage.setItem('codemirror-opacity', this.editorOpacity.toString());

    this.editor.dispatch({
      effects: this.themeCompartment.reconfigure(this.getTheme()),
    });

    const percent = Math.round(this.editorOpacity * 100);
    this.showMessage(`🔍 Transparency: ${100 - percent}% (Opacity: ${percent}%)`, 2500);
  }

  cycleAIFlow() {
    const flows = ['LOCAL', 'CLOUD', 'HYBRID', 'STEPS', 'PRACTICE'];
    const currentIndex = flows.indexOf(this.aiFlow);
    const nextIndex = (currentIndex + 1) % flows.length;
    this.aiFlow = flows[nextIndex];

    this.status.ai = this.aiFlow;
    this.throttledUpdateStatus();
    this.showMessage(`🔄 AI Flow: ${this.aiFlow}`, 3000);
  }

  async sendPracticeRequest(text) {
    if (this.aiFlow !== 'PRACTICE') {
      this.showMessage('🎓 Hints only work in PRACTICE flow', 3000);
      return;
    }

    // Sent mid-OCR or mid-stream, the hint would interleave with that request in the
    // same practice session and both answers would stream into the editor at once
    const ocrBusy = this.status.ocr === 'Capturing' || this.status.ocr === 'Processing';
    if (ocrBusy || this.status.ai.endsWith('Processing')) {
      this.showMessage('⏳ Wait for the current response to finish', 2500);
      return;
    }

    try {
      await this.queryAI(text);
    } catch (error) {
      this.showMessage(`❌ Practice request failed: ${error.message}`, 5000);
    }
  }

  resetSession() {
    this.sessionCount = 0;
    this.throttledUpdateStatus();
    this.setContent(this.getStatusLine());
    this.showMessage('🔄 Session reset', 3000);
  }

  toggleHelp() {
    const currentContent = this.getContent();

    if (currentContent.includes('# DeepSeek Overlay Helper - Text Interface')) {
      // Hide help - return to status
      this.setContent(this.getStatusLine());
    } else {
      // Show help
      const helpContent = this.getHelpContent();
      this.setContent(helpContent);
    }
  }

  getHelpContent() {
    const timestamp = new Date().toLocaleTimeString();
    const mod = process.platform === 'darwin' ? '⌘' : 'Ctrl';
    return `# DeepSeek Overlay Helper - Text Interface
Initialized at ${timestamp}

## Status
${this.getStatusLine()}

## Quick Start Guide
This text interface provides AI-powered coding interview assistance with comprehensive status message feedback.

### Core Functions
${mod}+Q - Quit application
${mod}+Z - Region screenshot → OCR → AI analysis
${mod}+B - Hide/show application
${mod}+R - Reset AI session
${mod}+S - Cycle window positions (top-left → top-right → center → bottom-left → bottom-right)
${mod}+Arrow Keys - Move window (hold for continuous)

### Screenshot Stack Workflow
${mod}+1 - Add region screenshot to stack
${mod}+2 - Process screenshot stack
${mod}+3 - Clear screenshot stack

### AI Controls
Opt+${mod} - Cycle AI flows (LOCAL → CLOUD → HYBRID → STEPS → PRACTICE)
${mod}+Shift+R - Master Reset (recover from any error)
${mod}+Shift+O - Toggle OCR filtering
${mod}+Shift+T - Cycle interview type (DSA → System Design → LLD)

### Interface Controls
${mod}+Shift+D - Toggle dark/light theme
${mod}+Shift+L - Toggle code-only view (extract Go code)
${mod}+Shift+I - Developer tools
${mod}+Shift+/ - Toggle window size (default ⟷ fullscreen)
F1 - Toggle this help guide
F11 - Toggle window size (alternative shortcut)

### Window Adjustments
${mod}+Shift+Up/Down - Resize height (hold for continuous)
${mod}+Shift+[ ] - Resize width (hold for continuous)
${mod}+Shift++/- - Adjust CodeMirror transparency

### Page Scrolling
Alt/Opt+Z - Scroll page up
Alt/Opt+X - Scroll page down

### Model Management
${mod}+Shift+M - Switch Ollama model
${mod}+Shift+Y - Toggle system prompts
${mod}+Shift+W - Warmup Ollama model

### Practice Flow (guided hints)
Screenshot a problem → Hint 1 + skeleton with TODO gaps
Screenshot your own code → review that points at the bug without fixing it
${mod}+Shift+H - Next hint (3 hints, then the full solution)
${mod}+Shift+S - Reveal full solution

### Math Formula Support
- LaTeX formulas supported: $O(n)$, $O(log n)$, $$T(n) = 2T(n/2) + O(n)$$
- Examples: Time complexity $O(n^2)$, Space complexity $O(1)$
- Note: Math formulas display best in browser-based conversation history viewer

**Status Messages:** All operations now show visual feedback (3 seconds, queued)

Ready for your coding interview assistance!

---

Activity log:
`;
  }

  scrollPage(direction) {
    const scroller = this.editor.scrollDOM;
    if (!scroller) return;

    const scrollAmount = scroller.clientHeight * 0.2;

    if (direction === 'up') {
      scroller.scrollTop = Math.max(0, scroller.scrollTop - scrollAmount);
    } else if (direction === 'down') {
      scroller.scrollTop = Math.min(
        scroller.scrollHeight - scroller.clientHeight,
        scroller.scrollTop + scrollAmount
      );
    }
  }

  // Screenshot stack operations
  async addScreenshotToStack(type) {
    this.showMessage(`📸 Adding ${type} screenshot...`, 2500);

    try {
      const result = await ipcRenderer.invoke('add-screenshot-to-stack', type);
      if (result.success) {
        this.showMessage(`✅ Added to stack (${result.count} total)`, 3000);
      } else {
        this.showMessage(`❌ Failed: ${result.error}`, 3000);
      }
    } catch (error) {
      this.showMessage(`❌ Stack error: ${error.message}`, 3000);
    }
  }

  async processScreenshotStack() {
    // Clear cancellation flag at start of stack processing
    this.ocrFlowCancelled = false;

    this.showMessage('📸 Processing screenshot stack...', 3000);

    try {
      const result = await ipcRenderer.invoke('process-screenshot-stack', {
        flow: this.aiFlow.toLowerCase(),
      });

      // Check if flow was cancelled after processing
      if (this.ocrFlowCancelled) {
        this.showMessage('🛑 Stack processing cancelled', 3000);
        return;
      }

      if (result.success) {
        this.status.ocr = 'Processing Stack';
        this.startAIProcessing();
        await this.queryAI(result.text);
      } else {
        this.showMessage(`❌ Processing failed: ${result.error}`, 3000);
      }
    } catch (error) {
      // Check if error is due to cancellation
      if (this.ocrFlowCancelled) {
        this.showMessage('🛑 Stack processing cancelled', 3000);
        return;
      }

      this.showMessage(`❌ Stack error: ${error.message}`, 3000);
    }
  }

  async clearScreenshotStack() {
    try {
      const result = await ipcRenderer.invoke('clear-screenshot-stack');
      if (result.success) {
        this.showMessage('✅ Stack cleared', 3000);
      }
    } catch (error) {
      this.showMessage(`❌ Clear error: ${error.message}`, 3000);
    }
  }

  // OCR flow cancellation
  cancelOCRFlow() {
    console.log('[TextInterface] OCR flow cancellation received');
    this.ocrFlowCancelled = true;
    this.updateOCRStatus('ready');
    this.showMessage('🛑 OCR flow cancelled', 3000);
  }

  // Content management

  setContent(content) {
    if (!this.editor) return;
    this.flushChunks(); // Buffered stream text belongs to the document being replaced

    const docLength = this.editor.state.doc.length;
    if (this.editor.state.doc.toString() === content) return;

    this.editor.dispatch({
      changes: { from: 0, to: docLength, insert: content },
    });
  }

  getContent() {
    if (!this.editor) return '';
    this.flushChunks(); // Callers read-modify-write the document; include buffered stream text
    return this.editor.state.doc.toString();
  }

  appendContent(content, addSeparator = true, autoScroll = false) {
    if (!this.editor || !content) return;
    this.flushChunks(); // Keep buffered stream text ahead of the appended content

    const separator = addSeparator ? '\n\n' : '';
    const insertText = separator + content;
    const docLength = this.editor.state.doc.length;

    const changes = { from: docLength, to: docLength, insert: insertText };

    // Only auto-scroll for AI streaming, not for status messages
    if (autoScroll) {
      this.editor.dispatch({
        changes,
        effects: EditorView.scrollIntoView(docLength + insertText.length, { y: 'end' }),
      });
    } else {
      this.editor.dispatch({ changes });
    }
  }

  // Math formula detection and notification

  detectAndNotifyMathFormulas() {
    const text = this.getContent();
    if (!text) return;

    // LaTeX formula patterns
    const blockMathRegex = /\$\$([^$]+)\$\$/g;
    const inlineMathRegex = /(?<!\$)\$([^$\n]+)\$(?!\$)/g;

    let blockMathCount = 0;
    let inlineMathCount = 0;

    // Count block math formulas
    let match;
    while ((match = blockMathRegex.exec(text)) !== null) {
      if (match[1].trim()) blockMathCount++;
    }

    // Count inline math formulas
    while ((match = inlineMathRegex.exec(text)) !== null) {
      if (match[1].trim()) inlineMathCount++;
    }

    // Show notification if math formulas detected
    if (blockMathCount > 0 || inlineMathCount > 0) {
      const mathSummary = [];
      if (inlineMathCount > 0) mathSummary.push(`${inlineMathCount} inline math`);
      if (blockMathCount > 0) mathSummary.push(`${blockMathCount} display math`);

      this.showMessage(
        `📐 LaTeX Math detected: ${mathSummary.join(', ')} - Use browser view for rendered formulas`,
        4000
      );
    }
  }

  // Code-only mode functionality

  handleSyntaxModeToggled(data) {
    console.log('[TextInterface] Syntax mode toggled:', data);

    if (data.mode === 'CODE_ONLY') {
      this.showCodeOnlyContent();
    } else {
      this.restoreOriginalContent();
    }
  }

  showCodeOnlyContent() {
    const currentContent = this.getContent();

    if (!currentContent || !currentContent.trim()) {
      this.showMessage('⚠️ No content to filter', 3000);
      return;
    }

    // Store original content
    this.originalContent = currentContent;
    this.isCodeOnlyMode = true;

    try {
      // Extract Go code using formatter
      const codeResult = this.formatter.formatResponse(currentContent, true, true);

      if (!codeResult.hasCode || !codeResult.text || !codeResult.text.trim()) {
        this.showMessage('⚠️ No Go code blocks found', 3000);
        // Restore state
        this.isCodeOnlyMode = false;
        this.originalContent = null;
        return;
      }

      // Update content to show only code
      this.setContent(codeResult.text);
      this.showMessage('🔍 Code-only view enabled', 3000);
    } catch (error) {
      console.error('Failed to extract code:', error);
      this.showMessage('❌ Failed to process content', 3000);
      // Restore state
      this.isCodeOnlyMode = false;
      this.originalContent = null;
    }
  }

  restoreOriginalContent() {
    if (!this.originalContent) {
      this.showMessage('⚠️ No original content to restore', 3000);
      return;
    }

    this.setContent(this.originalContent);
    this.isCodeOnlyMode = false;
    this.originalContent = null;

    this.showMessage('📄 Full content restored', 3000);
  }

  // Utility methods

  showMessage(message, timeout = 3000) {
    if (!this.statusBar) return;

    // If same message, just restart the timer
    if (this.lastMessageText === message) {
      if (this.statusBarTimer) {
        clearTimeout(this.statusBarTimer);
      }
      this.statusBarTimer = setTimeout(() => this.hideStatusBar(), timeout);
      return;
    }

    // Update status bar with new message
    this.lastMessageText = message;
    this.statusBar.textContent = message;
    this.statusBar.classList.add('visible');

    // Clear existing timer
    if (this.statusBarTimer) {
      clearTimeout(this.statusBarTimer);
    }

    // Auto-hide after timeout
    this.statusBarTimer = setTimeout(() => this.hideStatusBar(), timeout);
  }

  hideStatusBar() {
    if (!this.statusBar) return;

    this.statusBar.classList.remove('visible');
    this.lastMessageText = '';

    // Clear content after fade animation completes
    setTimeout(() => {
      if (!this.statusBar.classList.contains('visible')) {
        this.statusBar.textContent = '';
      }
    }, 300);
  }

  hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.style.display = 'none';
    }
  }

  showError(message) {
    this.container.innerHTML = `
      <div style="padding: 20px; color: #d63031; font-family: monospace; background: #fff5f5; border: 1px solid #ff6b6b; border-radius: 8px; margin: 20px;">
        <h2>❌ Text Interface Error</h2>
        <p><strong>Message:</strong> ${message}</p>
        <p><strong>Action:</strong> Check console and try refreshing.</p>
      </div>
    `;
  }

  destroy() {
    // Clean up event listeners
    this.eventListeners.forEach(({ channel, handler }) => {
      ipcRenderer.removeListener(channel, handler);
    });
    this.eventListeners = [];

    // Clear timers
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }
    if (this.statusBarTimer) {
      clearTimeout(this.statusBarTimer);
    }

    // Clear status bar
    if (this.statusBar) {
      this.statusBar.classList.remove('visible');
      this.statusBar.textContent = '';
    }

    // Destroy editor
    if (this.editor) {
      this.editor.destroy();
      this.editor = null;
    }
  }
}

// Initialize when DOM is ready
let textInterface = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('🚀 Starting streamlined text interface...');

    const container = document.getElementById('codemirror-container');
    if (!container) {
      throw new Error('Container not found');
    }

    textInterface = new StreamlinedTextInterface(container);

    // Make available for debugging
    window.textInterface = textInterface;

    console.log('✅ Streamlined text interface ready');
  } catch (error) {
    console.error('❌ Failed to initialize text interface:', error);

    const container = document.getElementById('codemirror-container');
    if (container) {
      container.innerHTML = `
        <div style="padding: 20px; color: #d63031; font-family: monospace; background: #fff5f5;">
          <h2>❌ Initialization Error</h2>
          <p><strong>Message:</strong> ${error.message}</p>
          <p><strong>Action:</strong> Check console and refresh</p>
        </div>
      `;
    }
  }
});

module.exports = StreamlinedTextInterface;
