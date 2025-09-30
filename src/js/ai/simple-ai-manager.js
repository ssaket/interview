const crypto = require('crypto');
const simpleAI = require('./simple-ai');
const MODEL_PROMPTS = require('../model-prompts');

/**
 * Simplified AI Manager
 *
 * Manages AI interactions without complex provider class hierarchy.
 * Uses simple functions instead of objects for better maintainability.
 */
class SimpleAIManager {
  constructor(appController) {
    this.appController = appController;

    // Configuration
    this.currentProvider = simpleAI.getDefaultProvider();
    this.currentModel = this._getDefaultModelForProvider(this.currentProvider);

    // Session management
    this.sessions = new Map(); // Per-provider-model session storage

    // State
    this.isInitialized = true;
    this.systemPromptsEnabled = true; // Toggle for system prompts

    console.log(
      `[SimpleAIManager] Initialized with ${this.currentProvider} using model: ${this.currentModel}`
    );
  }

  /**
   * Switch to a different provider
   * @param {string} providerName - Target provider name
   * @param {boolean} silent - If true, don't send UI notifications
   */
  async switchProvider(providerName, silent = false) {
    if (!providerName) {
      throw new Error('Provider name is required');
    }

    const previousProvider = this.currentProvider;

    try {
      // Test the provider is available
      const available = await simpleAI.testProvider(providerName);
      if (!available) {
        throw new Error(`Provider ${providerName} is not available`);
      }

      this.currentProvider = providerName;
      this.currentModel = this._getDefaultModelForProvider(providerName);

      // Notify the app controller about the switch (unless silent)
      if (!silent) {
        this.appController.windowManager.send('provider-switched', {
          from: previousProvider,
          to: this.currentProvider,
          provider: this.currentProvider,
          model: this.currentModel,
          isOllama: this.isOllama(),
        });
      }

      console.log(
        `[SimpleAIManager] ${silent ? 'Silently switched' : 'Switched'} to ${providerName} using model: ${this.currentModel}`
      );
      return true;
    } catch (error) {
      console.error(`[SimpleAIManager] Failed to switch to ${providerName}:`, error.message);
      throw error;
    }
  }

  /**
   * Cycle through available providers
   */
  async cycleProvider() {
    const availableProviders = simpleAI.getAllProviders();
    const currentIndex = availableProviders.indexOf(this.currentProvider);
    const nextIndex = (currentIndex + 1) % availableProviders.length;
    const nextProvider = availableProviders[nextIndex];

    await this.switchProvider(nextProvider);
  }

  /**
   * Send a query to the AI
   * @param {string} query - User query
   * @param {Object} options - Query options
   * @returns {Promise<Object>} AI response
   */
  async query(query, options = {}) {
    if (!query || typeof query !== 'string') {
      throw new Error('Query must be a non-empty string');
    }

    const sessionKey = this._getSessionKey(this.currentProvider, this.currentModel);
    const session = this._getOrCreateSession(sessionKey);

    // Add system prompt if this is the first message and system prompts are enabled
    if (session.messages.length === 0 && this.systemPromptsEnabled) {
      const systemPrompt = this._getSystemPrompt();
      if (systemPrompt) {
        console.log(
          `[SimpleAIManager] System prompt for ${this.currentProvider}:${this.currentModel}:`
        );
        console.log('--- SYSTEM PROMPT START ---');
        console.log(systemPrompt);
        console.log('--- SYSTEM PROMPT END ---');
        session.messages.push({
          role: 'system',
          content: systemPrompt,
        });
      } else {
        console.log(
          `[SimpleAIManager] No system prompt found for ${this.currentProvider}:${this.currentModel}`
        );
      }
    } else if (session.messages.length === 0 && !this.systemPromptsEnabled) {
      console.log(`[SimpleAIManager] System prompts disabled - skipping system prompt`);
    }

    // Add user message
    session.messages.push({
      role: 'user',
      content: query,
    });

    // Limit session history
    this._limitSessionHistory(session);

    // Log the complete message array being sent to AI
    console.log(
      `[SimpleAIManager] Sending ${session.messages.length} messages to ${this.currentProvider}:${this.currentModel}`
    );
    session.messages.forEach((msg, index) => {
      if (msg.role === 'system') {
        console.log(`Message ${index}: [SYSTEM] (${msg.content.length} chars)`);
      } else {
        console.log(
          `Message ${index}: [${msg.role.toUpperCase()}] ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`
        );
      }
    });

    try {
      const response = await simpleAI.chatCompletion({
        provider: this.currentProvider,
        messages: session.messages,
        parameters: options.parameters || {},
        stream: options.stream || false,
        onChunk: options.onChunk || null,
      });

      const content = this._extractContent(response);

      // Add assistant response to session
      session.messages.push({
        role: 'assistant',
        content: content,
      });

      // Update session metadata
      session.lastUsed = Date.now();
      session.requestCount++;

      return {
        content,
        provider: this.currentProvider,
        model: this.currentModel,
        sessionKey,
        response,
      };
    } catch (error) {
      console.error(`[SimpleAIManager] Query failed:`, error.message);
      throw error;
    }
  }

