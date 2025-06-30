const { app, ipcMain, desktopCapturer, nativeImage, screen } = require('electron');
const WindowManager = require('./window-manager');
const AIManager = require('./ai-manager');
const ShortcutManager = require('./shortcut-manager');
// const AudioService = require('./audio-service');  ← later

class AppController {
  constructor() {
    this.windowManager = new WindowManager();
    this.aiManager = new AIManager(this);
    this.shortcutManager = new ShortcutManager(this.windowManager, this.aiManager, this);
    this.ocrFilteringEnabled = true;
    this.burnModeEnabled = false;
  }

  /* ---------- IPC handlers ---------- */
  registerIpc() {
    ipcMain.handle('get-ocr-filtering-state', async () => this.ocrFilteringEnabled);
    ipcMain.handle('get-burn-mode-state', async () => this.burnModeEnabled);

    ipcMain.handle('get-provider-status', async () => ({
      provider: this.aiManager.currentProvider,
      isOllama: this.aiManager.isOllama,
      model: this.aiManager.isOllama
        ? this.aiManager.currentModelName
        : process.env.HF_MODEL || 'deepseek-ai/DeepSeek-R1-0528',
    }));

    /* ------------ Screen Capture ------------ */
    ipcMain.handle('capture-screen', async () => {
      const { mainWindow } = this.windowManager;
      mainWindow.webContents.send('hide-ui');
      await new Promise((r) => setTimeout(r, 100));

      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 },
      });

      mainWindow.webContents.send('show-ui');
      return sources[0].thumbnail.toDataURL();
    });

    ipcMain.handle('capture-screen-region', async () => {
      const { mainWindow } = this.windowManager;
      mainWindow.webContents.send('hide-ui');
      await new Promise((r) => setTimeout(r, 100));

      const [windowX, windowY] = mainWindow.getPosition();
      const [windowWidth, windowHeight] = mainWindow.getSize();

      const { bounds } = screen.getPrimaryDisplay();
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: bounds.width, height: bounds.height },
      });

      mainWindow.webContents.send('show-ui');

      const region = { x: windowX, y: windowY, width: windowWidth, height: windowHeight };
      try {
        const full = nativeImage.createFromDataURL(sources[0].thumbnail.toDataURL());
        const cropped = full.crop(region);
        return cropped.toDataURL();
      } catch (err) {
        console.error('Error cropping image:', err);
        return sources[0].thumbnail.toDataURL();
      }
    });

    /* ------------ OCR (Tesseract) ------------ */
    ipcMain.handle('perform-ocr', async (_event, imageDataUrl) => {
      const Tesseract = require('tesseract.js');
      const {
        data: { text },
      } = await Tesseract.recognize(imageDataUrl, 'eng');

      let finalText = text;

      if (this.ocrFilteringEnabled) {
        const LLMFriendlyOCRCleaner = require('./llm-friendly-ocr-cleaner');
        const cleaner = new LLMFriendlyOCRCleaner();

        finalText = cleaner.cleanText(text, {
          maxLines: 30,
          preserveQuestions: true,
          preserveCode: true,
          removeJunk: true,
          logResults: false,
          applyOCRFixes: true,
        });
      }

      return finalText;
    });

    /* ------------ Ask ChatGPT / AI ------------ */
    ipcMain.handle('ask-chatgpt', async (_event, question) => {
      try {
        return await this.aiManager.ask(question);
      } catch (err) {
        // Format a user‑friendly error string similar to the old implementation
        let errorMsg =
          `⚠️ ${this.aiManager.isOllama ? 'Ollama' : 'HuggingFace'} inference failed: ` +
          (err.message || err);

        if (this.aiManager.isOllama) {
          if (err.message && err.message.includes('Ollama server not running')) {
            errorMsg = '⚠️ Ollama server not running. Please start with: ollama serve';
          }
          if (
            err.message &&
            (err.message.includes('model not found') || err.message.includes('Model'))
          ) {
            errorMsg = `⚠️ ${this.aiManager.currentModelName} model not found. Please pull with: ollama pull ${this.aiManager.currentModelName}`;
          }
          if (err.message && err.message.includes('timeout')) {
            errorMsg = `⚠️ ${this.aiManager.currentModelName} timeout. This reasoning model typically takes 60‑90 seconds for complex coding questions.`;
          }
        } else if (err.status === 429 || (err.response && err.response.status === 429)) {
          errorMsg = '⚠️ Rate limit exceeded. Please try again later.';
        }

        // Update session length in UI even on error
        const sess = this.aiManager.getSession();
        this.windowManager.send('session-length', sess.history.length);
        return errorMsg;
      }
    });

    /* ------------ Cycle Ollama Model (UI button) ------------ */
    ipcMain.handle('cycle-ollama-model', async () => {
      try {
        this.shortcutManager.switchOllamaModel();
        return { success: true, model: this.aiManager.currentModelName };
      } catch (err) {
        console.error('Failed to switch Ollama model:', err);
        return { success: false, error: err.message };
      }
    });

    /* ------------ Ollama Warm‑Up ------------ */
    ipcMain.handle('warmup-ollama-model', async () => {
      const ok = await this.aiManager.warmup();
      return { success: ok };
    });

    /* ------------ Check Ollama Connection ------------ */
    ipcMain.handle('check-ollama-connection', async () => {
      try {
        const ok = await this.aiManager.warmup();
        return { connected: ok };
      } catch {
        return { connected: false };
      }
    });
  }

  start() {
    app.whenReady().then(() => {
      this.windowManager.create();
      this.shortcutManager.register();
      this.registerIpc();
      this.aiManager.initialize();
    });
    app.on('before-quit', () => this.shortcutManager.unregisterAll());
    app.on('window-all-closed', () => {
      this.shortcutManager.unregisterAll();
      if (process.platform !== 'darwin') app.quit();
    });
  }
}

module.exports = AppController;
