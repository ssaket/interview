const { globalShortcut, screen } = require('electron');

class ShortcutManager {
  /**
   * @param {WindowManager} windowManager
   * @param {SimpleAIManager}     aiManager
   * @param {AppController} appController   – for toggling OCR flags
   */
  constructor(windowManager, aiManager, appController) {
    this.windowManager = windowManager;
    this.aiManager = aiManager;
    this.appController = appController;
    this.isSmallWindowMode = false; // Track window size state
    this.moveStep = 20; // Move this to instance variable for external access

    // Throttling for status messages
    this.lastMessageTime = 0;
    this.messageThrottleMs = 500; // Only show messages every 500ms
  }

  /** Register all shortcuts - toggle + global shortcuts */
  register() {
    this.registerToggleShortcut();
    this.registerGlobalShortcuts();
  }

  /** Register only the window toggle shortcut (Cmd/Ctrl+B) */
  registerToggleShortcut() {
    const primary = process.platform === 'darwin' ? 'Command' : 'Control';
    globalShortcut.register(`${primary}+B`, () => {
      this.toggleWindowVisibility();
    });
  }

  /** Register all other global shortcuts except toggle */
  registerGlobalShortcuts() {
    const { mainWindow } = this.windowManager;
    let resizeStep = 50;
    const defaultWidth = 800;
    const defaultHeight = 800;
    const minSize = 50;

    // Cross-platform modifier keys (Cmd on macOS, Ctrl on Windows/Linux)
    const primary = process.platform === 'darwin' ? 'Command' : 'Control';
    const secondary = process.platform === 'darwin' ? 'Command+Shift' : 'Control+Shift';

    /* ═══ TIER 1: CORE FUNCTIONS (Primary Modifier - Most Used) ═══ */

    // Screenshot Functions (A = Area only)
    globalShortcut.register(`${primary}+A`, () => {
      this.windowManager.send('trigger-screenshot-region');
    });

    // Note: Speech recording is now handled via WebSocket in browser

    // Window Movement (Arrow Keys = natural directional mapping)
    ['Left', 'Right', 'Up', 'Down'].forEach((dir) => {
      globalShortcut.register(`${primary}+${dir}`, () => {
        const [x, y] = mainWindow.getPosition();
        const dx = dir === 'Left' ? -this.moveStep : dir === 'Right' ? this.moveStep : 0;
        const dy = dir === 'Up' ? -this.moveStep : dir === 'Down' ? this.moveStep : 0;
        mainWindow.setPosition(x + dx, y + dy);

        // Throttle status messages to prevent flooding
        const now = Date.now();
        if (now - this.lastMessageTime >= this.messageThrottleMs) {
          this.windowManager.send('show-status-message', `↔️ Moved ${dir} (step: ${this.moveStep}px)`, 2000);
          this.lastMessageTime = now;
        }
      });
    });

    /* ═══ TIER 2: WORKFLOW SEQUENCES (Numbers - Sequential Operations) ═══ */

    // Screenshot Stack Workflow (1→2→3 sequence, region only)
    globalShortcut.register(`${primary}+1`, () => {
      this.windowManager.send('add-screenshot-to-stack', 'region');
    });

    globalShortcut.register(`${primary}+2`, () => {
      this.windowManager.send('process-screenshot-stack');
    });

    globalShortcut.register(`${primary}+3`, () => {
      this.windowManager.send('clear-screenshot-stack');
    });

    /* ═══ TIER 3: UTILITIES (Function Keys - Universal Standards) ═══ */

    // Help toggle (F1 = universal help key)
    globalShortcut.register('F1', () => this.toggleHelp());

    // Toggle Window Size (preserving original Cmd+Shift+0)
    globalShortcut.register(`${secondary}+0`, () => {
      this.syncWindowSizeState();
      if (this.isSmallWindowMode) {
        mainWindow.setSize(defaultWidth, defaultHeight);
        this.isSmallWindowMode = false;
      } else {
        mainWindow.setSize(resizeStep * 20, resizeStep * 2);
        this.isSmallWindowMode = true;
      }
    });

    // Keep F11 as alternative for those who expect it
    globalShortcut.register('F11', () => {
      this.syncWindowSizeState();
      if (this.isSmallWindowMode) {
        mainWindow.setSize(defaultWidth, defaultHeight);
        this.isSmallWindowMode = false;
      } else {
        mainWindow.setSize(resizeStep * 20, resizeStep * 2);
        this.isSmallWindowMode = true;
      }
    });

    /* ═══ TIER 4: ADVANCED FEATURES (Secondary Modifier - Less Frequent) ═══ */

    // Session & AI Management
    globalShortcut.register(`${secondary}+R`, () => {
      // Cancel any active streaming requests first
      this.appController.cancelAllStreamingRequests();

      // Clear sessions
      this.aiManager.clearAllSessions();

      // Send reset signals to UI
      this.windowManager.send('session-reset');
      this.windowManager.send('session-length', 0);
    });

    globalShortcut.register(`${secondary}+F`, () => {
      this.cycleAiFlow();
    });

    globalShortcut.register(`${secondary}+O`, () => {
      this.appController.ocrFilteringEnabled = !this.appController.ocrFilteringEnabled;
      this.windowManager.send('ocr-filtering-changed', this.appController.ocrFilteringEnabled);
    });

    // Vision Mode Toggle (U = Understand via vision)
    globalShortcut.register(`${secondary}+U`, () => {
      this.appController.visionModeEnabled = !this.appController.visionModeEnabled;
      const mode = this.appController.visionModeEnabled ? 'VISION' : 'OCR';
      console.log(`[ShortcutManager] Vision mode toggled: ${mode}`);
      this.windowManager.send('vision-mode-changed', {
        visionModeEnabled: this.appController.visionModeEnabled,
        mode: mode,
      });
    });

    // UI Controls (preserving original key mappings)
    globalShortcut.register(`${secondary}+D`, () => {
      this.windowManager.send('toggle-theme');
    });

    globalShortcut.register(`${secondary}+V`, () => {
      this.appController.conversationHistoryService.openInBrowser().catch((error) => {
        console.error('Failed to open conversation history:', error);
        this.windowManager.send('show-notification', {
          type: 'error',
          message: 'Failed to open conversation history',
        });
      });
    });

    globalShortcut.register(`${secondary}+C`, () => {
      this.centerWindow();
    });

    // Developer Tools
    globalShortcut.register(`${secondary}+I`, () => {
      console.log('[ShortcutManager] Opening developer tools');
      this.windowManager.openDevTools();
    });

    /* ═══ TIER 5: FINE CONTROL (Secondary Modifier + Arrows/Symbols) ═══ */

    // Window Height Resizing (Secondary + Up/Down Arrows)
    globalShortcut.register(`${secondary}+Down`, () => {
      const [width, height] = mainWindow.getSize();
      const newHeight = height + resizeStep;
      mainWindow.setSize(width, newHeight);

      // Throttle resize messages
      const now = Date.now();
      if (now - this.lastMessageTime >= this.messageThrottleMs) {
        this.windowManager.send('show-status-message', `📏 Height: ${newHeight}px`, 2000);
        this.lastMessageTime = now;
      }
    });

    globalShortcut.register(`${secondary}+Up`, () => {
      const [width, height] = mainWindow.getSize();
      const newHeight = Math.max(minSize, height - resizeStep);
      mainWindow.setSize(width, newHeight);

      // Throttle resize messages
      const now = Date.now();
      if (now - this.lastMessageTime >= this.messageThrottleMs) {
        this.windowManager.send('show-status-message', `📏 Height: ${newHeight}px`, 2000);
        this.lastMessageTime = now;
      }
    });

    // Movement Step Adjustment
    globalShortcut.register(`${secondary}+Plus`, () => {
      if (this.moveStep < 400) {
        this.moveStep *= 2;
        // Always show step adjustment (not throttled)
        this.windowManager.send('show-status-message', `⚡ Move step: ${this.moveStep}px`, 2500);
        this.lastMessageTime = Date.now();
      }
    });

    globalShortcut.register(`${secondary}+-`, () => {
      if (this.moveStep > 20) {
        this.moveStep /= 2;
        // Always show step adjustment (not throttled)
        this.windowManager.send('show-status-message', `⚡ Move step: ${this.moveStep}px`, 2500);
        this.lastMessageTime = Date.now();
      }
    });

    // Window Width Controls (Brackets for intuitive left/right adjustment)
    globalShortcut.register(`${secondary}+]`, () => {
      const [width, height] = mainWindow.getSize();
      const newWidth = width + resizeStep;
      mainWindow.setSize(newWidth, height);

      // Throttle resize messages
      const now = Date.now();
      if (now - this.lastMessageTime >= this.messageThrottleMs) {
        this.windowManager.send('show-status-message', `📐 Width: ${newWidth}px`, 2000);
        this.lastMessageTime = now;
      }
    });

    globalShortcut.register(`${secondary}+[`, () => {
      const [width, height] = mainWindow.getSize();
      const newWidth = Math.max(minSize, width - resizeStep);
      mainWindow.setSize(newWidth, height);

      // Throttle resize messages
      const now = Date.now();
      if (now - this.lastMessageTime >= this.messageThrottleMs) {
        this.windowManager.send('show-status-message', `📐 Width: ${newWidth}px`, 2000);
        this.lastMessageTime = now;
      }
    });

    /* ═══ LEGACY/ADDITIONAL FEATURES ═══ */

    // Page Scrolling (Alt/Option + Z/X)
    const altKey = process.platform === 'darwin' ? 'Option' : 'Alt';
    globalShortcut.register(`${altKey}+Z`, () => this.windowManager.send('scroll-page', 'up'));
    globalShortcut.register(`${altKey}+X`, () => this.windowManager.send('scroll-page', 'down'));

    // Additional Model Management
    globalShortcut.register(`${secondary}+M`, () => this.switchOllamaModel());
    globalShortcut.register(`${secondary}+Y`, () => this.toggleSystemPrompts());
    globalShortcut.register(`${secondary}+W`, () => {
      const info = this.aiManager.getProviderInfo();
      if (info.isOllama) {
        this.windowManager.send(
          'model-warmup-started',
          `Warming up ${info.model}... This may take 10-30 seconds.`
        );
        this.windowManager.send(
          'show-status-message',
          `🔥 Warming up ${info.model}...`,
          4000
        );
      } else {
        this.windowManager.send('show-status-message', '⚠️ Warmup only available for Ollama', 3000);
      }
    });

    // Syntax Highlighting Toggle (Code-Only Mode)
    globalShortcut.register(`${secondary}+L`, () => {
      this.toggleSyntaxCodeOnly();
    });
  }