  /**
   * Test if current provider is available
   * @returns {Promise<boolean>} True if available
   */
  async warmup() {
    if (!this.currentProvider) {
      return false;
    }

    try {
      return await simpleAI.testProvider(this.currentProvider);
    } catch (error) {
      console.warn(`[SimpleAIManager] Warmup failed:`, error.message);
      return false;
    }
  }

  /**
   * Clear session history
   * @param {string} sessionKey - Optional specific session to clear
   */
  clearSession(sessionKey = null) {
    if (sessionKey) {
      this.sessions.delete(sessionKey);
    } else {
      const currentSessionKey = this._getSessionKey(this.currentProvider, this.currentModel);
      this.sessions.delete(currentSessionKey);
    }
  }

  /**
   * Clear all sessions
   */
  clearAllSessions() {
    this.sessions.clear();
  }

  /**
   * Get session information
   * @returns {Object} Session info
   */
  getSessionInfo() {
    const sessionKey = this._getSessionKey(this.currentProvider, this.currentModel);
    const session = this.sessions.get(sessionKey);

    if (!session) {
      return {
        provider: this.currentProvider,
        model: this.currentModel,
        messageCount: 0,
        lastUsed: null,
      };
    }

    return {
      provider: this.currentProvider,
      model: this.currentModel,
      messageCount: session.messages.length,
      lastUsed: session.lastUsed,
      requestCount: session.requestCount,
    };
  }

  /**
   * Get session statistics (compatibility method for WebSocket server)
   * @returns {Object} Session statistics
   */
  getSessionStats() {
    const sessionKey = this._getSessionKey(this.currentProvider, this.currentModel);
    const session = this.sessions.get(sessionKey);

    if (!session) {
      return {
        historyLength: 0,
        isActive: false,
        provider: this.currentProvider,
        model: this.currentModel,
      };
    }

    return {
      historyLength: session.messages.length,
      isActive: true,
      provider: this.currentProvider,
      model: this.currentModel,
    };
  }

  /**
   * Set model for current provider
   * @param {string} modelName - Model name
   */
  setModel(modelName) {
    this.currentModel = modelName;
    simpleAI.updateProviderConfig(this.currentProvider, { model: modelName });
  }

  /**
   * Get available models for current provider
   * @returns {Array} Available models
   */
  getAvailableModels() {
    return simpleAI.getAvailableModels(this.currentProvider);
  }

  /**
   * Ask the AI a question (compatibility method)
   * @param {string} question - The question to ask
   * @param {Object} options - Additional options including flow information
   * @returns {Promise<string>} The AI's response content
   */
  async ask(question, options = {}) {
    const flow = options.flow;

    // Handle special flows with streaming
    if (flow && ['local', 'cloud', 'hybrid'].includes(flow)) {
      return await this._executeFlow(question, options, flow);
    }

    // Default non-streaming query
    const response = await this.query(question, options);
    return response.content;
  }

