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
    this.mouseTrackingEnabled = false; // Track mouse position following state
    this.lastMousePosition = { x: 0, y: 0 }; // Store last mouse position
  }

  /** Register all global shortcuts using psychology-based design principles. */
  register() {
    const { mainWindow } = this.windowManager;
    let resizeStep = 50;
    const defaultWidth = 800;
    const defaultHeight = 800;
    const minSize = 50;

    // Cross-platform modifier keys (Cmd on macOS, Ctrl on Windows/Linux)
    const primary = process.platform === 'darwin' ? 'Command' : 'Control';
    const secondary = process.platform === 'darwin' ? 'Command+Shift' : 'Control+Shift';

    /* ═══ TIER 1: CORE FUNCTIONS (Primary Modifier - Most Used) ═══ */

    // Screenshot Functions (S = Screenshot, A = Area)
    globalShortcut.register(`${primary}+S`, () => {
      this.windowManager.send('trigger-screenshot');
    });

    globalShortcut.register(`${primary}+A`, () => {
      this.windowManager.send('trigger-screenshot-region');
    });

    // Recording Functions (R = Record, T = sTop)
    globalShortcut.register(`${primary}+R`, () => {
      this.windowManager.send('start-speech-recording');
    });

    globalShortcut.register(`${primary}+T`, () => {
      this.windowManager.send('stop-speech-recording');
    });

    // Window Management (B = show/hide - preserving original)
    globalShortcut.register(`${primary}+B`, () => {
      this.toggleWindowVisibility();
    });

    // Window Movement (Arrow Keys = natural directional mapping)
    ['Left', 'Right', 'Up', 'Down'].forEach((dir) => {
      globalShortcut.register(`${primary}+${dir}`, () => {
        const [x, y] = mainWindow.getPosition();
        const dx = dir === 'Left' ? -this.moveStep : dir === 'Right' ? this.moveStep : 0;
        const dy = dir === 'Up' ? -this.moveStep : dir === 'Down' ? this.moveStep : 0;
        mainWindow.setPosition(x + dx, y + dy);
      });
    });

    /* ═══ TIER 2: WORKFLOW SEQUENCES (Numbers - Sequential Operations) ═══ */

    // Screenshot Stack Workflow (1→2→3→4 natural sequence)
    globalShortcut.register(`${primary}+1`, () => {
      this.windowManager.send('add-screenshot-to-stack', 'full');
    });

    globalShortcut.register(`${primary}+2`, () => {
      this.windowManager.send('add-screenshot-to-stack', 'region');
    });

    globalShortcut.register(`${primary}+3`, () => {
      this.windowManager.send('process-screenshot-stack');
    });

    globalShortcut.register(`${primary}+4`, () => {
      this.windowManager.send('clear-screenshot-stack');
    });

    /* ═══ TIER 3: UTILITIES (Function Keys - Universal Standards) ═══ */

    // Help (F1 = universal help key)
    globalShortcut.register('F1', () => this.showHelp());

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
      this.aiManager.clearAllSessions();
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

    // UI Controls (preserving original key mappings)
    globalShortcut.register(`${secondary}+D`, () => {
      this.windowManager.send('toggle-theme');
    });

    globalShortcut.register(`${secondary}+V`, () => {
      this.appController.conversationHistoryService.openInBrowser().catch(error => {
        console.error('Failed to open conversation history:', error);
        this.windowManager.send('show-notification', {
          type: 'error',
          message: 'Failed to open conversation history'
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

    // Window Resizing (Secondary + Arrows for precise control)
    globalShortcut.register(`${secondary}+Right`, () => {
      const [width, height] = mainWindow.getSize();
      mainWindow.setSize(width + resizeStep, height);
    });

    globalShortcut.register(`${secondary}+Left`, () => {
      const [width, height] = mainWindow.getSize();
      mainWindow.setSize(Math.max(minSize, width - resizeStep), height);
    });

    globalShortcut.register(`${secondary}+Down`, () => {
      const [width, height] = mainWindow.getSize();
      mainWindow.setSize(width, height + resizeStep);
    });

    globalShortcut.register(`${secondary}+Up`, () => {
      const [width, height] = mainWindow.getSize();
      mainWindow.setSize(width, Math.max(minSize, height - resizeStep));
    });

    // Movement Step Adjustment
    globalShortcut.register(`${secondary}+Plus`, () => {
      if (this.moveStep < 400) this.moveStep *= 2;
    });

    globalShortcut.register(`${secondary}+-`, () => {
      if (this.moveStep > 20) this.moveStep /= 2;
    });

    /* ═══ WINDOW WIDTH ADJUSTMENT (Preserving Original Brackets) ═══ */

    // Window Width Controls (preserving original [ ] keys)
    globalShortcut.register(`${secondary}+]`, () => {
      const [width, height] = mainWindow.getSize();
      mainWindow.setSize(width + resizeStep, height);
    });

    globalShortcut.register(`${secondary}+[`, () => {
      const [width, height] = mainWindow.getSize();
      mainWindow.setSize(Math.max(minSize, width - resizeStep), height);
    });

    /* ═══ ALTERNATIVE SCREENSHOT SHORTCUTS (Compatibility) ═══ */

    // Alternative screenshot shortcuts for users who expect them
    globalShortcut.register(`${secondary}+S`, () => {
      this.windowManager.send('trigger-screenshot');
    });

    globalShortcut.register(`${secondary}+A`, () => {
      this.windowManager.send('trigger-screenshot-region');
    });

    /* ═══ LEGACY/ADDITIONAL FEATURES ═══ */

    // Page Scrolling (for completeness)
    globalShortcut.register('Shift+X', () => this.windowManager.send('scroll-page', 'up'));
    globalShortcut.register('Shift+Z', () => this.windowManager.send('scroll-page', 'down'));

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
      }
    });

    // Formatter Toggle
    globalShortcut.register(`${secondary}+L`, () => {
      this.windowManager.toggleFormatter();
    });

    // Mouse Tracking (for power users) - trying alternative key since = fails
    // Try multiple key combinations until one works (avoiding conflicts with existing shortcuts)
    const mouseTrackingKeys = process.platform === 'darwin'
      ? ['Command+Shift+Equal', 'Command+Option+M', 'Command+Shift+Q', 'Command+Shift+K']
      : ['Control+Shift+Equal', 'Control+Alt+M', 'Control+Shift+Q', 'Control+Shift+K'];

    let mouseRegistered = false;
    for (const key of mouseTrackingKeys) {
      try {
        mouseRegistered = globalShortcut.register(key, () => {
          console.log(`[ShortcutManager] Mouse tracking shortcut triggered: ${key}`);
          this.toggleMouseTracking();
        });
        if (mouseRegistered) {
          console.log(`[ShortcutManager] Mouse tracking registration SUCCESS with: ${key}`);
          break;
        }
      } catch (err) {
        console.log(`[ShortcutManager] Failed to register ${key}: ${err.message}`);
      }
    }

    if (!mouseRegistered) {
      console.log('[ShortcutManager] WARNING: No mouse tracking shortcut could be registered');
    }
  }

  unregisterAll() {
    // Stop mouse tracking if active
    this.stopMouseTracking();
    this.mouseTrackingEnabled = false;
    
    globalShortcut.unregisterAll();
  }

  /* ---------- Helpers ---------- */
  showHelp() {
    const mod = process.platform === 'darwin' ? 'Cmd' : 'Ctrl';
    console.log('\n=== PSYCHOLOGY-OPTIMIZED SHORTCUTS ===');
    console.log(`TIER 1 - CORE FUNCTIONS (${mod} + Key):`);
    console.log(`  ${mod}+S                 - Screenshot (full screen)`);
    console.log(`  ${mod}+A                 - Area screenshot (region)`);
    console.log(`  ${mod}+R                 - Record speech`);
    console.log(`  ${mod}+T                 - sTop recording`);
    console.log(`  ${mod}+B                 - Show/hide window`);
    console.log(`  ${mod}+Arrow Keys        - Move window`);
    console.log('\nTIER 2 - WORKFLOWS (Numbers):');
    console.log(`  ${mod}+1                 - Add full screenshot to stack`);
    console.log(`  ${mod}+2                 - Add region screenshot to stack`);
    console.log(`  ${mod}+3                 - Process screenshot stack`);
    console.log(`  ${mod}+4                 - Clear screenshot stack`);
    console.log('\nTIER 3 - UTILITIES (Function Keys):');
    console.log('  F1                     - Show this help');
    console.log('  F11                    - Toggle window size (alternative)');
    console.log(`\nTIER 4 - ADVANCED (${mod}+Shift + Key):`);
    console.log(`  ${mod}+Shift+0           - Toggle window size`);
    console.log(`  ${mod}+Shift+R           - Reset AI session`);
    console.log(`  ${mod}+Shift+F           - Toggle AI flow`);
    console.log(`  ${mod}+Shift+O           - Toggle OCR filtering`);
    console.log(`  ${mod}+Shift+D           - Toggle theme`);
    console.log(`  ${mod}+Shift+V           - Conversation history`);
    console.log(`  ${mod}+Shift+C           - Center window`);
    console.log(`  ${mod}+Shift+S/A         - Alternative screenshot shortcuts`);
    console.log(`\nTIER 5 - FINE CONTROL (${mod}+Shift + Symbols/Arrows):`);
    console.log(`  ${mod}+Shift+Arrows      - Resize window height`);
    console.log(`  ${mod}+Shift+[ ]         - Resize window width`);
    console.log(`  ${mod}+Shift+Plus/-      - Adjust movement step`);
    const mouseKey = process.platform === 'darwin' ? 'Cmd+Option+M' : 'Ctrl+Alt+M';
    console.log(`  ${mouseKey}           - Mouse tracking toggle`);
    console.log('\nOTHER:');
    console.log('  Shift+X/Z              - Scroll page up/down');
    console.log(`  ${mod}+Shift+M/Y/W/L/I   - Model/System/Warmup/Format/DevTools`);
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

    console.log('Mouse tracking enabled - LEFT CLICK anywhere to take region screenshot + AI query');
    this.windowManager.send('show-notification', {
      type: 'info',
      message: 'Mouse tracking ON - Click anywhere to screenshot + AI query'
    });

    // Set up interval to check mouse position and clicks
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

    // Add click detection via renderer process
    this.windowManager.send('mouse-tracking-started');
  }

  /**
   * Stop tracking mouse position
   */
  stopMouseTracking() {
    if (this.mouseTrackingInterval) {
      clearInterval(this.mouseTrackingInterval);
      this.mouseTrackingInterval = null;
    }

    // Stop click detection
    this.windowManager.send('mouse-tracking-stopped');
  }

  /**
   * Handle left click during mouse tracking - take screenshot and query AI
   */
  handleMouseTrackingClick() {
    console.log('[ShortcutManager] Triggering region screenshot + AI query from mouse tracking');

    // Disable mouse tracking temporarily
    this.stopMouseTracking();
    this.mouseTrackingEnabled = false;

    // Trigger region screenshot
    this.windowManager.send('trigger-screenshot-region-with-ai');

    console.log('Mouse tracking disabled - region screenshot triggered');
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