  /** Unregister all shortcuts except toggle */
  unregisterGlobalShortcuts() {
    const primary = process.platform === 'darwin' ? 'Command' : 'Control';
    const secondary = process.platform === 'darwin' ? 'Command+Shift' : 'Control+Shift';
    const altKey = process.platform === 'darwin' ? 'Option' : 'Alt';

    // Unregister all global shortcuts specifically (not cmd+B)
    globalShortcut.unregister(`${primary}+A`);

    // Arrow keys
    ['Left', 'Right', 'Up', 'Down'].forEach((dir) => {
      globalShortcut.unregister(`${primary}+${dir}`);
    });

    // Number keys
    globalShortcut.unregister(`${primary}+1`);
    globalShortcut.unregister(`${primary}+2`);
    globalShortcut.unregister(`${primary}+3`);

    // Function keys
    globalShortcut.unregister('F1');
    globalShortcut.unregister('F11');

    // Secondary modifier shortcuts
    globalShortcut.unregister(`${secondary}+0`);
    globalShortcut.unregister(`${secondary}+R`);
    globalShortcut.unregister(`${secondary}+F`);
    globalShortcut.unregister(`${secondary}+O`);
    globalShortcut.unregister(`${secondary}+D`);
    globalShortcut.unregister(`${secondary}+V`);
    globalShortcut.unregister(`${secondary}+C`);
    globalShortcut.unregister(`${secondary}+I`);

    // Window height resizing
    globalShortcut.unregister(`${secondary}+Down`);
    globalShortcut.unregister(`${secondary}+Up`);

    // Movement step adjustment
    globalShortcut.unregister(`${secondary}+Plus`);
    globalShortcut.unregister(`${secondary}+-`);

    // Window width controls
    globalShortcut.unregister(`${secondary}+]`);
    globalShortcut.unregister(`${secondary}+[`);

    // Page scrolling
    globalShortcut.unregister(`${altKey}+Z`);
    globalShortcut.unregister(`${altKey}+X`);

    // Additional features
    globalShortcut.unregister(`${secondary}+M`);
    globalShortcut.unregister(`${secondary}+Y`);
    globalShortcut.unregister(`${secondary}+W`);
    globalShortcut.unregister(`${secondary}+L`);
  }

