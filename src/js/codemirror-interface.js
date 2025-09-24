/**
 * Ultra-minimal CodeMirror implementation - guaranteed to work
 * Removes all complex features to avoid any conflicts
 */

const { EditorState, Compartment } = require('@codemirror/state');
const { EditorView } = require('@codemirror/view');
const { python } = require('@codemirror/lang-python');
const { markdown } = require('@codemirror/lang-markdown');
const { syntaxHighlighting, defaultHighlightStyle } = require('@codemirror/language');

/**
 * Ultra-minimal working CodeMirror interface
 */
class UltraMinimalCodeMirrorInterface {
  constructor(container) {
    this.container = container;
    this.editor = null;
    this.isDark = false;
    this.isHelpVisible = false; // Track help state
    this.syntaxHighlightingEnabled = true; // Track syntax highlighting state

    // Simple 2-mode syntax: 0=ALL, 1=PYTHON_ONLY
    this.syntaxMode = 0;

    // Create compartments for dynamic reconfiguration
    this.themeCompartment = new Compartment();
    this.syntaxCompartment = new Compartment();
    this.languageCompartments = {
      python: new Compartment(),
      markdown: new Compartment(),
    };

    // Debouncing for rapid operations
    this.debounceTimers = new Map();

    // Transient message tracking
    this.transientMessages = new Map(); // messageId -> { startPos, endPos, timer }
    this.messageIdCounter = 0;

    this.initialize();
  }

  initialize() {
    try {
      console.log('🚀 Initializing ultra-minimal CodeMirror...');

      // Load theme preference
      const savedTheme = localStorage.getItem('codemirror-theme');
      this.isDark = savedTheme ? savedTheme === 'dark' : false;

      // Load syntax highlighting preference
      const savedHighlighting = localStorage.getItem('codemirror-syntax-highlighting');
      this.syntaxHighlightingEnabled = savedHighlighting ? savedHighlighting === 'true' : true;

      // Load syntax mode preference
      const savedSyntaxMode = localStorage.getItem('codemirror-syntax-mode');
      this.syntaxMode = savedSyntaxMode ? parseInt(savedSyntaxMode) : 0;

      // Create the simplest possible editor
      const initialDoc = this.getInitialDocument();

      // Create extensions with compartments for dynamic reconfiguration
      const extensions = [
        // Line wrapping (static)
        EditorView.lineWrapping,

        // Dynamic theme compartment
        this.themeCompartment.of(this.getTheme()),

        // Dynamic syntax highlighting compartment
        this.syntaxCompartment.of(syntaxHighlighting(defaultHighlightStyle)),

        // Dynamic language compartments based on mode
        this.languageCompartments.python.of(python()),
        this.languageCompartments.markdown.of(this.syntaxMode === 0 ? markdown() : []),
      ];

      // Create state with dynamic extensions
      const state = EditorState.create({
        doc: initialDoc,
        extensions: extensions,
      });

      // Create editor view
      this.editor = new EditorView({
        state,
        parent: this.container,
      });

      // Hide loading screen
      this.hideLoadingScreen();

      console.log('✅ Ultra-minimal CodeMirror initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize ultra-minimal CodeMirror:', error);
      this.showError(error.message);
    }
  }

  getTheme() {
    if (this.isDark) {
      return EditorView.theme({
        '&': {
          height: '100%',
          fontSize: '14px',
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
          backgroundColor: 'rgba(13, 17, 23, 0.27)',
          color: '#f0f6fc',
          overflow: 'hidden',
        },
        '.cm-content': {
          padding: '16px',
          lineHeight: '1.6',
          minHeight: '100%',
          backgroundColor: 'rgba(13, 17, 23, 0.27)',
          color: '#f0f6fc',
        },
        '.cm-focused': {
          outline: 'none',
        },
        '.cm-editor': {
          height: '100%',
          backgroundColor: 'rgba(13, 17, 23, 0.27)',
        },
        '.cm-scroller': {
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
          backgroundColor: 'rgba(13, 17, 23, 0.27)',
          overflow: 'auto',
        },
      });
    } else {
      return EditorView.theme({
        '&': {
          height: '100%',
          fontSize: '14px',
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
          backgroundColor: 'rgba(255, 255, 255, 0.18)',
          color: '#24292f',
          overflow: 'hidden',
        },
        '.cm-content': {
          padding: '16px',
          lineHeight: '1.6',
          minHeight: '100%',
          backgroundColor: 'rgba(255, 255, 255, 0.18)',
          color: '#24292f',
        },
        '.cm-focused': {
          outline: 'none',
        },
        '.cm-editor': {
          height: '100%',
          backgroundColor: 'rgba(255, 255, 255, 0.18)',
        },
        '.cm-scroller': {
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
          backgroundColor: 'rgba(255, 255, 255, 0.18)',
          overflow: 'auto',
        },
      });
    }
  }