  /**
   * Query AI with image inputs (vision models)
   * @param {string} question - The question to ask about the image(s)
   * @param {Array} images - Array of base64 image data or data URLs
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} AI response
   */
  async queryWithImage(question, images, options = {}) {
    if (!images || !Array.isArray(images) || images.length === 0) {
      throw new Error('Images array is required for vision queries');
    }

    // Save current state
    const originalProvider = this.currentProvider;
    const originalModel = this.currentModel;

    try {
      // Switch to Ollama if not already using it (currently only Ollama supports vision)
      if (this.currentProvider !== 'ollama') {
        await this.switchProvider('ollama', true);
      }

      // Check if current provider supports vision
      const aiConfig = require('./ai-config');
      if (!aiConfig.hasVisionSupport(this.currentProvider)) {
        throw new Error(
          `Provider ${this.currentProvider} does not support vision models. Please switch to Ollama and ensure you have vision-capable models like gemma3, llava, or bakllava installed.`
        );
      }

      // Get and validate vision model
      const visionModel = aiConfig.getVisionModel(this.currentProvider);
      if (!visionModel || visionModel === this.currentModel) {
        throw new Error(
          `No vision model configured for ${this.currentProvider}. Please install a vision model: ollama pull ${visionModel || 'gemma3:27b'}`
        );
      }

      // Test if the vision model is available
      const originalModelForProvider = this.currentModel;
      try {
        this.setModel(visionModel);

        // Quick test to ensure model is available
        const isAvailable = await simpleAI.testProvider(this.currentProvider);
        if (!isAvailable) {
          throw new Error(
            `Vision model ${visionModel} is not available. Please pull it with: ollama pull ${visionModel}`
          );
        }
      } catch (testError) {
        // Restore original model on test failure
        this.setModel(originalModelForProvider);
        throw new Error(
          `Failed to access vision model ${visionModel}: ${testError.message}. Try: ollama pull ${visionModel}`
        );
      }

      console.log(
        `[SimpleAIManager] Switched to vision model: ${visionModel} for multimodal query`
      );

      // Add images to parameters
      const visionOptions = {
        ...options,
        parameters: {
          ...options.parameters,
          images: images,
        },
      };

      // Execute the vision query
      const response = await this.query(question, visionOptions);

      // Restore original model for this provider but keep the provider switch
      this.setModel(originalModelForProvider);

      return response;
    } catch (error) {
      // Restore original state on error
      if (originalProvider !== this.currentProvider) {
        try {
          await this.switchProvider(originalProvider, true);
          this.setModel(originalModel);
        } catch (restoreError) {
          console.error('[SimpleAIManager] Failed to restore provider after vision error:', restoreError);
        }
      }

      console.error(`[SimpleAIManager] Vision query failed:`, error.message);
      throw error;
    }
  }

  /**
   * Unified flow execution handler
   * @private
   */
  async _executeFlow(question, options, flow) {
    console.log(`[SimpleAIManager] Starting ${flow} flow with streaming...`);

    const state = this._saveCurrentState();

    try {
      if (flow === 'hybrid') {
        return await this._executeHybridFlow(question, options);
      } else {
        return await this._executeSingleProviderFlow(question, options, flow);
      }
    } catch (error) {
      console.error(`[SimpleAIManager] ${flow} flow failed:`, error.message);
      throw error;
    } finally {
      await this._restoreState(state);
    }
  }

  /**
   * Execute single provider flow (local or cloud)
   * @private
   */
  async _executeSingleProviderFlow(question, options, flow) {
    const provider = flow === 'local' ? 'ollama' : 'deepseek';

    if (this.currentProvider !== provider) {
      await this.switchProvider(provider, true);
    }

    const response = await this.query(question, {
      stream: true,
      onChunk: options.onChunk,
      parameters: options.parameters || {},
    });

    console.log(`[SimpleAIManager] ${flow} flow completed successfully`);
    return response.content;
  }

  /**
   * Execute hybrid flow with TRUE parallel processing
   * Total time = max(local_time, cloud_time) instead of local_time + cloud_time
   * @private
   */
  async _executeHybridFlow(question, options) {
    console.log('[SimpleAIManager] Starting TRUE parallel hybrid flow...');

    return new Promise((resolve, reject) => {
      let localCompleted = false;
      let cloudCompleted = false;
      let localResponse = '';
      let cloudResponse = '';
      let separatorAdded = false;

      const startTime = Date.now();

      try {
        // Create coordinated streaming handlers
        const localOnChunk = (chunk) => {
          if (options.onChunk) {
            options.onChunk(chunk);
          }
        };

        const cloudOnChunk = (chunk) => {
          // Only stream cloud chunks after local completes and separator is added
          if (localCompleted && separatorAdded && options.onChunk) {
            options.onChunk(chunk);
          }
        };

        // Check if both phases are complete
        const checkCompletion = () => {
          if (localCompleted && cloudCompleted) {
            const totalTime = Date.now() - startTime;
            console.log(`[SimpleAIManager] TRUE parallel hybrid flow completed in ${totalTime}ms`);
            resolve(localResponse + '\n\n---\n\n**🧠 DeepSeek Analysis:**\n\n' + cloudResponse);
          }
        };

        // Start both phases simultaneously (TRUE parallel execution)
        this._processLocalPhase(question, {
          ...options,
          onChunk: localOnChunk,
        })
          .then((response) => {
            localResponse = response;
            localCompleted = true;
            console.log('[SimpleAIManager] Local phase completed, adding separator...');

            // Add separator after local completes
            if (options.onChunk) {
              options.onChunk('\n\n---\n\n**🧠 DeepSeek Analysis:**\n\n');
            }
            separatorAdded = true;

            checkCompletion();
          })
          .catch((error) => {
            console.error('[SimpleAIManager] Local phase failed:', error);
            localCompleted = true; // Mark as complete to allow cloud to continue
            checkCompletion();
          });

        this._processCloudPhase(question, {
          ...options,
          onChunk: cloudOnChunk,
        })
          .then((response) => {
            cloudResponse = response;
            cloudCompleted = true;
            console.log('[SimpleAIManager] Cloud phase completed');
            checkCompletion();
          })
          .catch((error) => {
            console.error('[SimpleAIManager] Cloud phase failed:', error);
            cloudResponse = `\n\n**❌ DeepSeek Error:** ${error.message}`;
            cloudCompleted = true;
            checkCompletion();
          });

        // Don't await here - let them run in parallel!
        // The checkCompletion() function will resolve the promise when both are done
      } catch (error) {
        console.error('[SimpleAIManager] Hybrid flow setup failed:', error);
        reject(this._handleHybridError(error, '', options.onChunk));
      }
    });
  }

