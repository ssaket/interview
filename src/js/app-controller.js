const { app, ipcMain, desktopCapturer, nativeImage, screen } = require('electron');
const path = require('path');
const WindowManager = require('./window-manager');
const { AIManager } = require('./ai/index');
const ShortcutManager = require('./shortcut-manager');
const OCRLogger = require('./ocr-logger');
// const AudioService = require('./audio-service');  ← later

class AppController {
  constructor() {
    this.windowManager = new WindowManager();
    this.aiManager = new AIManager(this);
    this.shortcutManager = new ShortcutManager(this.windowManager, this.aiManager, this);
    this.ocrLogger = new OCRLogger({
      logDir: path.join(process.cwd(), 'logs', 'ocr'),
      enableLogging: true,
      maxLogAge: 90, // Keep logs for 90 days
    });
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
    ipcMain.handle('perform-ocr', async (_event, imageDataUrl, options = {}) => {
      const startTime = Date.now();
      const Tesseract = require('tesseract.js');

      try {
        const {
          data: { text, confidence },
        } = await Tesseract.recognize(imageDataUrl, 'eng');

        let finalText = text;
        const cleaningOptions = {
          maxLines: 30,
          preserveQuestions: true,
          preserveCode: true,
          removeJunk: true,
          logResults: false,
          applyOCRFixes: true,
        };

        if (this.ocrFilteringEnabled) {
          const LLMFriendlyOCRCleaner = require('./llm-friendly-ocr-cleaner');
          const cleaner = new LLMFriendlyOCRCleaner();

          finalText = cleaner.cleanText(text, cleaningOptions);
        }

        // Log OCR processing session
        const processingTime = Date.now() - startTime;
        await this.ocrLogger.logOCRSession({
          originalText: text,
          cleanedText: finalText,
          confidence: confidence || 0,
          contentType: options.contentType || 'unknown',
          preset: options.preset || 'auto',
          processingTime,
          filteringEnabled: this.ocrFilteringEnabled,
          cleaningOptions,
          imageSize: options.imageSize,
          preprocessed: options.preprocessed || false,
        });

        // Mark this as OCR context for the next AI query
        this.lastOcrText = finalText;
        this.isOcrContext = true;

        return finalText;
      } catch (error) {
        console.error('[OCR] Processing failed:', error);
        throw error;
      }
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

    /* ------------ Movement Step Adjustment ------------ */
    ipcMain.handle('adjust-movement-step', async (_event, direction) => {
      const currentStep = this.shortcutManager.adjustMovementStep(direction);
      this.windowManager.send('movement-step-changed', currentStep);
      return currentStep;
    });
  }

  /**
   * Handle OCR queries with Ollama first, DeepSeek fallback when burn mode enabled
   * @param {string} question - The OCR text to query
   * @returns {Promise<string>} Formatted response
   */
  async handleOcrQuery(question) {
    console.log('[OCR Query] Processing OCR query with fallback mechanism...');

    try {
      await this.ensureOllamaProvider();
      const ollamaInfo = this.aiManager.getProviderInfo();

      const finalResponse = this.burnModeEnabled 
        ? await this.executeParallelQuery(question, ollamaInfo)
        : await this.executeSingleQuery(question, ollamaInfo);

      await this.restoreOllamaProvider();
      this.updateSessionLength();

      return finalResponse;
    } catch (error) {
      console.error('[OCR Query] Error during OCR processing:', error);
      await this.restoreOllamaProvider();
      throw error;
    }
  }

  /**
   * Ensure Ollama provider is active for OCR processing
   */
  async ensureOllamaProvider() {
    const currentProvider = this.aiManager.getProviderInfo();
    if (!currentProvider.isOllama) {
      await this.aiManager.switchProvider('ollama');
    }
    console.log('[OCR Query] Querying Ollama (local)...');
  }

  /**
   * Restore Ollama provider after OCR processing
   */
  async restoreOllamaProvider() {
    const currentProvider = this.aiManager.getProviderInfo();
    if (!currentProvider.isOllama) {
      try {
        await this.aiManager.switchProvider('ollama');
        console.log('[OCR Query] Switched back to Ollama');
      } catch (restoreError) {
        console.warn('[OCR Query] Failed to switch back to Ollama:', restoreError.message);
      }
    }
  }

  /**
   * Update session length in UI
   */
  updateSessionLength() {
    const sess = this.aiManager.getSession();
    this.windowManager.send('session-length', sess.history.length);
  }

  /**
   * Execute single model query (Ollama only)
   */
  async executeSingleQuery(question, ollamaInfo) {
    const ollamaResponse = await this.aiManager.ask(question);
    console.log('[OCR Query] Ollama response received');
    return ollamaResponse;
  }

  /**
   * Execute parallel queries to both Ollama and DeepSeek
   */
  async executeParallelQuery(question, ollamaInfo) {
    console.log('[OCR Query] Burn mode enabled - querying both models in parallel...');
    this.windowManager.send(
      'ai-processing-started',
      'both models are thinking... This may take 60-90 seconds for complex coding questions.'
    );

    try {
      const responses = await this.queryBothProviders(question, ollamaInfo);
      const finalResponse = this.formatDualResponse(responses.ollama, responses.deepseek);
      console.log('[OCR Query] Both responses received and formatted');
      this.windowManager.send('ai-processing-complete');
      return finalResponse;
    } catch (error) {
      console.error('[OCR Query] Parallel query failed:', error.message);
      const fallbackResponse = await this.handleParallelQueryError(question, ollamaInfo, error);
      this.windowManager.send('ai-processing-complete');
      return fallbackResponse;
    }
  }

  /**
   * Query both Ollama and DeepSeek providers in parallel
   */
  async queryBothProviders(question, ollamaInfo) {
    const ollamaPromise = this.aiManager.ask(question);
    
    const deepseekPromise = (async () => {
      await this.aiManager.switchProvider('deepseek', {
        model: 'deepseek-chat',
        apiKey: process.env.DEEPSEEK_API_KEY,
      });
      const deepseekInfo = this.aiManager.getProviderInfo();
      console.log(`[OCR Query] Using ${deepseekInfo.model}...`);
      return this.aiManager.ask(question);
    })();

    const [ollamaResponse, deepseekResponse] = await Promise.all([
      ollamaPromise,
      deepseekPromise
    ]);

    const deepseekInfo = this.aiManager.getProviderInfo();
    
    return {
      ollama: {
        provider: ollamaInfo.name,
        model: ollamaInfo.model,
        response: ollamaResponse,
      },
      deepseek: {
        provider: deepseekInfo.name,
        model: deepseekInfo.model,
        response: deepseekResponse,
      }
    };
  }

  /**
   * Handle error during parallel query execution
   */
  async handleParallelQueryError(question, ollamaInfo, error) {
    try {
      const ollamaResponse = await this.aiManager.ask(question);
      return `${ollamaResponse}\n\n---\n\n⚠️ **Parallel Query Error:** ${error.message}`;
    } catch (fallbackError) {
      return `⚠️ **Query Failed:** ${fallbackError.message}`;
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
    app.on('before-quit', async () => {
      this.shortcutManager.unregisterAll();
      await this.ocrLogger.shutdown();
    });
    app.on('window-all-closed', async () => {
      this.shortcutManager.unregisterAll();
      await this.ocrLogger.shutdown();
      if (process.platform !== 'darwin') app.quit();
    });
  }
}

module.exports = AppController;
