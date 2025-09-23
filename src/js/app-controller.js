const { app, ipcMain, desktopCapturer, nativeImage, screen } = require('electron');
const path = require('path');
const WindowManager = require('./window-manager');
const SimpleAIManager = require('./ai/simple-ai-manager');
const ShortcutManager = require('./shortcut-manager');
const SpeechToTextService = require('./speech-to-text-service');
const ConversationWebSocketServer = require('./conversation-websocket-server');

class AppController {
  constructor() {
    this.windowManager = new WindowManager();
    this.aiManager = new SimpleAIManager(this);
    this.conversationWebSocketServer = new ConversationWebSocketServer(this.aiManager);
    this.shortcutManager = new ShortcutManager(this.windowManager, this.aiManager, this);
    this.speechService = new SpeechToTextService();
    this.ocrFilteringEnabled = true;

    // Track OCR context for initial query detection
    this.lastOcrText = null;
    this.isOcrContext = false;

    // Screenshot stack for batch processing
    this.screenshotStack = [];

    // Set up speech service callbacks
    this.setupSpeechCallbacks();

    // Start WebSocket server
    this.startWebSocketServer();
  }

  /* ---------- IPC handlers ---------- */
  registerIpc() {
    ipcMain.handle('get-ocr-filtering-state', async () => this.ocrFilteringEnabled);

    ipcMain.handle('get-provider-status', async () => {
      const info = this.aiManager.getProviderInfo();
      return {
        provider: info.name,
        isOllama: info.isOllama,
        model: info.model,
      };
    });

    /* ------------ Screen Capture (Region Only) ------------ */
    ipcMain.handle('capture-screen-region', async () => {
      const { mainWindow } = this.windowManager;
      mainWindow.webContents.send('hide-ui');
      await new Promise((r) => setTimeout(r, 100));

      const [windowX, windowY] = mainWindow.getPosition();
      const [windowWidth, windowHeight] = mainWindow.getSize();

      const primaryDisplay = screen.getPrimaryDisplay();
      const { bounds, scaleFactor } = primaryDisplay;

      // Use physical pixels for high-DPI displays to ensure full resolution capture
      const physicalWidth = Math.round(bounds.width * scaleFactor);
      const physicalHeight = Math.round(bounds.height * scaleFactor);

      console.log(`[Screenshot] Display: ${bounds.width}x${bounds.height} logical, ${physicalWidth}x${physicalHeight} physical (${scaleFactor}x scale)`);

      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: physicalWidth, height: physicalHeight },
      });

      mainWindow.webContents.send('show-ui');

      // Scale region coordinates to match physical pixels
      const region = {
        x: Math.round(windowX * scaleFactor),
        y: Math.round(windowY * scaleFactor),
        width: Math.round(windowWidth * scaleFactor),
        height: Math.round(windowHeight * scaleFactor)
      };