  getInitialDocument() {
    return `🔍 OCR: Ready | 🎤 Speech: Ready | 🧠 AI: LOCAL | 📊 Session: 0 messages`;
  }

  getHelpContent() {
    const timestamp = new Date().toLocaleTimeString();

    // Get current status line from document or use default
    let currentStatusLine =
      '🔍 OCR: Ready | 🎤 Speech: Ready | 🧠 AI: LOCAL | 📊 Session: 0 messages';
    if (this.editor) {
      const currentDoc = this.editor.state.doc.toString();
      const lines = currentDoc.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('🔍 OCR:')) {
          currentStatusLine = lines[i];
          break;
        }
      }
    }

    return `# DeepSeek Overlay Helper - Text Interface
Initialized at ${timestamp}

## Status
${currentStatusLine}

## Quick Start Guide
This text interface provides AI-powered coding interview assistance.

### Core Functions
⌘+A - Region screenshot → OCR → AI analysis
⌘+R - Start voice recording
⌘+T - Stop recording and transcribe

### AI Controls
⌘+Shift+F - Cycle AI flows (LOCAL → CLOUD → HYBRID)
⌘+Shift+R - Reset AI session
⌘+Shift+M - Switch AI model

### Interface Controls
⌘+B - Hide/show application
⌘+Shift+D - Toggle dark/light theme
F1 - Toggle this help guide

### Text Features
- Standard text editing shortcuts work
- Copy/paste supported
- Arrow key navigation
- Text selection with mouse/keyboard

## Status Updates
All operations will be logged below with timestamps.
AI responses will stream in real-time.
OCR results will appear after screenshot processing.

Ready for your coding interview assistance!

---

Activity log:
`;
  }

  // High-performance content management - batch operations and reduce DOM manipulation
  appendContent(content, addSeparator = true) {
    if (!this.editor || !content) return;

    // Batch content updates to avoid multiple renders
    this.debounce(
      'content',
      () => {
        try {
          const separator = addSeparator ? '\n\n' : '\n';
          const insertText = separator + content;
          const docLength = this.editor.state.doc.length;

          // Single transaction for better performance
          this.editor.dispatch({
            changes: { from: docLength, to: docLength, insert: insertText },
            // Batch scroll into view with content change
            effects: EditorView.scrollIntoView(docLength + insertText.length, { y: 'end' }),
          });
        } catch (error) {
          console.warn('Failed to append content:', error);
        }
      },
      16
    ); // 60fps debouncing for smooth updates
  }

  // Transient message system - messages that auto-remove after a timeout
  appendTransientContent(content, timeout = 1000, addSeparator = true) {
    if (!this.editor || !content) return;

    try {
      const separator = addSeparator ? '\n\n' : '\n';
      const insertText = separator + content;
      const docLength = this.editor.state.doc.length;
      const startPos = docLength;
      const endPos = docLength + insertText.length;

      // Generate unique message ID
      const messageId = ++this.messageIdCounter;

      // Insert the message
      this.editor.dispatch({
        changes: { from: docLength, to: docLength, insert: insertText },
        effects: EditorView.scrollIntoView(endPos, { y: 'end' }),
      });

      // Set timer for removal
      const timer = setTimeout(() => {
        this.removeTransientMessage(messageId);
      }, timeout);

      // Track this transient message
      this.transientMessages.set(messageId, {
        startPos,
        endPos,
        timer,
        content: insertText,
      });

      return messageId;
    } catch (error) {
      console.warn('Failed to append transient content:', error);
      return null;
    }
  }

  // Remove a specific transient message
  removeTransientMessage(messageId) {
    if (!this.editor || !this.transientMessages.has(messageId)) return;

    try {
      const messageInfo = this.transientMessages.get(messageId);

      // Clear the timer
      clearTimeout(messageInfo.timer);

      // Find current position of the message by searching for its content
      const currentDoc = this.editor.state.doc.toString();
      const messageContent = messageInfo.content;
      const messageIndex = currentDoc.indexOf(messageContent);

      if (messageIndex !== -1) {
        // Remove the message
        this.editor.dispatch({
          changes: {
            from: messageIndex,
            to: messageIndex + messageContent.length,
            insert: '',
          },
        });
      }

      // Remove from tracking
      this.transientMessages.delete(messageId);
    } catch (error) {
      console.warn('Failed to remove transient message:', error);
      // Still remove from tracking to prevent memory leaks
      this.transientMessages.delete(messageId);
    }
  }

  // Clear all transient messages immediately
  clearAllTransientMessages() {
    for (const messageId of this.transientMessages.keys()) {
      this.removeTransientMessage(messageId);
    }
  }

  setContent(content) {
    if (!this.editor) return;

    try {
      const docLength = this.editor.state.doc.length;

      // Skip if content hasn't changed to avoid unnecessary work
      if (this.editor.state.doc.toString() === content) return;

      // Single efficient transaction
      this.editor.dispatch({
        changes: { from: 0, to: docLength, insert: content },
      });
    } catch (error) {
      console.warn('Failed to set content:', error);
    }
  }

  getContent() {
    if (!this.editor) return '';

    try {
      return this.editor.state.doc.toString();
    } catch (error) {
      console.warn('Failed to get content:', error);
      return '';
    }
  }

  // Status management - find and replace in document
  updateStatus(ocrStatus = 'Ready', speechStatus = 'Ready', aiStatus = 'LOCAL', sessionCount = 0) {
    const statusLine = `🔍 OCR: ${ocrStatus} | 🎤 Speech: ${speechStatus} | 🧠 AI: ${aiStatus} | 📊 Session: ${sessionCount} messages`;

    try {
      const currentDoc = this.editor.state.doc.toString();
      const lines = currentDoc.split('\n');

      // Find the status line and update it
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('🔍 OCR:')) {
          lines[i] = statusLine;
          this.setContent(lines.join('\n'));
          break;
        }
      }
    } catch (error) {
      console.warn('Failed to update status:', error);
    }
  }

  // AI response handling - always clear completely for fresh responses
  startAIResponse(message = 'AI is processing your request...') {
    // Always clear completely - conversation history is on WebSocket page
    this.clearToJustStatus();
  }

  // Clear everything except the current status line with AI response structure ready
  clearToJustStatus() {
    try {
      const currentDoc = this.editor.state.doc.toString();
      const lines = currentDoc.split('\n');

      // Find the current status line
      let statusLine = '🔍 OCR: Ready | 🎤 Speech: Ready | 🧠 AI: LOCAL | 📊 Session: 0 messages';
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('🔍 OCR:')) {
          statusLine = lines[i];
          break;
        }
      }

      // Set up document with status line and proper AI response structure for streaming
      const contentWithResponseStructure = `${statusLine}

## AI Response
`;

      this.setContent(contentWithResponseStructure);
    } catch (error) {
      console.warn('Failed to clear to just status:', error);
    }
  }

  streamAIChunk(chunk) {
    if (!this.editor || !chunk) return;

    try {
      const docLength = this.editor.state.doc.length;

      // High-performance streaming: minimal transaction with batched scrolling
      this.editor.dispatch({
        changes: { from: docLength, to: docLength, insert: chunk },
        // Only scroll every few chunks to reduce DOM manipulation
        effects:
          docLength % 100 === 0
            ? EditorView.scrollIntoView(docLength + chunk.length, { y: 'end' })
            : [],
      });
    } catch (error) {
      console.warn('Failed to stream chunk:', error);
    }
  }

  completeAIResponse() {
    this.appendContent('', false);
  }

  // Debounced operation helper for rapid toggles
  debounce(key, operation, delay = 100) {
    // Clear existing timer
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key));
    }

    // Set new timer
    const timer = setTimeout(() => {
      operation();
      this.debounceTimers.delete(key);
    }, delay);

    this.debounceTimers.set(key, timer);
  }

  // High-performance theme toggle using dynamic reconfiguration
  toggleTheme() {
    if (!this.editor) return;

    this.isDark = !this.isDark;

    // Debounce rapid theme toggles
    this.debounce('theme', () => {
      try {
        // Save preference
        localStorage.setItem('codemirror-theme', this.isDark ? 'dark' : 'light');

        // Update document theme
        document.documentElement.setAttribute('data-theme', this.isDark ? 'dark' : 'light');

        // High-performance: reconfigure theme compartment without recreation
        this.editor.dispatch({
          effects: this.themeCompartment.reconfigure(this.getTheme()),
        });

        this.appendTransientContent(
          `Theme changed to ${this.isDark ? 'dark' : 'light'} mode`,
          1500,
          false
        );
      } catch (error) {
        console.warn('Failed to toggle theme:', error);
      }
    });
  }

  // Smart syntax highlighting toggle: ALL ↔ PYTHON_ONLY
  toggleSyntaxHighlighting() {
    if (!this.editor) return;

    // Toggle between 2 modes: 0=ALL, 1=PYTHON_ONLY
    this.syntaxMode = (this.syntaxMode + 1) % 2;

    try {
      // Save preference
      localStorage.setItem('codemirror-syntax-mode', this.syntaxMode.toString());

      // Mode 0: ALL - Both Python and Markdown highlighting
      // Mode 1: PYTHON_ONLY - Only Python highlighting (no confusing markdown on mixed content)
      const effects = [
        this.languageCompartments.markdown.reconfigure(this.syntaxMode === 0 ? markdown() : []),
        // Python is always enabled (configured in initialization)
      ];

      this.editor.dispatch({ effects });
      // No transient message - visual highlighting change is immediate feedback
      // This prevents auto-scroll disruption while maintaining current scroll position
    } catch (error) {
      console.warn('Failed to toggle syntax highlighting:', error);
    }
  }

  clearContent() {
    this.setContent(this.getInitialDocument());
  }

  // Toggle between minimal status and help content
  toggleHelp() {
    this.isHelpVisible = !this.isHelpVisible;

    if (this.isHelpVisible) {
      this.setContent(this.getHelpContent());
    } else {
      this.setContent(this.getInitialDocument());
    }
  }

  // Page scrolling
  scrollPage(direction) {
    if (!this.editor) return;

    try {
      const scroller = this.editor.scrollDOM;
      if (!scroller) return;

      const scrollAmount = scroller.clientHeight * 0.2; // 20% of viewport height (smaller scrolling)

      if (direction === 'up') {
        scroller.scrollTop = Math.max(0, scroller.scrollTop - scrollAmount);
      } else if (direction === 'down') {
        scroller.scrollTop = Math.min(
          scroller.scrollHeight - scroller.clientHeight,
          scroller.scrollTop + scrollAmount
        );
      }
    } catch (error) {
      console.warn('Failed to scroll page:', error);
    }
  }

  // High-performance scrolling utility
  scrollToBottom() {
    if (!this.editor) return;

    try {
      const docLength = this.editor.state.doc.length;
      // Efficient scrolling using built-in CodeMirror method
      this.editor.dispatch({
        effects: EditorView.scrollIntoView(docLength, { y: 'end' }),
      });
    } catch (error) {
      console.warn('Failed to scroll:', error);
    }
  }

  hideLoadingScreen() {
    try {
      const loadingScreen = document.getElementById('loading-screen');
      if (loadingScreen) {
        loadingScreen.style.display = 'none';
      }
    } catch (error) {
      console.warn('Failed to hide loading screen:', error);
    }
  }

  showError(message) {
    const container = document.getElementById('codemirror-container');
    if (container) {
      container.innerHTML = `
        <div style="padding: 20px; color: #d63031; font-family: monospace; background: #fff5f5; border: 1px solid #ff6b6b; border-radius: 8px; margin: 20px;">
          <h2>❌ Ultra-Minimal CodeMirror Error</h2>
          <p><strong>Message:</strong> ${message}</p>
          <p><strong>This is the simplest possible implementation.</strong></p>
          <p><strong>If this fails, there may be a fundamental CodeMirror issue.</strong></p>
          <p><strong>Action:</strong> Check console for detailed error information.</p>
        </div>
      `;
    }
  }

  destroy() {
    // Clean up debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Clean up transient message timers
    for (const messageInfo of this.transientMessages.values()) {
      clearTimeout(messageInfo.timer);
    }
    this.transientMessages.clear();

    // Destroy editor
    if (this.editor) {
      try {
        this.editor.destroy();
      } catch (error) {
        console.warn('Error destroying editor:', error);
      }
      this.editor = null;
    }
  }
}

module.exports = UltraMinimalCodeMirrorInterface;
