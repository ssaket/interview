const { globalShortcut, screen } = require('electron');

class ShortcutManager {
  /**
   * @param {WindowManager} windowManager
   * @param {SimpleAIManager}     aiManager
   * @param {AppController} appController   – for toggling OCR / burn‑mode flags
   */
  constructor(windowManager, aiManager, appController) {
    this.windowManager = windowManager;
    this.aiManager = aiManager;
    this.appController = appController;
    this.isSmallWindowMode = false; // Track window size state
    this.moveStep = 20; // Move this to instance variable for external access
    this.mouseTrackingEnabled = false; // Track mouse position following state
    this.lastMousePosition = { x: 0, y: 0 }; // Store last mouse position
  }

  /** Register all global shortcuts that were previously in registerShortcuts(). */
  register() {
    const { mainWindow } = this.windowManager;
    let resizeStep = 50;
    const defaultWidth = 800;
    const defaultHeight = 800;
    const minSize = 50;

    /* ─── Movement ─── */
    ['Left', 'Right', 'Up', 'Down'].forEach((dir) => {
      globalShortcut.register(`Command+${dir}`, () => {
        const [x, y] = mainWindow.getPosition();
        const dx = dir === 'Left' ? -this.moveStep : dir === 'Right' ? this.moveStep : 0;
        const dy = dir === 'Up' ? -this.moveStep : dir === 'Down' ? this.moveStep : 0;
        mainWindow.setPosition(x + dx, y + dy);
      });
    });
    globalShortcut.register('Command+Shift+=', () => {
      if (this.moveStep < 400) this.moveStep *= 2;
    });
    globalShortcut.register('Command+Shift+-', () => {
      if (this.moveStep > 20) this.moveStep /= 2;
    });

    /* ─── Center window ─── */
    globalShortcut.register('Command+Shift+C', () => {
      this.centerWindow();
    });

    /* ─── Resizing ─── */
    globalShortcut.register('Command+Shift+]', () => {
      const [width, height] = mainWindow.getSize();
      mainWindow.setSize(width + resizeStep, height);
    });
    globalShortcut.register('Command+Shift+[', () => {
      const [width, height] = mainWindow.getSize();
      mainWindow.setSize(Math.max(minSize, width - resizeStep), height);
    });
    globalShortcut.register('Command+Shift+Down', () => {
      const [width, height] = mainWindow.getSize();
      mainWindow.setSize(width, height + resizeStep);
    });
    globalShortcut.register('Command+Shift+Up', () => {
      const [width, height] = mainWindow.getSize();
      mainWindow.setSize(width, Math.max(minSize, height - resizeStep));
    });
    globalShortcut.register('Command+Shift+0', () => {
      // Sync state first in case window was manually resized
      this.syncWindowSizeState();

      if (this.isSmallWindowMode) {
        // Switch to default size
        mainWindow.setSize(defaultWidth, defaultHeight);
        this.isSmallWindowMode = false;
        console.log('Window toggled to default size (800x800)');
      } else {
        // Switch to small size
        mainWindow.setSize(resizeStep * 20, resizeStep * 2);
        this.isSmallWindowMode = true;
        console.log('Window toggled to small size (900x200)');
      }
    });

    /* ─── Help ─── */
    globalShortcut.register('Command+Shift+H', () => this.showHelp());

    /* ─── Window visibility ─── */
    globalShortcut.register('Command+B', () => {
      this.toggleWindowVisibility();
    });

    globalShortcut.register('Command+R', () => {
      this.windowManager.send('start-speech-recording');
    });

    globalShortcut.register('Command+T', () => {
      this.windowManager.send('stop-speech-recording');
    });

    /* ─── Session reset ─── */
    globalShortcut.register('Command+Shift+R', () => {
      this.aiManager.clearAllSessions();
      this.windowManager.send('session-reset');
      this.windowManager.send('session-length', 0);
    });

    /* ─── OCR filtering toggle ─── */
    globalShortcut.register('Command+Shift+O', () => {
      this.appController.ocrFilteringEnabled = !this.appController.ocrFilteringEnabled;
      this.windowManager.send('ocr-filtering-changed', this.appController.ocrFilteringEnabled);
    });

    /* ─── Formatter toggle ─── */
    globalShortcut.register('Command+Shift+F', () => {
      this.windowManager.toggleFormatter();
    });


    /* ─── AI flow switches ─── */
    const aiFlowShortcut = globalShortcut.register('Command+Shift+P', () => this.cycleAiFlow());
    console.log('[ShortcutManager] Command+Shift+P registration:', aiFlowShortcut ? 'SUCCESS' : 'FAILED');

    // Alternative shortcut for testing AI flow cycling
    const altAiFlowShortcut = globalShortcut.register('Command+Shift+L', () => {
      console.log('[ShortcutManager] Command+Shift+L pressed - alternative AI flow cycling');
      this.cycleAiFlow();
    });
    console.log('[ShortcutManager] Command+Shift+L (alternative) registration:', altAiFlowShortcut ? 'SUCCESS' : 'FAILED');

    globalShortcut.register('Command+Shift+M', () => this.switchOllamaModel());
    globalShortcut.register('Command+Shift+Y', () => this.toggleSystemPrompts());

    /* ─── Misc renderer events ─── */
    globalShortcut.register('Command+Shift+D', () => this.windowManager.send('toggle-theme'));

    // Developer tools shortcut
    globalShortcut.register('Command+Shift+I', () => {
      console.log('[ShortcutManager] Opening developer tools');
      this.windowManager.openDevTools();
    });

    globalShortcut.register('Shift+X', () => this.windowManager.send('scroll-page', 'up'));
    globalShortcut.register('Shift+Z', () => this.windowManager.send('scroll-page', 'down'));
    globalShortcut.register('Command+Shift+S', () => this.windowManager.send('trigger-screenshot'));
    globalShortcut.register('Command+Shift+A', () =>
      this.windowManager.send('trigger-overlay-region-screenshot')
    );

    /* ─── Stack Screenshots ─── */
    globalShortcut.register('Command+Shift+1', () => this.windowManager.send('add-screenshot-to-stack', 'full'));
    globalShortcut.register('Command+Shift+2', () => this.windowManager.send('add-screenshot-to-stack', 'region'));
    globalShortcut.register('Command+Shift+3', () => this.windowManager.send('process-screenshot-stack'));
    globalShortcut.register('Command+Shift+4', () => this.windowManager.send('clear-screenshot-stack'));
    globalShortcut.register('Command+Shift+L', () => this.windowManager.toggleFormatter());
    globalShortcut.register('Command+Shift+W', () => {
      const info = this.aiManager.getProviderInfo();
      if (info.isOllama) {
        this.windowManager.send(
          'model-warmup-started',
          `Warming up ${info.model}... This may take 10-30 seconds.`
        );
      }
    });

    /* ─── Conversation History ─── */
    globalShortcut.register('Command+Shift+V', () => {
      this.appController.conversationHistoryService.openInBrowser().catch(error => {
        console.error('Failed to open conversation history:', error);
        this.windowManager.send('show-notification', {
          type: 'error',
          message: 'Failed to open conversation history'
        });
      });
    });

    /* ─── Mouse tracking toggle ─── */
    globalShortcut.register('Control+Shift+=', () => {
      this.toggleMouseTracking();
    });
  }

