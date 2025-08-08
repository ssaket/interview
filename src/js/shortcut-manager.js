const { globalShortcut } = require('electron');

class ShortcutManager {
  /**
   * @param {WindowManager} windowManager
   * @param {AIManager}     aiManager
   * @param {AppController} appController   – for toggling OCR / burn‑mode flags
   */
  constructor(windowManager, aiManager, appController) {
    this.windowManager = windowManager;
    this.aiManager = aiManager;
    this.appController = appController;
    this.isSmallWindowMode = false; // Track window size state
  }

  /** Register all global shortcuts that were previously in registerShortcuts(). */
  register() {
    const { mainWindow } = this.windowManager;
    let moveStep = 20;
    let resizeStep = 50;
    const defaultWidth = 800;
    const defaultHeight = 800;
    const minSize = 100;

    /* ─── Movement ─── */
    ['Left', 'Right', 'Up', 'Down'].forEach((dir) => {
      globalShortcut.register(`Command+${dir}`, () => {
        const [x, y] = mainWindow.getPosition();
        const dx = dir === 'Left' ? -moveStep : dir === 'Right' ? moveStep : 0;
        const dy = dir === 'Up' ? -moveStep : dir === 'Down' ? moveStep : 0;
        mainWindow.setPosition(x + dx, y + dy);
      });
    });
    globalShortcut.register('Command+Shift+=', () => {
      if (moveStep < 400) moveStep *= 2;
    });
    globalShortcut.register('Command+Shift+-', () => {
      if (moveStep > 20) moveStep /= 2;
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
        mainWindow.setSize(resizeStep*20, resizeStep*2);
        this.isSmallWindowMode = true;
        console.log('Window toggled to small size (900x200)');
      }
    });

    /* ─── Help ─── */
    globalShortcut.register('Command+Shift+H', () => this.showHelp());

    /* ─── Window visibility ─── */
    globalShortcut.register('Command+B', () =>
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
    );

    /* ─── Audio streaming triggers (renderer only) ─── */
    globalShortcut.register('Command+R', () => this.windowManager.send('start-audio'));
    globalShortcut.register('Command+T', () => this.windowManager.send('stop-audio'));

    /* ─── Session reset ─── */
    globalShortcut.register('Command+Shift+R', () => {
      const session = this.aiManager.getSession?.();
      if (session) session.history = [];
      this.windowManager.send('session-reset');
      this.windowManager.send('session-length', 0);
    });

    /* ─── OCR filtering toggle ─── */
    globalShortcut.register('Command+Shift+F', () => {
      this.appController.ocrFilteringEnabled = !this.appController.ocrFilteringEnabled;
      this.windowManager.send('ocr-filtering-changed', this.appController.ocrFilteringEnabled);
    });

    /* ─── Burn mode toggle ─── */
    globalShortcut.register('Command+Shift+Q', () => {
      this.appController.burnModeEnabled = !this.appController.burnModeEnabled;
      this.windowManager.send('burn-mode-changed', this.appController.burnModeEnabled);
    });

    /* ─── AI provider / model switches ─── */
    globalShortcut.register('Command+Shift+P', () => this.aiManager.cycleProvider());
    globalShortcut.register('Command+Shift+M', () => this.switchOllamaModel());

    /* ─── Misc renderer events ─── */
    globalShortcut.register('Command+Shift+D', () => this.windowManager.send('toggle-theme'));
    globalShortcut.register('Shift+X', () => this.windowManager.send('scroll-page', 'up'));
    globalShortcut.register('Shift+Z', () => this.windowManager.send('scroll-page', 'down'));
    globalShortcut.register('Command+Shift+S', () => this.windowManager.send('trigger-screenshot'));
    globalShortcut.register('Command+Shift+A', () =>
      this.windowManager.send('trigger-overlay-region-screenshot')
    );
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
  }

  unregisterAll() {
    globalShortcut.unregisterAll();
  }

  /* ---------- Helpers ---------- */
  showHelp() {
    console.log('\n=== KEYBOARD SHORTCUTS HELP ===');
    console.log('WINDOW MOVEMENT:');
    console.log('  Cmd+Arrow Keys        - Move window in direction');
    console.log('\nWINDOW RESIZING:');
    console.log('  Cmd+Shift+=           - Increase movement step');
    console.log('  Cmd+Shift+-           - Decrease movement step');
    console.log('  Cmd+Shift+]           - Increase window width');
    console.log('  Cmd+Shift+[           - Decrease window width');
    console.log('  Cmd+Shift+Up/Down     - Adjust window height');
    console.log('  Cmd+Shift+0           - Toggle window size (800x200 ⇄ 800x800)');
    console.log('\nWINDOW CONTROL:');
    console.log('  Cmd+B                 - Toggle window visibility');
    console.log('\nAUDIO:');
    console.log('  Cmd+R / Cmd+T         - Start / Stop audio');
    console.log('\nSESSION / OCR / PROVIDER:');
    console.log('  Cmd+Shift+R           - Reset session');
    console.log('  Cmd+Shift+F           - Toggle OCR filtering');
    console.log('  Cmd+Shift+P           - Switch AI provider');
    console.log('  Cmd+Shift+M           - Switch Ollama model');
    console.log('  Cmd+Shift+Q           - Toggle burn mode');
    console.log('\nMISC:');
    console.log('  Cmd+Shift+D           - Toggle dark/light theme');
    console.log('  Cmd+Shift+S / A       - Capture screenshot / region');
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

    const burnMode = this.appController.burnModeEnabled;
    const ollamaModels = this.aiManager.getOllamaModels();
    const allModels = burnMode ? ollamaModels.all() : ollamaModels.simple.slice();
    this.aiManager;

    /* 1️⃣ Determine next model */
    const current = info.model;
    const next = allModels[(allModels.indexOf(current) + 1) % allModels.length];

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
      this.aiManager.initialize('ollama');
    } catch (err) {
      console.error('Model switch failed:', err);
      this.windowManager.send('model-switch-failed', { model: next, error: err.message });
      throw err;
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
}

module.exports = ShortcutManager;