  unregisterAll() {
    globalShortcut.unregisterAll();
  }

  /* ---------- Helpers ---------- */
  toggleHelp() {
    this.windowManager.send('toggle-help');
  }

  showHelp() {
    const mod = process.platform === 'darwin' ? 'Cmd' : 'Ctrl';
    console.log('\n=== PSYCHOLOGY-OPTIMIZED SHORTCUTS ===');
    console.log(`TIER 1 - CORE FUNCTIONS (${mod} + Key):`);
    console.log(`  ${mod}+A                 - Area screenshot (region)`);
    console.log(`  ${mod}+B                 - Show/hide window`);
    console.log(`  ${mod}+Arrow Keys        - Move window`);
    console.log('\nTIER 2 - WORKFLOWS (Numbers):');
    console.log(`  ${mod}+1                 - Add region screenshot to stack`);
    console.log(`  ${mod}+2                 - Process screenshot stack`);
    console.log(`  ${mod}+3                 - Clear screenshot stack`);
    console.log('\nTIER 3 - UTILITIES (Function Keys):');
    console.log('  F1                     - Toggle help guide in interface');
    console.log('  F11                    - Toggle window size (alternative)');
    console.log(`\nTIER 4 - ADVANCED (${mod}+Shift + Key):`);
    console.log(`  ${mod}+Shift+0           - Toggle window size`);
    console.log(`  ${mod}+Shift+R           - Reset AI session`);
    console.log(`  ${mod}+Shift+F           - Toggle AI flow`);
    console.log(`  ${mod}+Shift+O           - Toggle OCR filtering`);
    console.log(`  ${mod}+Shift+U           - Toggle Vision mode`);
    console.log(`  ${mod}+Shift+D           - Toggle theme`);
    console.log(`  ${mod}+Shift+V           - Conversation history`);
    console.log(`  ${mod}+Shift+C           - Center window`);
    console.log(`\nTIER 5 - FINE CONTROL (${mod}+Shift + Symbols/Arrows):`);
    console.log(`  ${mod}+Shift+Up/Down     - Resize window height`);
    console.log(`  ${mod}+Shift+[ ]         - Resize window width`);
    console.log(`  ${mod}+Shift+Plus/-      - Adjust movement step`);
    console.log('\nOTHER:');
    console.log('  Alt/Opt+Z/X            - Scroll page up/down');
    console.log(`  ${mod}+Shift+M           - Switch Ollama model`);
    console.log(`  ${mod}+Shift+Y           - Toggle system prompts`);
    console.log(`  ${mod}+Shift+W           - Warmup Ollama model`);
    console.log(`  ${mod}+Shift+L           - Toggle code-only view`);
    console.log(`  ${mod}+Shift+I           - Developer tools`);
    console.log('=====================================\n');
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
        error: 'No models available',
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
      // Unregister all shortcuts except cmd/ctrl-b to allow other apps to use them
      if (process.platform === 'win32') {
        setTimeout(() => {
          this.unregisterGlobalShortcuts();
        }, 500);
      } else {
        this.unregisterGlobalShortcuts();
      }
    } else {
      // Position window at cursor before showing
      this.positionWindowAtCursor();
      mainWindow.show();
      if (process.platform === 'win32') {
        setTimeout(() => {
          this.registerGlobalShortcuts();
        }, 500);
      } else {
        this.registerGlobalShortcuts();
      }
    }
  }

  /**
   * Position window at mouse cursor location
   */
  positionWindowAtCursor() {
    const { mainWindow } = this.windowManager;

    try {
      // Get cursor position
      const cursorPoint = screen.getCursorScreenPoint();
      const [windowWidth, windowHeight] = mainWindow.getSize();

      // Calculate window position to center it around cursor
      const x = cursorPoint.x - Math.floor(windowWidth / 2);
      const y = cursorPoint.y - Math.floor(windowHeight / 2);

      // Get display bounds to ensure window stays on screen
      const display = screen.getDisplayNearestPoint(cursorPoint);
      const {
        x: displayX,
        y: displayY,
        width: displayWidth,
        height: displayHeight,
      } = display.bounds;

      // Clamp position to display bounds
      const clampedX = Math.max(displayX, Math.min(x, displayX + displayWidth - windowWidth));
      const clampedY = Math.max(displayY, Math.min(y, displayY + displayHeight - windowHeight));

      mainWindow.setPosition(clampedX, clampedY);
      console.log(`Window positioned at cursor: (${clampedX}, ${clampedY})`);
    } catch (error) {
      console.error('Failed to position window at cursor:', error);
      // Fallback to center of primary display
      this.centerWindow();
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
      message: `System prompts ${enabled ? 'enabled' : 'disabled'}`,
    });
    console.log(`[Shortcut] System prompts ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Toggle syntax code-only mode (only when streaming is complete)
   */
  async toggleSyntaxCodeOnly() {
    try {
      // Check with AppController if streaming is active
      if (this.appController.isStreamingActive()) {
        this.windowManager.send('show-notification', {
          type: 'warning',
          message: 'Cannot toggle code view while AI is streaming',
        });
        return;
      }

      // Toggle syntax mode through AppController
      const result = this.appController.toggleSyntaxMode();

      // Send toggle result to renderer with extracted content
      this.windowManager.send('syntax-mode-toggled', {
        mode: result.mode,
        previousMode: result.previousMode,
      });

      // Show notification about the mode change
      const modeText = result.mode === 'CODE_ONLY' ? 'Code Only' : 'All Content';
      this.windowManager.send('show-notification', {
        type: 'info',
        message: `Switched to ${modeText} mode`,
      });

      console.log(`[Shortcut] Syntax mode toggled to: ${result.mode}`);
    } catch (error) {
      console.error('[Shortcut] Failed to toggle syntax code-only:', error);
      this.windowManager.send('show-notification', {
        type: 'error',
        message: 'Failed to toggle code view',
      });
    }
  }
}

module.exports = ShortcutManager;
