const { app, ipcMain, desktopCapturer, screen } = require('electron');
const WindowManager = require('./window-manager');
const SimpleAIManager = require('./ai/simple-ai-manager');
const ShortcutManager = require('./shortcut-manager');
const KeyHoldManager = require('./key-hold-manager');
const ConversationWebSocketServer = require('./conversation-websocket-server');
const AIResponseLogger = require('./ai-response-logger');
const { pickSourceForDisplay, computeCropRegion } = require('./screen-capture');

class AppController {
  constructor() {
    this.windowManager = new WindowManager();
    this.aiManager = new SimpleAIManager(this);
    this.responseLogger = new AIResponseLogger();
    this.conversationWebSocketServer = new ConversationWebSocketServer(this.aiManager, this.windowManager);
    this.shortcutManager = new ShortcutManager(this.windowManager, this.aiManager, this);
    this.keyHoldManager = new KeyHoldManager(this.windowManager);
    this.ocrFilteringEnabled = true;

    // Track OCR context for initial query detection
    this.lastOcrText = null;
    this.isOcrContext = false;

    // Track screenshot data for vision processing
    this.lastScreenshotDataUrl = null;

    // Screenshot stack for batch processing
    this.screenshotStack = [];

    // Track active streaming requests for cancellation
    this.activeStreamingRequests = new Set();

    // Track AbortControllers for AI requests (requestId → AbortController)
    this.abortControllers = new Map();

    // Cancellation flags
    this.ocrCancelled = false;
    this.stackProcessingCancelled = false;

    // Shared Tesseract worker, created on first OCR (see getOcrWorker)
    this.ocrWorkerPromise = null;

    // Content preservation for syntax toggle
    this.originalResponses = new Map();
    this.currentSyntaxMode = 'ALL'; // 'ALL' or 'CODE_ONLY'


    // Start WebSocket server
    this.startWebSocketServer();
  }

  /* ---------- Streaming Management ---------- */

  /**
   * Cancel all active streaming AI requests
   */
  cancelAllStreamingRequests() {
    console.log(
      `[AppController] Cancelling ${this.activeStreamingRequests.size} active streaming requests`
    );

    // Abort all HTTP requests via AbortControllers
    for (const [requestId, controller] of this.abortControllers.entries()) {
      try {
        controller.abort();
        console.log(`[AppController] Aborted request ${requestId}`);
      } catch (err) {
        console.error(`[AppController] Failed to abort request ${requestId}:`, err);
      }
    }

    this.activeStreamingRequests.clear();
    this.abortControllers.clear();
  }

  /**
   * Check if any streaming requests are currently active
   * @returns {boolean} True if streaming is active
   */
  isStreamingActive() {
    return this.activeStreamingRequests.size > 0;
  }

  /* ---------- OCR Worker ---------- */

  /**
   * Get the shared Tesseract worker, creating it on first use
   * Tesseract.recognize() starts and tears down a worker on every call; reusing one
   * cuts ~1/3 off each recognition (~270ms -> ~180ms on a typical problem screenshot)
   * @returns {Promise<Tesseract.Worker>}
   */
  getOcrWorker() {
    if (!this.ocrWorkerPromise) {
      const Tesseract = require('tesseract.js');
      this.ocrWorkerPromise = Tesseract.createWorker('eng', Tesseract.OEM.LSTM_ONLY, {
        // Without an errorHandler, tesseract.js throws a failed job's error from its message
        // listener. That throw is an uncaughtException, and the handler for it quits the app.
        // The job promise still rejects, so perform-ocr gets the error and reports it
        errorHandler: (error) => console.error('[OCR] Tesseract job failed:', error),
      }).catch((error) => {
        this.ocrWorkerPromise = null; // Let the next screenshot retry
        throw error;
      });
    }
    return this.ocrWorkerPromise;
  }

  /* ---------- Syntax Toggle Management ---------- */

