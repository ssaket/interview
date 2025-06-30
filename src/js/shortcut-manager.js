const { globalShortcut } = require('electron');
const AIManager = require('./ai-manager');

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
    globalShortcut.register('Command+Shift+0', () =>
      mainWindow.setSize(defaultWidth, defaultHeight)
    );

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
    globalShortcut.register('Command+Shift+P', () => this.aiManager.switchProvider());
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
      if (this.aiManager.isOllama) {
        this.windowManager.send(
          'model-warmup-started',
          `Warming up ${this.aiManager.currentModelName}... This may take 10‑30 seconds.`
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
    console.log('  Cmd+Shift+0           - Reset window size');
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
    if (!this.aiManager.isOllama) return;

    const burnMode = this.appController.burnModeEnabled;
    const allModels = burnMode
      ? AIManager.ollamaModels.all()
      : AIManager.ollamaModels.simple.slice();

    /* 1️⃣ Determine next model */
    const current = this.aiManager.currentModelName;
    const next = allModels[(allModels.indexOf(current) + 1) % allModels.length];

    /* 2️⃣ Save last user prompt from current session */
    const prevSession = this.aiManager.getSession();
    const lastUserMsg = [...prevSession.history].reverse().find((m) => m.role === 'user');

    /* 3️⃣ Switch */
    this.aiManager.currentModelName = next;
    process.env.OLLAMA_MODEL = next;
    this.aiManager.SYSTEM_PROMPT = this.aiManager.getSystemPrompt(next);

    try {
      this.aiManager.initialize('ollama');
    } catch (err) {
      console.error('Model switch failed:', err);
      this.windowManager.send('model-switch-failed', { model: next, error: err.message });
      throw err;
    }

    /* 4️⃣ Preserve context in new session */
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
    console.log(`Switched to ${next} (${newSession.history.length} messages preserved)`);
  }
}


module.exports = ShortcutManager;