  unregisterAll() {
    // Stop mouse tracking if active
    this.stopMouseTracking();
    this.mouseTrackingEnabled = false;
    
    globalShortcut.unregisterAll();
  }

  /* ---------- Helpers ---------- */
  showHelp() {
    console.log('\n=== KEYBOARD SHORTCUTS HELP ===');
    console.log('WINDOW MOVEMENT:');
    console.log('  Cmd+Arrow Keys        - Move window in direction');
    console.log('  Cmd+Shift+C           - Center window on display');
    console.log('  Ctrl+Shift+=          - Toggle mouse tracking (window follows cursor)');
    console.log('\nWINDOW RESIZING:');
    console.log('  Cmd+Shift+=           - Increase movement step');
    console.log('  Cmd+Shift+-           - Decrease movement step');
    console.log('  Cmd/Ctrl+Scroll       - Adjust movement step with mouse wheel');
    console.log('  Cmd+Shift+]           - Increase window width');
    console.log('  Cmd+Shift+[           - Decrease window width');
    console.log('  Cmd+Shift+Up/Down     - Adjust window height');
    console.log('  Cmd+Shift+0           - Toggle window size (800x200 ⇄ 800x800)');
    console.log('\nWINDOW CONTROL:');
    console.log('  Cmd+B                 - Toggle window visibility');
    console.log('\nSPEECH-TO-TEXT:');
    console.log('  Cmd+R                 - Start speech recording');
    console.log('  Cmd+T                 - Stop speech recording and transcribe');
    console.log('\nSESSION / OCR / PROVIDER:');
    console.log('  Cmd+Shift+R           - Reset session');
    console.log('  Cmd+Shift+F           - Toggle OCR filtering');
    console.log('  Cmd+Shift+P           - Switch AI provider');
    console.log('  Cmd+Shift+M           - Switch Ollama model');
    console.log('  Cmd+Shift+Y           - Toggle system prompts');
    console.log('  Cmd+Shift+Q           - Toggle burn mode');
    console.log('\nMISC:');
    console.log('  Cmd+Shift+D           - Toggle dark/light theme');
    console.log('  Cmd+Shift+S / A       - Capture screenshot / region');
    console.log('  Cmd+Shift+1 / 2       - Add screenshot to stack (full / region)');
    console.log('  Cmd+Shift+3           - Process screenshot stack');
    console.log('  Cmd+Shift+4           - Clear screenshot stack');
    console.log('  Shift+X / Shift+Z     - Scroll page up/down');
    console.log('================================\n');
  }