  /**
   * Save current provider state
   * @private
   */
  _saveCurrentState() {
    return {
      provider: this.currentProvider,
      model: this.currentModel,
    };
  }

  /**
   * Process local AI phase with optimized prompt (parallel execution)
   * @private
   */
  async _processLocalPhase(question, options) {
    console.log('[SimpleAIManager] Phase 1: Starting local response (TRUE parallel)...');

    // Add local phase header immediately
    if (options.onChunk) {
      options.onChunk('🚀 **Local AI Response:**\n\n');
    }

    try {
      const aiConfig = require('./ai-config');
      const hybridModel = aiConfig.getHybridModel('ollama');

      if (this.currentProvider !== 'ollama') {
        await this.switchProvider('ollama', true);
      }
      this.setModel(hybridModel);

      // Use optimized prompt for quick local analysis
      const localPrompt = `Quick summary and initial thoughts: ${question}`;
      const localResponse = await this.query(localPrompt, {
        stream: true,
        onChunk: options.onChunk, // Direct streaming to UI
        parameters: {
          temperature: 0.7, // Slightly higher for creativity
          max_tokens: 512, // Limit for quick response
          ...options.parameters,
        },
      });

      console.log('[SimpleAIManager] Local phase streaming completed');
      return localResponse.content;
    } catch (error) {
      console.error('[SimpleAIManager] Local phase failed:', error);
      throw error;
    }
  }

  /**
   * Add phase separator
   * @private
   */
  _addPhaseSeparator(onChunk) {
    const separator = '\n\n---\n\n**🧠 DeepSeek Analysis:**\n\n';
    if (onChunk) {
      onChunk(separator);
    }
    return separator;
  }

  /**
   * Process cloud AI phase (DeepSeek) with detailed analysis (parallel execution)
   * @private
   */
  async _processCloudPhase(question, options) {
    console.log('[SimpleAIManager] Phase 2: Starting cloud response (TRUE parallel)...');

    try {
      // Switch to cloud provider
      await this.switchProvider('deepseek', true);

      // Use detailed prompt for comprehensive analysis
      const cloudPrompt = `Provide a detailed technical analysis and comprehensive solution for: ${question}

Please include:
- In-depth technical reasoning
- Step-by-step solution approach
- Best practices and considerations
- Potential edge cases or alternatives`;

      const cloudResponse = await this.query(cloudPrompt, {
        stream: true,
        onChunk: options.onChunk, // Will be controlled by hybrid flow coordination
        parameters: {
          temperature: 0.1, // Lower for precision
          max_tokens: 4096, // Higher for detailed response
          ...options.parameters,
        },
      });

      console.log('[SimpleAIManager] Cloud phase streaming completed');
      return cloudResponse.content;
    } catch (error) {
      console.error('[SimpleAIManager] Cloud phase failed:', error);
      throw error;
    }
  }

  /**
   * Handle hybrid flow errors
   * @private
   */
  _handleHybridError(error, combinedResponse, onChunk) {
    const errorMsg = `\n\n**❌ DeepSeek Error:** ${error.message}`;
    if (onChunk) {
      onChunk(errorMsg);
    }
    return combinedResponse + errorMsg;
  }

