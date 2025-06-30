const { app, ipcMain, desktopCapturer, nativeImage, screen } = require('electron');
const WindowManager = require('./window-manager');
const { AIManager } = require('./ai/index');
const ShortcutManager = require('./shortcut-manager');
// const AudioService = require('./audio-service');  ← later

class AppController {
  constructor() {
    this.windowManager = new WindowManager();
    this.aiManager = new AIManager(this);
    this.shortcutManager = new ShortcutManager(this.windowManager, this.aiManager, this);
    this.ocrFilteringEnabled = true;
    this.burnModeEnabled = false;

    // Track OCR context for fallback queries
    this.lastOcrText = null;
    this.isOcrContext = false;
  }

  /* ---------- IPC handlers ---------- */
  registerIpc() {
    ipcMain.handle('get-ocr-filtering-state', async () => this.ocrFilteringEnabled);
    ipcMain.handle('get-burn-mode-state', async () => this.burnModeEnabled);

    ipcMain.handle('get-provider-status', async () => {
      const info = this.aiManager.getProviderInfo();
      return {
        provider: info.name,
        isOllama: info.isOllama,
        model: info.model,
      };
    });

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

      // Mark this as OCR context for the next AI query
      this.lastOcrText = finalText;
      this.isOcrContext = true;

      return finalText;
    });

    /* ------------ Ask ChatGPT / AI with OCR Fallback ------------ */
    ipcMain.handle('ask-chatgpt', async (_event, question) => {
      try {
        // Check if this is an OCR query
        const isOcrQuery = this.isOcrContext && (question === this.lastOcrText || this.lastOcrText);

        if (isOcrQuery) {
          this.isOcrContext = false; // Reset flag
          return await this.handleOcrQuery(question);
        }

        // Regular query - use current provider
        return await this.aiManager.ask(question);
      } catch (err) {
        const info = this.aiManager.getProviderInfo();

        // Format a user‑friendly error string
        let errorMsg =
          `⚠️ ${info.isOllama ? 'Ollama' : info.name} inference failed: ` + (err.message || err);

        if (info.isOllama) {
          if (err.message && err.message.includes('Ollama server not running')) {
            errorMsg = '⚠️ Ollama server not running. Please start with: ollama serve';
          }
          if (
            err.message &&
            (err.message.includes('model not found') || err.message.includes('Model'))
          ) {
            errorMsg = `⚠️ ${info.model} model not found. Please pull with: ollama pull ${info.model}`;
          }
          if (err.message && err.message.includes('timeout')) {
            errorMsg = `⚠️ ${info.model} timeout. This reasoning model typically takes 60‑90 seconds for complex coding questions.`;
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
        const info = this.aiManager.getProviderInfo();
        return { success: true, model: info.model };
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

  /**
   * Handle OCR queries with Ollama first, DeepSeek fallback when burn mode enabled
   * @param {string} question - The OCR text to query
   * @returns {Promise<string>} Formatted response
   */
  async handleOcrQuery(question) {
    const originalProvider = this.aiManager.getProviderInfo();
    const responses = {};
    let finalResponse = '';

    console.log('[OCR Query] Processing OCR query with fallback mechanism...');

    try {
      // Step 1: Always query Ollama first for OCR (local processing)
      console.log('[OCR Query] Querying Ollama (local)...');

      // Ensure we're using Ollama for OCR
      if (!originalProvider.isOllama) {
        await this.aiManager.switchProvider('ollama');
      }

      // Query Ollama
      const ollamaInfo = this.aiManager.getProviderInfo();
      console.log(`[OCR Query] Using ${ollamaInfo.model}...`);

      const ollamaResponse = await this.aiManager.ask(question);
      responses.ollama = {
        provider: ollamaInfo.name,
        model: ollamaInfo.model,
        response: ollamaResponse,
      };

      finalResponse = ollamaResponse;
      console.log('[OCR Query] Ollama response received');

      // Step 2: If burn mode enabled, also query DeepSeek
      if (this.burnModeEnabled) {
        console.log('[OCR Query] Burn mode enabled - querying DeepSeek...');

        try {
          // Switch to DeepSeek
          await this.aiManager.switchProvider('deepseek', {
            model: 'deepseek-chat', // Use chat model for OCR queries
            apiKey: process.env.DEEPSEEK_API_KEY,
          });

          const deepseekInfo = this.aiManager.getProviderInfo();
          console.log(`[OCR Query] Using ${deepseekInfo.model}...`);

          const deepseekResponse = await this.aiManager.ask(question);
          responses.deepseek = {
            provider: deepseekInfo.name,
            model: deepseekInfo.model,
            response: deepseekResponse,
          };

          // Format dual response
          finalResponse = this.formatDualResponse(responses.ollama, responses.deepseek);
          console.log('[OCR Query] DeepSeek response received and formatted');
        } catch (deepseekError) {
          console.error('[OCR Query] DeepSeek query failed:', deepseekError.message);

          // Add error note to Ollama response
          finalResponse = `${ollamaResponse}\n\n---\n\n⚠️ **DeepSeek Error:** ${deepseekError.message}`;
        }
      }

      // Step 3: Always switch back to Ollama after OCR processing
      const currentProvider = this.aiManager.getProviderInfo();
      if (!currentProvider.isOllama) {
        try {
          await this.aiManager.switchProvider('ollama');
          console.log('[OCR Query] Switched back to Ollama');
        } catch (restoreError) {
          console.warn('[OCR Query] Failed to switch back to Ollama:', restoreError.message);
        }
      }

      // Update session length
      const sess = this.aiManager.getSession();
      this.windowManager.send('session-length', sess.history.length);

      return finalResponse;
    } catch (error) {
      console.error('[OCR Query] Error during OCR processing:', error);

      // Try to restore Ollama on error
      const currentProvider = this.aiManager.getProviderInfo();
      if (!currentProvider.isOllama) {
        try {
          await this.aiManager.switchProvider('ollama');
        } catch (restoreError) {
          console.warn('[OCR Query] Failed to restore Ollama after error:', restoreError.message);
        }
      }

      throw error;
    }
  }

  /**
   * Format dual response from Ollama and DeepSeek for display
   * @param {Object} ollamaResult - Ollama response object
   * @param {Object} deepseekResult - DeepSeek response object
   * @returns {string} Formatted response
   */
  formatDualResponse(ollamaResult, deepseekResult) {
    return (
      `🤖 **${ollamaResult.model}** (Local)\n` +
      `${ollamaResult.response}\n\n` +
      `---\n\n` +
      `🔥 **${deepseekResult.model}** (Cloud)\n` +
      `${deepseekResult.response}\n\n` +
      `*Burn mode: Showing responses from both local and cloud providers*`
    );
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