  switchOllamaModel() {
    const info = this.aiManager.getProviderInfo();

    // If not using Ollama, switch to it first with default model
    if (!info.isOllama) {
      console.log('[Shortcut] Switching to Ollama first...');
      try {
        this.aiManager.switchProvider('ollama');
        this.windowManager.send('model-switched', {
          model: this.aiManager.getProviderInfo().model,
          question: '',
          sessionLength: 0,
          exchanges: 0,
        });
        console.log(`Switched to Ollama with ${this.aiManager.getProviderInfo().model}`);
        return;
      } catch (err) {
        console.error('Failed to switch to Ollama:', err);
        this.windowManager.send('model-switch-failed', { model: 'ollama', error: err.message });
        return;
      }
    }

    // Get available Ollama models using the new API
    const allModels = this.aiManager.getAvailableModels();
    if (!allModels || allModels.length === 0) {
      console.error('No Ollama models available');
      this.windowManager.send('model-switch-failed', {
        model: 'ollama',
        error: 'No models available'
      });
      return;
    }

    /* 1️⃣ Determine next model */
    const current = info.model;
    const currentIndex = allModels.indexOf(current);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % allModels.length : 0;
    const next = allModels[nextIndex];

    /* 2️⃣ Save last user question from current session */
    const prevSession = this.aiManager.getSession();
    const history = prevSession.history;

    // Find the most recent user message to preserve context consistently
    let lastUserMsg = null;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role === 'user') {
        lastUserMsg = history[i];
        break;
      }
    }

    /* 3️⃣ Switch model */
    this.aiManager.setModel(next);
    process.env.OLLAMA_MODEL = next;

    try {
      // Initialize method exists but is a no-op in SimpleAIManager
      this.aiManager.initialize();
    } catch (err) {
      console.error('Model switch failed:', err);
      this.windowManager.send('model-switch-failed', { model: next, error: err.message });
      return;
    }

    /* 4️⃣ Preserve user question in new session */
    const newSession = this.aiManager.getSession();

    if (lastUserMsg && newSession.history.length === 0) {
      newSession.history.push(lastUserMsg);
    }

    /* 5️⃣ Notify renderer */
    this.windowManager.send('model-switched', {
      model: next,
      question: lastUserMsg ? lastUserMsg.content : '',
      sessionLength: newSession.history.length,
      exchanges: Math.floor(newSession.history.length / 2),
    });

    // Also send explicit session-length update to ensure UI is in sync
    this.windowManager.send('session-length', newSession.history.length);

    console.log(`Switched to ${next} (${newSession.history.length} messages preserved)`);
  }

  /**
   * Sync the window size state based on current window dimensions
   * Call this to ensure toggle state is accurate after manual resizing
   */
  syncWindowSizeState() {
    const { mainWindow } = this.windowManager;
    const [width, height] = mainWindow.getSize();

    // Consider it small mode if close to small size (allow some tolerance)
    this.isSmallWindowMode = width >= 750 && height <= 250;
  }

  /**
   * Get current window size mode for external use
   */
  getWindowSizeMode() {
    return this.isSmallWindowMode ? 'small' : 'default';
  }

  /**
   * Center the window on the primary display
   */
  centerWindow() {
    const { mainWindow } = this.windowManager;
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    const [windowWidth, windowHeight] = mainWindow.getSize();
    
    const x = Math.round((screenWidth - windowWidth) / 2);
    const y = Math.round((screenHeight - windowHeight) / 2);
    
    mainWindow.setPosition(x, y);
    console.log(`Window centered at (${x}, ${y})`);
  }

  /**
   * Adjust movement step based on direction
   * @param {string} direction - 'increase' or 'decrease'
   * @returns {number} Current movement step value
   */
  adjustMovementStep(direction) {
    if (direction === 'increase' && this.moveStep < 400) {
      this.moveStep *= 2;
    } else if (direction === 'decrease' && this.moveStep > 20) {
      this.moveStep /= 2;
    }
    return this.moveStep;
  }

  /**
   * Toggle window visibility and manage shortcuts accordingly
   */
  toggleWindowVisibility() {
    const { mainWindow } = this.windowManager;

    if (mainWindow.isVisible()) {
      mainWindow.hide();
      // Deregister all shortcuts when hiding
      this.unregisterAll();
      // Re-register only Command+B to allow showing window again
      globalShortcut.register('Command+B', () => {
        this.toggleWindowVisibility();
      });
    } else {
      mainWindow.show();
      // Deregister all shortcuts and re-register them fresh
      this.unregisterAll();
      this.register();
    }
  }

  /**
   * Toggle mouse tracking mode - when enabled, window follows mouse cursor
   */
  toggleMouseTracking() {
    this.mouseTrackingEnabled = !this.mouseTrackingEnabled;
    
    if (this.mouseTrackingEnabled) {
      this.startMouseTracking();
      console.log('Mouse tracking enabled - window will follow cursor');
    } else {
      this.stopMouseTracking();
      console.log('Mouse tracking disabled');
    }
  }

  /**
   * Start tracking mouse position and moving window accordingly
   */
  startMouseTracking() {
    const { screen } = require('electron');
    
    // Set up interval to check mouse position
    this.mouseTrackingInterval = setInterval(() => {
      const mousePos = screen.getCursorScreenPoint();
      const { mainWindow } = this.windowManager;
      
      // Check if mouse position has changed significantly
      if (Math.abs(mousePos.x - this.lastMousePosition.x) > 5 || 
          Math.abs(mousePos.y - this.lastMousePosition.y) > 5) {
        
        // Get window size to center it on mouse cursor
        const [windowWidth, windowHeight] = mainWindow.getSize();
        const newX = mousePos.x - Math.floor(windowWidth / 2);
        const newY = mousePos.y - Math.floor(windowHeight / 2);
        
        // Update window position
        mainWindow.setPosition(newX, newY);
        
        // Update last mouse position
        this.lastMousePosition = { x: mousePos.x, y: mousePos.y };
      }
    }, 50); // Check every 50ms for smooth tracking
  }

  /**
   * Stop tracking mouse position
   */
  stopMouseTracking() {
    if (this.mouseTrackingInterval) {
      clearInterval(this.mouseTrackingInterval);
      this.mouseTrackingInterval = null;
    }
  }

  /**
   * Cycle through AI flows: LOCAL -> CLOUD -> HYBRID -> LOCAL
   */
  cycleAiFlow() {
    console.log('[ShortcutManager] Cmd+Shift+P pressed - cycling AI flow');
    this.windowManager.send('cycle-ai-flow');
  }

  /**
   * Toggle system prompts on/off
   */
  toggleSystemPrompts() {
    const enabled = this.aiManager.toggleSystemPrompts();
    this.windowManager.send('system-prompts-toggled', {
      enabled: enabled,
      message: `System prompts ${enabled ? 'enabled' : 'disabled'}`
    });
    console.log(`[Shortcut] System prompts ${enabled ? 'enabled' : 'disabled'}`);
  }
}

module.exports = ShortcutManager;