      try {
        const full = nativeImage.createFromDataURL(sources[0].thumbnail.toDataURL());
        const cropped = full.crop(region);
        console.log(`[Screenshot] Cropped region: ${region.width}x${region.height} pixels`);
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

      console.log('[AppController] Starting OCR on image...');
      console.log('[AppController] Image data URL length:', imageDataUrl.length);

      try {
        const {
          data: { text, confidence },
        } = await Tesseract.recognize(imageDataUrl, 'eng');

        console.log('[AppController] Raw OCR text length:', text.length);
        console.log('[AppController] OCR confidence:', confidence);
        console.log('[AppController] Raw OCR text preview:', text.substring(0, 200));

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
          console.log('[AppController] Cleaned text length:', finalText.length);
          console.log('[AppController] Cleaned text preview:', finalText.substring(0, 200));
        }


        // Mark this as OCR context for the next query (simple flag for UI)
        this.lastOcrText = finalText;
        this.isOcrContext = true;

        return finalText;
      } catch (error) {
        console.error('[OCR] Processing failed:', error);
        throw error;
      }
    });

    /* ------------ Ask ChatGPT / AI ------------ */
    ipcMain.handle('ask-chatgpt', async (event, question, options = {}) => {
      try {
        // Set up streaming callback if requested
        if (options.onChunk) {
          options.onChunk = (chunk) => {
            // Send chunk to renderer process
            event.sender.send('ai-chunk', chunk);
          };
        }

        // Check if this is the initial OCR query (question matches OCR text)
        const isInitialOcrQuery = this.isOcrContext && question === this.lastOcrText;

        if (isInitialOcrQuery) {
          // Initial OCR query - clear OCR flag since we're now in session history
          this.clearOcrContext();
          return await this.handleOcrQuery(question, options);
        }

        // Regular query - AI session handles all conversation context automatically
        const response = await this.aiManager.ask(question, options);

        // Broadcast history update via WebSocket
        if (this.conversationWebSocketServer && this.conversationWebSocketServer.isRunning) {
          await this.conversationWebSocketServer.broadcastHistoryUpdate();
        }

        return response;
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

    /* ------------ AI Flow Management ------------ */
    ipcMain.handle('switch-to-deepseek', async () => {
      try {
        await this.aiManager.switchProvider('deepseek');
        return { success: true };
      } catch (error) {
        console.error('Failed to switch to DeepSeek:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('switch-to-ollama', async () => {
      try {
        await this.aiManager.switchProvider('ollama');
        return { success: true };
      } catch (error) {
        console.error('Failed to switch to Ollama:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('switch-to-provider', async (_event, providerName) => {
      try {
        await this.aiManager.switchProvider(providerName);
        return { success: true };
      } catch (error) {
        console.error(`Failed to switch to ${providerName}:`, error);
        return { success: false, error: error.message };
      }
    });

    /* ------------ Movement Step Adjustment ------------ */
    ipcMain.handle('adjust-movement-step', async (_event, direction) => {
      const currentStep = this.shortcutManager.adjustMovementStep(direction);
      this.windowManager.send('movement-step-changed', currentStep);
      return currentStep;
    });

    /* ------------ Screenshot Stack Management ------------ */
    ipcMain.handle('add-screenshot-to-stack', async (_event, type) => {
      try {
        let screenshotData;
        if (type === 'region') {
          screenshotData = await this.captureScreenRegion();
        } else {
          throw new Error('Invalid screenshot type - only region supported');
        }

        const screenshot = {
          id: Date.now(),
          type,
          data: screenshotData,
          timestamp: new Date().toISOString(),
        };

        this.screenshotStack.push(screenshot);
        this.windowManager.send('screenshot-stack-updated', {
          count: this.screenshotStack.length,
          screenshots: this.screenshotStack.map((s) => ({
            id: s.id,
            type: s.type,
            timestamp: s.timestamp,
          })),
        });

        return { success: true, count: this.screenshotStack.length };
      } catch (error) {
        console.error('[Stack] Failed to add screenshot:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('get-screenshot-stack-count', async () => {
      return this.screenshotStack.length;
    });

    ipcMain.handle('clear-screenshot-stack', async () => {
      this.screenshotStack = [];
      this.windowManager.send('screenshot-stack-updated', {
        count: 0,
        screenshots: [],
      });
      return { success: true };
    });

    ipcMain.handle('process-screenshot-stack', async () => {
      if (this.screenshotStack.length === 0) {
        return { success: false, error: 'No screenshots in stack' };
      }

      try {
        const combinedText = await this.processStackedScreenshots();

        // Clear stack after processing
        this.screenshotStack = [];
        this.windowManager.send('screenshot-stack-updated', {
          count: 0,
          screenshots: [],
        });

        return { success: true, text: combinedText };
      } catch (error) {
        console.error('[Stack] Failed to process screenshots:', error);
        return { success: false, error: error.message };
      }
    });

    /* ------------ Speech-to-Text ------------ */
    ipcMain.handle('start-speech-recording', async () => {
      try {
        await this.speechService.startRecording();
        return { success: true };
      } catch (error) {
        console.error('Failed to start speech recording:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('stop-speech-recording', async () => {
      try {
        this.speechService.stopRecording();
        return { success: true };
      } catch (error) {
        console.error('Failed to stop speech recording:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('get-speech-status', async () => {
      return this.speechService.getStatus();
    });

    ipcMain.handle(
      'set-speech-language',
      async (_event, languageCode, useAutoDetection = false) => {
        try {
          this.speechService.setLanguage(languageCode, useAutoDetection);
          return { success: true, config: this.speechService.getLanguageConfigDescription() };
        } catch (error) {
          console.error('Failed to set speech language:', error);
          return { success: false, error: error.message };
        }
      }
    );

    ipcMain.handle('speech-to-ai', async (_event, speechText, options = {}) => {
      try {
        const metadata = {
          confidence: options.confidence || 1.0,
          duration: options.duration || 0,
          language: options.language || 'en',
        };

        await this.handleSpeechToAI(speechText, metadata);
        return { success: true };
      } catch (error) {
        console.error('Failed to process speech-to-AI:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('clear-ocr-context', async () => {
      this.clearOcrContext();
      return { success: true };
    });

    /* ------------ Conversation History ------------ */
    ipcMain.handle('open-conversation-history', async () => {
      try {
        const { shell } = require('electron');

        // Open the WebSocket server URL if running
        if (this.conversationWebSocketServer && this.conversationWebSocketServer.isRunning) {
          const url = this.conversationWebSocketServer.getUrl();
          await shell.openExternal(url);
          console.log(`[AppController] Opened live conversation history at ${url}`);
          return { success: true };
        } else {
          throw new Error('WebSocket server not running');
        }
      } catch (error) {
        console.error('Failed to open conversation history:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('get-conversation-stats', async () => {
      const session = this.aiManager.getSession();
      const providerInfo = this.aiManager.getProviderInfo();

      const userMessages = session.history.filter((msg) => msg.role === 'user').length;
      const assistantMessages = session.history.filter((msg) => msg.role === 'assistant').length;

      let totalCharacters = 0;
      let totalWords = 0;

      session.history.forEach((msg) => {
        if (msg.content) {
          totalCharacters += msg.content.length;
          totalWords += msg.content.split(/\s+/).length;
        }
      });

      return {
        totalMessages: session.history.length,
        userMessages,
        assistantMessages,
        totalCharacters,
        totalWords,
        lastUpdated: new Date().toISOString(),
        isActive: session.history.length > 0,
        provider: providerInfo.name,
        model: providerInfo.model,
      };
    });

    ipcMain.handle('clear-conversation-history', async () => {
      try {
        this.aiManager.clearSession();
        // Broadcast update via WebSocket
        if (this.conversationWebSocketServer && this.conversationWebSocketServer.isRunning) {
          await this.conversationWebSocketServer.broadcastHistoryUpdate();
        }
        return { success: true };
      } catch (error) {
        console.error('Failed to clear conversation history:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('export-conversation-history', async () => {
      try {
        // Broadcast current history via WebSocket
        if (this.conversationWebSocketServer && this.conversationWebSocketServer.isRunning) {
          await this.conversationWebSocketServer.broadcastHistoryUpdate();
        }
        return { success: true };
      } catch (error) {
        console.error('Failed to export conversation history:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('get-websocket-server-info', async () => {
      return this.conversationWebSocketServer.getStats();
    });

    ipcMain.handle('start-websocket-server', async () => {
      try {
        const url = await this.conversationWebSocketServer.start();
        return { success: true, url };
      } catch (error) {
        console.error('Failed to start WebSocket server:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('stop-websocket-server', async () => {
      try {
        await this.conversationWebSocketServer.stop();
        return { success: true };
      } catch (error) {
        console.error('Failed to stop WebSocket server:', error);
        return { success: false, error: error.message };
      }
    });
  }

  /**
   * Capture screen region screenshot (extracted from IPC handler)
   */
  async captureScreenRegion() {
    const { mainWindow } = this.windowManager;
    mainWindow.webContents.send('hide-ui');
    await new Promise((r) => setTimeout(r, 100));

    const [windowX, windowY] = mainWindow.getPosition();
    const [windowWidth, windowHeight] = mainWindow.getSize();

    const primaryDisplay = screen.getPrimaryDisplay();
    const { bounds, scaleFactor } = primaryDisplay;

    // Use physical pixels for high-DPI displays to ensure full resolution capture
    const physicalWidth = Math.round(bounds.width * scaleFactor);
    const physicalHeight = Math.round(bounds.height * scaleFactor);

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: physicalWidth, height: physicalHeight },
    });

    mainWindow.webContents.send('show-ui');

    // Scale region coordinates to match physical pixels
    const region = {
      x: Math.round(windowX * scaleFactor),
      y: Math.round(windowY * scaleFactor),
      width: Math.round(windowWidth * scaleFactor),
      height: Math.round(windowHeight * scaleFactor)
    };

    try {
      const full = nativeImage.createFromDataURL(sources[0].thumbnail.toDataURL());
      const cropped = full.crop(region);
      return cropped.toDataURL();
    } catch (err) {
      console.error('Error cropping image:', err);
      return sources[0].thumbnail.toDataURL();
    }
  }

  /**
   * Process all screenshots in the stack through OCR and combine results
   */
  async processStackedScreenshots() {
    const startTime = Date.now();
    const Tesseract = require('tesseract.js');

    const cleaningOptions = {
      maxLines: 30,
      preserveQuestions: true,
      preserveCode: true,
      removeJunk: true,
      logResults: false,
      applyOCRFixes: true,
    };

    let combinedText = '';
    const ocrResults = [];

    for (let i = 0; i < this.screenshotStack.length; i++) {
      const screenshot = this.screenshotStack[i];

      try {
        console.log(
          `[Stack] Processing screenshot ${i + 1}/${this.screenshotStack.length} (${screenshot.type})`
        );

        const {
          data: { text, confidence },
        } = await Tesseract.recognize(screenshot.data, 'eng');

        let finalText = text;
        if (this.ocrFilteringEnabled) {
          const LLMFriendlyOCRCleaner = require('./llm-friendly-ocr-cleaner');
          const cleaner = new LLMFriendlyOCRCleaner();
          finalText = cleaner.cleanText(text, cleaningOptions);
        }

        ocrResults.push({
          index: i + 1,
          type: screenshot.type,
          timestamp: screenshot.timestamp,
          originalText: text,
          cleanedText: finalText,
          confidence: confidence || 0,
        });

        combinedText += `--- Screenshot ${i + 1} (${screenshot.type}, ${new Date(screenshot.timestamp).toLocaleTimeString()}) ---\n${finalText}\n\n`;
      } catch (error) {
        console.error(`[Stack] OCR failed for screenshot ${i + 1}:`, error);
        combinedText += `--- Screenshot ${i + 1} (${screenshot.type}) - OCR FAILED ---\nError: ${error.message}\n\n`;
      }
    }


    // Mark this as OCR context for the next AI query
    this.lastOcrText = combinedText;
    this.isOcrContext = true;

    return combinedText;
  }

  /**
   * Handle OCR queries using the current AI manager
   * @param {string} question - The OCR text to query
   * @param {Object} options - Query options including flow information
   * @returns {Promise<string>} Formatted response
   */
  async handleOcrQuery(question, options = {}) {
    console.log('[OCR Query] Processing OCR query...');

    try {
      const response = await this.aiManager.ask(question, options);
      this.updateSessionLength();

      // Broadcast history update via WebSocket
      if (this.conversationWebSocketServer && this.conversationWebSocketServer.isRunning) {
        await this.conversationWebSocketServer.broadcastHistoryUpdate();
      }

      return response;
    } catch (error) {
      console.error('[OCR Query] Error during OCR processing:', error);
      throw error;
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
   * Set up callbacks for the speech-to-text service
   */
  setupSpeechCallbacks() {
    this.speechService.setCallbacks({
      onTranscriptReceived: async (text, metadata) => {
        console.log('Transcription received:', text);
        this.windowManager.send('transcription-received', text, metadata);

        // Auto-submit speech to AI if we have OCR context or ongoing conversation
        if (text && text.trim()) {
          await this.handleSpeechToAI(text, metadata);
        }
      },
      onError: (error) => {
        console.error('Speech service error:', error);
        this.windowManager.send('speech-error', error);
      },
      onStatusChange: (status, message) => {
        console.log('Speech status change:', status, message);
        this.windowManager.send('speech-status-update', status, message);
      },
    });
  }

  /**
   * Handle speech-to-text result by sending it to AI
   * @param {string} speechText - Transcribed speech text
   * @param {Object} metadata - Speech metadata (confidence, duration, etc.)
   */
  async handleSpeechToAI(speechText, metadata) {
    try {
      console.log(`[AppController] Processing speech input: "${speechText}"`);

      // Notify UI that we're processing speech as AI query
      this.windowManager.send('speech-to-ai-started', {
        text: speechText,
        confidence: metadata.confidence,
        hasSessionHistory: this.aiManager.getSession().history.length > 0,
      });

      // Simply send the speech text as a regular AI query
      // The AI session already maintains conversation history including any previous OCR/screenshot context
      const aiResponse = await this.aiManager.ask(speechText);

      // Broadcast history update via WebSocket
      if (this.conversationWebSocketServer && this.conversationWebSocketServer.isRunning) {
        await this.conversationWebSocketServer.broadcastHistoryUpdate();
      }

      // Notify UI with the AI response
      this.windowManager.send('speech-to-ai-completed', {
        speechText: speechText,
        aiResponse: aiResponse,
        confidence: metadata.confidence,
        duration: metadata.duration,
      });

      console.log('[AppController] Speech-to-AI workflow completed successfully');
    } catch (error) {
      console.error('[AppController] Speech-to-AI processing failed:', error);

      // Send error to UI
      this.windowManager.send('speech-to-ai-error', {
        speechText: speechText,
        error: error.message || error.toString(),
      });
    }
  }

  /** Register mouse tracking click handler */
  registerMouseTrackingHandlers() {
    const { ipcMain } = require('electron');

    ipcMain.on('mouse-tracking-click-detected', () => {
      console.log('[AppController] Mouse tracking click detected');
      this.shortcutManager.handleMouseTrackingClick();
    });
  }

  start() {
    app.whenReady().then(() => {
      this.windowManager.create();
      this.shortcutManager.register();
      this.registerIpc();
      this.registerMouseTrackingHandlers();
      this.aiManager.initialize();
    });
    app.on('before-quit', async () => {
      this.shortcutManager.unregisterAll();
    });
    app.on('window-all-closed', async () => {
      this.shortcutManager.unregisterAll();
      if (process.platform !== 'darwin') app.quit();
    });

    // Handle abrupt termination signals
    process.on('SIGINT', () => {
      console.log('Received SIGINT, cleaning up...');
      this.cleanup();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      console.log('Received SIGTERM, cleaning up...');
      this.cleanup();
      process.exit(0);
    });
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception, cleaning up:', error);
      this.cleanup();
      process.exit(1);
    });
  }

  /**
   * Clear OCR context flag
   */
  clearOcrContext() {
    this.isOcrContext = false;
    this.lastOcrText = null;
    console.log('[AppController] OCR context flag cleared');
  }

  /**
   * Cleanup resources before shutdown
   */
  async cleanup() {
    console.log('[AppController] Cleaning up resources...');

    try {
      this.shortcutManager.unregisterAll();
      await this.stopWebSocketServer();
    } catch (error) {
      console.error('[AppController] Error during cleanup:', error);
    }
  }

  /**
   * Start the WebSocket server for conversation history
   */
  async startWebSocketServer() {
    try {
      const url = await this.conversationWebSocketServer.start();
      const networkUrls = this.conversationWebSocketServer.getNetworkUrls();
      console.log(`[AppController] WebSocket server started at ${url}`);
      console.log('[AppController] Network accessible URLs:');
      networkUrls.forEach(networkUrl => {
        console.log(`  - ${networkUrl}`);
      });
    } catch (error) {
      console.error('[AppController] Failed to start WebSocket server:', error);
    }
  }

  /**
   * Stop the WebSocket server
   */
  async stopWebSocketServer() {
    try {
      await this.conversationWebSocketServer.stop();
      console.log('[AppController] WebSocket server stopped');
    } catch (error) {
      console.error('[AppController] Failed to stop WebSocket server:', error);
    }
  }
}

module.exports = AppController;
