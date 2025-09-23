/**
 * Ultra-minimal CodeMirror implementation - guaranteed to work
 * Removes all complex features to avoid any conflicts
 */

const { EditorState } = require('@codemirror/state');
const { EditorView } = require('@codemirror/view');

/**
 * Ultra-minimal working CodeMirror interface
 */
class UltraMinimalCodeMirrorInterface {
  constructor(container) {
    this.container = container;
    this.editor = null;
    this.isDark = false;

    this.initialize();
  }

  initialize() {
    try {
      console.log('🚀 Initializing ultra-minimal CodeMirror...');

      // Load theme preference
      const savedTheme = localStorage.getItem('codemirror-theme');
      this.isDark = savedTheme ? savedTheme === 'dark' : false;

      // Create the simplest possible editor
      const initialDoc = this.getInitialDocument();

      // Create state with theme-aware configuration
      const state = EditorState.create({
        doc: initialDoc,
        extensions: [
          // Only line wrapping - nothing else
          EditorView.lineWrapping,

          // Theme-aware styling
          this.getTheme(),
        ],
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
          backgroundColor: 'rgba(13, 17, 23, 0.15)',
          color: '#f0f6fc',
          overflow: 'hidden',
        },
        '.cm-content': {
          padding: '16px',
          lineHeight: '1.6',
          minHeight: '100%',
          backgroundColor: 'rgba(13, 17, 23, 0.15)',
          color: '#f0f6fc',
        },
        '.cm-focused': {
          outline: 'none',
        },
        '.cm-editor': {
          height: '100%',
          backgroundColor: 'rgba(13, 17, 23, 0.15)',
        },
        '.cm-scroller': {
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
          backgroundColor: 'rgba(13, 17, 23, 0.15)',
          overflow: 'auto',
        },
      });
    } else {
      return EditorView.theme({
        '&': {
          height: '100%',
          fontSize: '14px',
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          color: '#24292f',
          overflow: 'hidden',
        },
        '.cm-content': {
          padding: '16px',
          lineHeight: '1.6',
          minHeight: '100%',
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          color: '#24292f',
        },
        '.cm-focused': {
          outline: 'none',
        },
        '.cm-editor': {
          height: '100%',
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
        },
        '.cm-scroller': {
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          overflow: 'auto',
        },
      });
    }
  }

  getInitialDocument() {
    const timestamp = new Date().toLocaleTimeString();
    return `# DeepSeek Overlay Helper - Text Interface
Initialized at ${timestamp}

## Status
🔍 OCR: Ready | 🎤 Speech: Ready | 🧠 AI: LOCAL | 📊 Session: 0 messages

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

  // Content management - simplified
  appendContent(content, addSeparator = true) {
    if (!this.editor) return;

    try {
      const separator = addSeparator ? '\n\n' : '\n';
      const insertText = separator + content;

      const transaction = this.editor.state.update({
        changes: {
          from: this.editor.state.doc.length,
          to: this.editor.state.doc.length,
          insert: insertText,
        },
      });

      this.editor.dispatch(transaction);
      this.scrollToBottom();
    } catch (error) {
      console.warn('Failed to append content:', error);
    }
  }

  setContent(content) {
    if (!this.editor) return;

    try {
      const transaction = this.editor.state.update({
        changes: {
          from: 0,
          to: this.editor.state.doc.length,
          insert: content,
        },
      });

      this.editor.dispatch(transaction);
    } catch (error) {
      console.warn('Failed to set content:', error);
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

  // AI response handling
  startAIResponse(message = 'AI is processing your request...') {
    // Clear content but preserve status line
    this.clearToStatusOnly();
    this.appendContent(`## AI Response\n${message}`);
  }

  // Clear document content but keep only the status line
  clearToStatusOnly() {
    try {
      const currentDoc = this.editor.state.doc.toString();
      const lines = currentDoc.split('\n');

      // Find the status line
      let statusLine = '';
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('🔍 OCR:')) {
          statusLine = lines[i];
          break;
        }
      }

      // Set content to just the header and status
      const timestamp = new Date().toLocaleTimeString();
      const minimalContent = `# DeepSeek Overlay Helper - Text Interface
Initialized at ${timestamp}

## Status
${statusLine}

---

Activity log:`;

      this.setContent(minimalContent);
    } catch (error) {
      console.warn('Failed to clear to status only:', error);
    }
  }

  streamAIChunk(chunk) {
    if (!this.editor) return;

    try {
      const transaction = this.editor.state.update({
        changes: {
          from: this.editor.state.doc.length,
          to: this.editor.state.doc.length,
          insert: chunk,
        },
      });

      this.editor.dispatch(transaction);
      this.scrollToBottom();
    } catch (error) {
      console.warn('Failed to stream chunk:', error);
    }
  }

  completeAIResponse() {
    this.appendContent('', false);
  }

  // Theme management - simple recreation
  toggleTheme() {
    this.isDark = !this.isDark;

    try {
      // Save preference
      localStorage.setItem('codemirror-theme', this.isDark ? 'dark' : 'light');

      // Update document theme
      document.documentElement.setAttribute('data-theme', this.isDark ? 'dark' : 'light');

      // Simple approach: recreate editor with new theme
      const currentContent = this.editor.state.doc.toString();
      this.destroy();
      this.initialize();
      this.setContent(currentContent);

      this.appendContent(`Theme changed to ${this.isDark ? 'dark' : 'light'} mode`, false);
    } catch (error) {
      console.warn('Failed to toggle theme:', error);
    }
  }

  clearContent() {
    this.setContent(this.getInitialDocument());
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

  // Utilities
  scrollToBottom() {
    if (!this.editor) return;

    try {
      // More reliable scrolling approach
      const doc = this.editor.state.doc;
      const lastPos = doc.length;

      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        this.editor.dispatch({
          selection: { anchor: lastPos, head: lastPos },
          scrollIntoView: true,
        });

        // Also try direct scrolling as fallback
        const scroller = this.editor.scrollDOM;
        if (scroller) {
          scroller.scrollTop = scroller.scrollHeight;
        }
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