  /**
   * Toggle between ALL content and CODE_ONLY modes
   * @returns {Object} Result with mode and content info
   */
  toggleSyntaxMode() {
    const newMode = this.currentSyntaxMode === 'ALL' ? 'CODE_ONLY' : 'ALL';
    this.currentSyntaxMode = newMode;

    console.log(`[AppController] Syntax mode toggled to: ${newMode}`);

    return {
      mode: newMode,
      previousMode: newMode === 'ALL' ? 'CODE_ONLY' : 'ALL',
    };
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
      const dataUrl = await this.captureScreenRegion();
      // Store screenshot data for potential vision processing
      this.lastScreenshotDataUrl = dataUrl;
      return dataUrl;
    });

    /* ------------ OCR (Tesseract) ------------ */
    ipcMain.handle('perform-ocr', async (_event, imageDataUrl, options = {}) => {
      const startTime = Date.now();

      console.log('[AppController] Starting OCR on image...');
      console.log('[AppController] Image data URL length:', imageDataUrl.length);

      try {
        // Check if OCR was cancelled before starting
        if (this.ocrCancelled) {
          console.log('[AppController] OCR cancelled before starting');
          return '';
        }

        const worker = await this.getOcrWorker();

        const {
          data: { text, confidence },
        } = await worker.recognize(imageDataUrl);

        // Check if cancelled after recognition
        if (this.ocrCancelled) {
          console.log('[AppController] OCR cancelled after recognition');
          return '';
        }

        console.log('[AppController] Raw OCR text length:', text.length);
        console.log('[AppController] OCR confidence:', confidence);
        console.log('[AppController] Raw OCR text preview:', text.substring(0, 200));

        let finalText = text;

        // Apply OCR cleaning. The AI pass runs a local Ollama model before the question is
        // sent, so DeepSeek-only flows skip it - their prompts already ignore OCR noise
        if (this.ocrFilteringEnabled && !this.ocrCancelled) {
          const LLMFriendlyOCRCleaner = require('./llm-friendly-ocr-cleaner');
          const cleaner = new LLMFriendlyOCRCleaner();
          const enhanceWithAI = this.aiManager.flowUsesLocalModel(options.flow);

          console.log(
            `[AppController] Starting ${enhanceWithAI ? 'AI-enhanced' : 'basic'} OCR cleaning (flow: ${options.flow || 'unknown'})...`
          );
          finalText = await cleaner.cleanText(text, { enhanceWithAI });

          // Check if cancelled after cleaning
          if (this.ocrCancelled) {
            console.log('[AppController] OCR cancelled after cleaning');
            return '';
          }

          console.log('[AppController] AI-enhanced text length:', finalText.length);
          console.log('[AppController] AI-enhanced text: \n', finalText);
        }

        const duration = Date.now() - startTime;
        console.log(`[AppController] Text extraction completed in ${duration}ms`);

        // Mark this as OCR context for the next query (simple flag for UI)
        this.lastOcrText = finalText;
        this.isOcrContext = true;

        return finalText;
      } catch (error) {
        // Check if this is a cancellation
        if (this.ocrCancelled) {
          console.log('[AppController] OCR cancelled due to error during cancellation');
          return '';
        }
        console.error('[OCR] Text extraction failed:', error);
        throw error;
      }
    });

    /* ------------ Ask ChatGPT / AI ------------ */
    ipcMain.handle('ask-chatgpt', async (event, question, options = {}) => {
      const requestId = Math.random().toString(36).substring(2, 15);
      const flowType = options.flow || null;

      // Create AbortController for this request
      const abortController = new AbortController();

      try {
        // Track this request for potential cancellation
        this.activeStreamingRequests.add(requestId);
        this.abortControllers.set(requestId, abortController);

        // Notify UI that AI processing has started
        event.sender.send('ai-processing-started');

        // Set up streaming callback if requested
        if (options.onChunk) {
          options.onChunk = (chunk) => {
            // Check if request was cancelled before sending chunk
            if (this.activeStreamingRequests.has(requestId)) {
              // Send chunk to renderer process
              event.sender.send('ai-chunk', chunk);
            }
          };
        }

        // Pass AbortSignal to options
        options.signal = abortController.signal;

        // Check if this is the initial OCR query (question matches extracted text from OCR/Vision)
        const isInitialOcrQuery = this.isOcrContext && question === this.lastOcrText;

        let response;
        if (isInitialOcrQuery) {
          // Initial query after screenshot - extracted text sent as query
          console.log('[AppController] Processing initial query from extracted text');
          this.clearOcrContext();
          response = await this.handleOcrQuery(question, options);
        } else {
          // Regular query - AI session handles all conversation context automatically
          response = await this.aiManager.ask(question, options);
        }

        // Clean up tracking
        this.activeStreamingRequests.delete(requestId);
        this.abortControllers.delete(requestId);

        // Store original response for syntax toggle
        if (response && typeof response === 'string') {
          const responseId = `response_${Date.now()}_${Math.random().toString(36).substring(2)}`;
          this.originalResponses.set(responseId, response);

          // Clean up old responses (keep last 10)
          if (this.originalResponses.size > 10) {
            const entries = Array.from(this.originalResponses.entries());
            const toDelete = entries.slice(0, entries.length - 10);
            toDelete.forEach(([key]) => this.originalResponses.delete(key));
          }
        }

        // Log AI response for formatter analysis
        this._logAIResponse(question, response, flowType);

        // Broadcast history update via WebSocket
        if (this.conversationWebSocketServer && this.conversationWebSocketServer.isRunning) {
          await this.conversationWebSocketServer.broadcastHistoryUpdate();
        }

        // Notify UI that AI processing has completed
        event.sender.send('ai-processing-complete');

        return response;
      } catch (err) {
        // Clean up tracking on error
        this.activeStreamingRequests.delete(requestId);
        this.abortControllers.delete(requestId);

        // Notify UI that AI processing has completed (even on error)
        event.sender.send('ai-processing-complete');

        // Check if this was an abort (user cancelled)
        if (err.name === 'AbortError' || err.code === 'ERR_CANCELED' || err.message?.includes('abort')) {
          console.log('[AppController] AI request was cancelled by user');
          return '🛑 Request cancelled';
        }

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

        // Log error response
        this._logAIResponse(question, errorMsg, flowType, true);

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

    /* ------------ Syntax Toggle (Code-Only Mode) ------------ */
    ipcMain.handle('toggle-syntax-code-only', async () => {
      if (this.isStreamingActive()) {
        return {
          success: false,
          error: 'Cannot toggle syntax while streaming is active',
        };
      }

      try {
        const result = this.toggleSyntaxMode();
        return { success: true, ...result };
      } catch (error) {
        return { success: false, error: error.message };
      }
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

    ipcMain.handle('process-screenshot-stack', async (_event, options = {}) => {
      if (this.screenshotStack.length === 0) {
        return { success: false, error: 'No screenshots in stack' };
      }

      try {
        const combinedText = await this.processStackedScreenshots(options.flow);

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
        this.aiManager.clearAllSessions();
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

    /* ------------ Master Reset ------------ */
    ipcMain.handle('master-reset', async () => {
      try {
        await this.masterReset();
        return { success: true };
      } catch (error) {
        // masterReset should never throw, but just in case
        console.error('Failed to execute master reset:', error);
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

    // Capture the display that holds the window. It is not always the primary display
    const windowBounds = mainWindow.getBounds();
    const display = screen.getDisplayMatching(windowBounds);
    const { bounds, scaleFactor } = display;

    // Use physical pixels for high-DPI displays to ensure full resolution capture
    const physicalWidth = Math.round(bounds.width * scaleFactor);
    const physicalHeight = Math.round(bounds.height * scaleFactor);

    let sources;
    try {
      sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: physicalWidth, height: physicalHeight },
      });
    } finally {
      mainWindow.webContents.send('show-ui');
    }

    const source = pickSourceForDisplay(sources, display);
    if (!source || source.thumbnail.isEmpty()) {
      throw new Error('Screen capture returned no image - check the Screen Recording permission');
    }

    const image = source.thumbnail;
    const imageSize = image.getSize();
    console.log(
      `[Screenshot] Display ${display.id}: ${bounds.width}x${bounds.height} logical at ` +
        `(${bounds.x}, ${bounds.y}), ${scaleFactor}x scale; captured ${imageSize.width}x${imageSize.height}`
    );

    // Crop the captured NativeImage directly - round-tripping the full screen through a
    // PNG data URL first cost ~300ms per screenshot on a Retina display
    const region = computeCropRegion(windowBounds, bounds, imageSize);
    if (!region) {
      console.warn('[Screenshot] Window is not on the captured display - using the full screen');
      return image.toDataURL();
    }

    console.log(`[Screenshot] Cropped region: ${region.width}x${region.height} pixels`);
    return image.crop(region).toDataURL();
  }

  /**
   * Process all screenshots in the stack through OCR and combine results
   * @param {string} flow - AI flow the text is for; DeepSeek-only flows skip the AI cleanup pass
   */
  async processStackedScreenshots(flow) {
    const startTime = Date.now();
    const worker = await this.getOcrWorker();

    let combinedText = '';
    const ocrResults = [];

    for (let i = 0; i < this.screenshotStack.length; i++) {
      // Check if stack processing was cancelled
      if (this.stackProcessingCancelled) {
        console.log('[Stack] Screenshot stack processing cancelled');
        return '';
      }

      const screenshot = this.screenshotStack[i];

      try {
        console.log(
          `[Stack] Processing screenshot ${i + 1}/${this.screenshotStack.length} (${screenshot.type})`
        );

        const {
          data: { text, confidence },
        } = await worker.recognize(screenshot.data);

        // Check again after async operation
        if (this.stackProcessingCancelled) {
          console.log('[Stack] Screenshot stack processing cancelled after OCR');
          return '';
        }

        let finalText = text;
        if (this.ocrFilteringEnabled) {
          const LLMFriendlyOCRCleaner = require('./llm-friendly-ocr-cleaner');
          const cleaner = new LLMFriendlyOCRCleaner();
          console.log(`[Stack] Applying basic cleaning to screenshot ${i + 1}...`);
          finalText = cleaner.cleanText(text, { enhanceWithAI: false }); // Basic cleaning only
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
        // Check if this is a cancellation
        if (this.stackProcessingCancelled) {
          console.log('[Stack] Screenshot stack processing cancelled during error');
          return '';
        }
        console.error(`[Stack] OCR failed for screenshot ${i + 1}:`, error);
        combinedText += `--- Screenshot ${i + 1} (${screenshot.type}) - OCR FAILED ---\nError: ${error.message}\n\n`;
      }
    }

    // Apply AI enhancement to the complete merged text (flows that use a local model only)
    if (
      this.ocrFilteringEnabled &&
      this.aiManager.flowUsesLocalModel(flow) &&
      combinedText.trim().length > 0 &&
      !this.stackProcessingCancelled
    ) {
      const LLMFriendlyOCRCleaner = require('./llm-friendly-ocr-cleaner');
      const cleaner = new LLMFriendlyOCRCleaner();
      console.log('[Stack] Applying AI enhancement to complete merged text...');
      combinedText = await cleaner.cleanText(combinedText, { enhanceWithAI: true });

      // Check one last time after AI enhancement
      if (this.stackProcessingCancelled) {
        console.log('[Stack] Screenshot stack processing cancelled after AI enhancement');
        return '';
      }

      console.log('[Stack] AI-enhanced merged text length:', combinedText.length);
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

  start() {
    app.whenReady().then(() => {
      this.windowManager.create();
      this.shortcutManager.register();
      this.keyHoldManager.start();
      this.registerIpc();
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

    // Handle unhandled promise rejections (prevent app crashes)
    process.on('unhandledRejection', (reason, promise) => {
      console.error('[AppController] ⚠️ Unhandled Promise Rejection:', reason);
      console.error('[AppController] Promise:', promise);
      console.log('[AppController] 💡 Tip: Press Cmd+Shift+R (Ctrl+Shift+R on Windows) for Master Reset to recover from errors');

      // Don't exit - log the error and continue running
      // This prevents the app from crashing when providers are unavailable

      // Optionally show a user-friendly notification
      try {
        this.windowManager.send('show-status-message', '⚠️ Error occurred - Press Cmd+Shift+R to reset', 5000);
      } catch (e) {
        // Ignore if window manager isn't ready
      }
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
   * Clear vision context tracking
   */
  clearVisionContext() {
    this.lastScreenshotDataUrl = null;
    console.log('[AppController] Vision context cleared');
  }

  /**
   * Clear all context tracking
   */
  clearAllContext() {
    this.clearOcrContext();
    this.clearVisionContext();
    console.log('[AppController] All context cleared');
  }

  /**
   * Master reset - recover app from any error state
   * This function is bulletproof and will never throw
   * Can be called even during unhandled exceptions
   */
  async masterReset() {
    console.log('[AppController] 🔄 MASTER RESET initiated...');

    try {
      // 0. IMMEDIATELY notify renderer to cancel any pending OCR-to-AI workflows
      // This must be FIRST to prevent race conditions
      try {
        this.windowManager.send('cancel-ocr-flow');
        console.log('[AppController] ✓ OCR flow cancellation signal sent to renderer');
      } catch (e) {
        console.error('[AppController] ✗ Failed to send OCR cancellation signal:', e.message);
      }

      // 1. Set cancellation flags to stop ongoing operations
      try {
        this.ocrCancelled = true;
        this.stackProcessingCancelled = true;
        console.log('[AppController] ✓ Cancellation flags set');
      } catch (e) {
        console.error('[AppController] ✗ Failed to set cancellation flags:', e.message);
      }

      // 2. Cancel all active streaming requests and abort HTTP requests
      try {
        this.cancelAllStreamingRequests(); // This aborts all AbortControllers
        console.log('[AppController] ✓ All HTTP requests aborted and streaming requests cancelled');
      } catch (e) {
        console.error('[AppController] ✗ Failed to cancel streaming:', e.message);
      }

      // 3. Stop KeyHoldManager continuous operations
      try {
        if (this.keyHoldManager && this.keyHoldManager.isListening) {
          this.keyHoldManager.stop();
          console.log('[AppController] ✓ KeyHoldManager stopped');
        }
      } catch (e) {
        console.error('[AppController] ✗ Failed to stop KeyHoldManager:', e.message);
      }

      // 4. Clear all AI sessions
      try {
        this.aiManager.clearAllSessions();
        console.log('[AppController] ✓ AI sessions cleared');
      } catch (e) {
        console.error('[AppController] ✗ Failed to clear sessions:', e.message);
      }

      // 5. Clear all context (OCR, vision, screenshot stack)
      try {
        this.clearAllContext();
        this.screenshotStack = [];
        console.log('[AppController] ✓ Context and screenshot stack cleared');
      } catch (e) {
        console.error('[AppController] ✗ Failed to clear context:', e.message);
      }

      // 6. Clear response cache
      try {
        this.originalResponses.clear();
        console.log('[AppController] ✓ Response cache cleared');
      } catch (e) {
        console.error('[AppController] ✗ Failed to clear response cache:', e.message);
      }

      // 7. Reset syntax mode to default
      try {
        this.currentSyntaxMode = 'ALL';
        console.log('[AppController] ✓ Syntax mode reset to ALL');
      } catch (e) {
        console.error('[AppController] ✗ Failed to reset syntax mode:', e.message);
      }

      // 8. Broadcast reset to WebSocket clients
      try {
        if (this.conversationWebSocketServer && this.conversationWebSocketServer.isRunning) {
          await this.conversationWebSocketServer.broadcastHistoryUpdate();
          console.log('[AppController] ✓ WebSocket clients notified');
        }
      } catch (e) {
        console.error('[AppController] ✗ Failed to notify WebSocket clients:', e.message);
      }

      // 9. Send reset signals to UI
      try {
        this.windowManager.send('session-reset');
        this.windowManager.send('session-length', 0);
        this.windowManager.send('screenshot-stack-updated', {
          count: 0,
          screenshots: [],
        });
        this.windowManager.send('show-status-message', '🔄 Master Reset Complete', 3000);
        console.log('[AppController] ✓ UI reset signals sent');
      } catch (e) {
        console.error('[AppController] ✗ Failed to send UI signals:', e.message);
      }

      // 10. Reset cancellation flags
      try {
        this.ocrCancelled = false;
        this.stackProcessingCancelled = false;
        console.log('[AppController] ✓ Cancellation flags reset');
      } catch (e) {
        console.error('[AppController] ✗ Failed to reset cancellation flags:', e.message);
      }

      // 11. Restart KeyHoldManager if window is visible
      try {
        if (this.keyHoldManager && this.windowManager.mainWindow && this.windowManager.mainWindow.isVisible()) {
          this.keyHoldManager.start();
          console.log('[AppController] ✓ KeyHoldManager restarted');
        }
      } catch (e) {
        console.error('[AppController] ✗ Failed to restart KeyHoldManager:', e.message);
      }

      console.log('[AppController] ✅ MASTER RESET completed successfully');
    } catch (error) {
      // Even if something goes catastrophically wrong, log it and continue
      console.error('[AppController] ⚠️ Master reset encountered errors but completed:', error);
    }
  }

  /**
   * Log AI response for formatter analysis
   * @private
   */
  _logAIResponse(question, response, flowType = null, isError = false) {
    try {
      const providerInfo = this.aiManager.getProviderInfo();
      const sessionStats = this.aiManager.getSessionStats();

      // Logging disabled
      // this.responseLogger.logResponse({
      //   question: question,
      //   response: response,
      //   provider: providerInfo.name,
      //   model: providerInfo.model,
      //   interviewType: this.aiManager.getCurrentInterviewType(),
      //   flowType: flowType,
      //   messageCount: sessionStats.historyLength,
      //   isError: isError,
      // });
    } catch (error) {
      console.error('[AppController] Failed to log AI response:', error.message);
    }
  }

  /**
   * Cleanup resources before shutdown
   */
  async cleanup() {
    console.log('[AppController] Cleaning up resources...');

    try {
      this.shortcutManager.unregisterAll();
      this.keyHoldManager.stop();
      await this.stopWebSocketServer();
      if (this.ocrWorkerPromise) {
        const worker = await this.ocrWorkerPromise;
        await worker.terminate();
      }
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
      networkUrls.forEach((networkUrl) => {
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