  /**
   * Restore provider state
   * @private
   */
  async _restoreState(state) {
    try {
      if (state.provider !== this.currentProvider) {
        await this.switchProvider(state.provider, true);
        this.setModel(state.model);
      }
    } catch (restoreError) {
      console.error('[SimpleAIManager] Failed to restore provider:', restoreError.message);
    }
  }

  /**
   * Get current provider information (compatibility method)
   * @returns {Object} Provider info
   */
  getProviderInfo() {
    return {
      name: this.currentProvider,
      model: this.currentModel,
      isOllama: this.isOllama(),
    };
  }

  /**
   * Get session (compatibility method)
   * @returns {Object} Session object with history
   */
  getSession() {
    const sessionKey = this._getSessionKey(this.currentProvider, this.currentModel);
    const session = this.sessions.get(sessionKey);

    if (!session) {
      return {
        history: [],
        active: false,
      };
    }

    // Convert messages to history format for compatibility
    const history = session.messages
      .filter((msg) => msg.role !== 'system')
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

    return {
      history,
      active: true,
    };
  }

  /**
   * Initialize method (compatibility - already initialized in constructor)
   */
  initialize() {
    // Already initialized in constructor
    return Promise.resolve();
  }

  /**
   * Check if current provider is Ollama
   * @returns {boolean} True if Ollama
   */
  isOllama() {
    return this.currentProvider === 'ollama';
  }

  /**
   * Get current provider name
   * @returns {string} Provider name
   */
  getCurrentProvider() {
    return this.currentProvider;
  }

  /**
   * Get current model name
   * @returns {string} Model name
   */
  getCurrentModel() {
    return this.currentModel;
  }

  /**
   * Toggle system prompts on/off
   * @returns {boolean} New state of system prompts
   */
  toggleSystemPrompts() {
    this.systemPromptsEnabled = !this.systemPromptsEnabled;
    console.log(
      `[SimpleAIManager] System prompts ${this.systemPromptsEnabled ? 'enabled' : 'disabled'}`
    );
    return this.systemPromptsEnabled;
  }

  /**
   * Get system prompts enabled state
   * @returns {boolean} Whether system prompts are enabled
   */
  getSystemPromptsEnabled() {
    return this.systemPromptsEnabled;
  }

  // Private methods

  _getDefaultModelForProvider(providerName) {
    return simpleAI.getCurrentModel(providerName);
  }

  _getSessionKey(provider, model) {
    return `${provider}:${model}`;
  }

  _getOrCreateSession(sessionKey) {
    if (!this.sessions.has(sessionKey)) {
      this.sessions.set(sessionKey, {
        id: crypto.randomUUID(),
        messages: [],
        createdAt: Date.now(),
        lastUsed: Date.now(),
        requestCount: 0,
      });
    }
    return this.sessions.get(sessionKey);
  }

  _limitSessionHistory(session, maxMessages = 20) {
    if (session.messages.length > maxMessages) {
      // Keep system message (if exists) and last maxMessages - 1 messages
      const systemMessage = session.messages[0]?.role === 'system' ? [session.messages[0]] : [];
      const recentMessages = session.messages.slice(-(maxMessages - systemMessage.length));
      session.messages = [...systemMessage, ...recentMessages];
    }
  }

  _getSystemPrompt() {
    const modelType = this._getModelType(this.currentModel);
    console.log(`[SimpleAIManager] Model: ${this.currentModel} -> Type: ${modelType}`);

    const prompt = MODEL_PROMPTS.getModelPrompt(modelType);

    if (prompt && typeof prompt === 'string') {
      return prompt;
    }

    // Fallback to default prompt
    return prompt || null;
  }

  _getModelType(modelName = '') {
    const name = modelName.toLowerCase();
    if (name.includes('gemma3') || name.includes('gemma-3')) return 'gemma3';
    if (name.includes('mistral') || name.includes('magistral')) return 'mistral';
    if (name.includes('qwen')) return 'qwen';
    if (name.includes('codellama')) return 'codellama';
    if (name.includes('deepseek')) return 'deepseek';
    return 'default';
  }

  _extractContent(response) {
    if (response.choices && response.choices.length > 0) {
      const choice = response.choices[0];
      if (choice.message && choice.message.content) {
        return choice.message.content;
      }
    }

    // Fallback for different response formats
    if (typeof response === 'string') {
      return response;
    }

    if (response.content) {
      return response.content;
    }

    throw new Error('Invalid response format: no content found');
  }
}

module.exports = SimpleAIManager;
