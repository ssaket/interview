const crypto = require('crypto');
const { createProvider, getAvailableProviders } = require('./provider-factory');
const MODEL_PROMPTS = require('../model-prompts');
const { getProviderConfig } = require('./ai-config');

/**
 * Modern Object-Oriented AI Manager
 *
 * Uses Strategy pattern with Provider Factory to support multiple AI providers.
 * Maintains session state, caching, and provides a clean API for AI interactions.
 */
class AIManager {
  constructor(appController) {
    this.appController = appController;

    // Configuration
    this.currentProviderName = process.env.AI_PROVIDER || 'ollama';
    this.currentModelName = this._getDefaultModelForProvider(this.currentProviderName);

    // Provider management
    this.activeProvider = null;
    this.providerInstances = new Map(); // Cache of provider instances

    // Session management
    this.sessions = new Map(); // Per-model session storage
    this.globalCache = new Map(); // Shared cache across sessions

    // State
    this.isInitialized = false;

    // Initialize with default provider
    this.initialize();
  }

  /**
   * Initialize the AI Manager with the specified provider
   * @param {string} providerName - Provider to use (ollama, openai, huggingface)
   * @param {Object} config - Provider-specific configuration
   */
  initialize(providerName = this.currentProviderName, config = {}) {
    try {
      const provider = this._getOrCreateProvider(providerName, config);
      this.activeProvider = provider;
      this.currentProviderName = providerName;
      this.currentModelName = provider.getModel();
      this.isInitialized = true;

      console.log(
        `[AIManager] Initialized with ${providerName} provider using model: ${this.currentModelName}`
      );
    } catch (error) {
      console.error(`[AIManager] Failed to initialize with ${providerName}:`, error.message);
      throw error;
    }
  }

  /**
   * Switch to a different provider
   * @param {string} providerName - Target provider name
   * @param {Object} config - Optional configuration overrides
   */
  async switchProvider(providerName, config = {}) {
    if (!providerName) {
      throw new Error('Provider name is required');
    }

    const previousProvider = this.currentProviderName;

    try {
      this.initialize(providerName, config);

      // Notify the app controller about the switch
      this.appController.windowManager.send('provider-switched', {
        from: previousProvider,
        to: this.currentProviderName,
        provider: this.currentProviderName,
        model: this.currentModelName,
        isOllama: this.isOllama(),
      });

      return true;
    } catch (error) {
      console.error(`[AIManager] Failed to switch to ${providerName}:`, error.message);
      throw error;
    }
  }

  /**
   * Cycle through available providers
   */
  async cycleProvider() {
    const availableProviders = getAvailableProviders();
    const currentIndex = availableProviders.indexOf(this.currentProviderName);
    const nextIndex = (currentIndex + 1) % availableProviders.length;
    const nextProvider = availableProviders[nextIndex];

    await this.switchProvider(nextProvider);
  }

  /**
   * Ask the AI a question and get a response
   * @param {string} question - The question to ask
   * @param {Object} options - Additional options for the request
   * @returns {Promise<string>} The AI's response
   */
  async ask(question, options = {}) {
    if (!this.isInitialized || !this.activeProvider) {
      throw new Error('AI Manager not initialized');
    }

    // Input validation
    if (!question || typeof question !== 'string') {
      throw new Error('Question must be a non-empty string');
    }

    const session = this.getSession();

    // Check cache first
    const questionHash = crypto.createHash('md5').update(question).digest('hex');
    if (session.cache.has(questionHash)) {
      console.log(`[AIManager] Cache hit for hash ${questionHash}`);
      return session.cache.get(questionHash);
    }

    console.log(
      `[AIManager] Cache miss for hash ${questionHash}, querying ${this.currentProviderName}...`
    );

    // Show processing indicator for slower providers
    if (this.isOllama()) {
      this.appController.windowManager.send(
        'ai-processing-started',
        `${this.currentModelName} is thinking... This may take 60-90 seconds for complex coding questions.`
      );
    }

    try {
      // Build messages array
      const messages = [
        { role: 'system', content: this.getSystemPrompt() },
        ...session.history,
        { role: 'user', content: question },
      ];

      // Call the provider
      const response = await this.activeProvider.chatCompletion({
        messages,
        stream: false,
        parameters: options.parameters || {},
      });

      // Extract content from response
      const rawResponse = this._extractResponseContent(response);

      // Update session
      this._updateSession(session, question, rawResponse, questionHash);

      // Notify completion
      if (this.isOllama()) {
        this.appController.windowManager.send('ai-processing-complete');
      }

      this.appController.windowManager.send('session-length', session.history.length);

      return rawResponse;
    } catch (error) {
      // Ensure processing indicator is cleared
      if (this.isOllama()) {
        this.appController.windowManager.send('ai-processing-complete');
      }
      throw error;
    }
  }

  /**
   * Stream a response with real-time updates
   * @param {string} question - The question to ask
   * @param {Function} onChunk - Callback for each chunk of response
   * @param {Object} options - Additional options
   * @returns {Promise<string>} Complete response
   */
  async askStream(question, onChunk, options = {}) {
    if (!this.activeProvider.streamChatCompletion) {
      // Fallback to regular ask if streaming not supported
      const response = await this.ask(question, options);
      if (onChunk) onChunk(response);
      return response;
    }

    const session = this.getSession();
    const messages = [
      { role: 'system', content: this.getSystemPrompt() },
      ...session.history,
      { role: 'user', content: question },
    ];

    const response = await this.activeProvider.streamChatCompletion(
      { messages, parameters: options.parameters || {} },
      onChunk
    );

    const rawResponse = this._extractResponseContent(response);
    const questionHash = crypto.createHash('md5').update(question).digest('hex');
    this._updateSession(session, question, rawResponse, questionHash);

    return rawResponse;
  }

  /**
   * Test if the current provider is responsive
   * @returns {Promise<boolean>} True if provider responds
   */
  async warmup() {
    if (!this.activeProvider) {
      return false;
    }

    try {
      return await this.activeProvider.warmup();
    } catch (error) {
      console.warn(`[AIManager] Warmup failed:`, error.message);
      return false;
    }
  }

  /**
   * Get the current session for the active model
   * @returns {Object} Session object
   */
  getSession() {
    const sessionKey = `${this.currentProviderName}-${this.currentModelName}`;

    if (!this.sessions.has(sessionKey)) {
      this.sessions.set(sessionKey, {
        history: [],
        active: false,
        cache: new Map(),
        provider: this.currentProviderName,
        model: this.currentModelName,
      });
    }

    return this.sessions.get(sessionKey);
  }

  /**
   * Clear the current session
   */
  clearSession() {
    const session = this.getSession();
    session.history = [];
    session.cache.clear();
    session.active = false;
  }

  /**
   * Clear all sessions and cache
   */
  clearAllSessions() {
    this.sessions.clear();
    this.globalCache.clear();
  }

  /**
   * Get system prompt for the current model
   * @returns {string} System prompt
   */
  getSystemPrompt() {
    const modelType = this._getModelType(this.currentModelName);
    return MODEL_PROMPTS[modelType] || MODEL_PROMPTS.default;
  }

  /**
   * Get current provider information
   * @returns {Object} Provider info
   */
  getProviderInfo() {
    return {
      name: this.currentProviderName,
      model: this.currentModelName,
      isOllama: this.isOllama(),
      isInitialized: this.isInitialized,
      config: this.activeProvider ? this.activeProvider.getConfig() : {},
    };
  }

  /**
   * Get session statistics
   * @returns {Object} Session stats
   */
  getSessionStats() {
    const session = this.getSession();
    return {
      historyLength: session.history.length,
      cacheSize: session.cache.size,
      isActive: session.active,
      provider: session.provider,
      model: session.model,
    };
  }

  /**
   * Check if current provider is Ollama
   * @returns {boolean} True if using Ollama
   */
  isOllama() {
    return this.currentProviderName === 'ollama';
  }

  /**
   * Set model for current provider
   * @param {string} modelName - Model name to use
   */
  setModel(modelName) {
    if (this.activeProvider) {
      this.activeProvider.setModel(modelName);
      this.currentModelName = modelName;
    }
  }

  /**
   * Get Ollama models configuration
   * @returns {Object} Ollama models config with simple array and all() method
   */
  getOllamaModels() {
    const ollamaConfig = getProviderConfig('ollama');
    const models = ollamaConfig.models || {};

    return {
      simple: models.simple,
      primary: models.primary,
      all() {
        return [...this.simple];
      },
    };
  }

  /**
   * Get or create a provider instance
   * @param {string} providerName - Provider name
   * @param {Object} config - Configuration
   * @returns {BaseAIProvider} Provider instance
   * @private
   */
  _getOrCreateProvider(providerName, config = {}) {
    const cacheKey = `${providerName}-${JSON.stringify(config)}`;

    if (this.providerInstances.has(cacheKey)) {
      return this.providerInstances.get(cacheKey);
    }

    const provider = createProvider(providerName, config);
    this.providerInstances.set(cacheKey, provider);
    return provider;
  }

  /**
   * Get default model for a provider
   * @param {string} providerName - Provider name
   * @returns {string} Default model name
   * @private
   */
  _getDefaultModelForProvider(providerName) {
    const defaults = {
      ollama: process.env.OLLAMA_MODEL || 'gpt-oss',
      openai: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      huggingface: process.env.HF_MODEL || 'deepseek-ai/DeepSeek-R1-0528',
      deepseek: process.env.DEEPSEEK_MODEL || 'deepseek-reasoning',
    };
    return defaults[providerName] || 'default';
  }

  /**
   * Determine model type for prompt selection
   * @param {string} modelName - Model name
   * @returns {string} Model type
   * @private
   */
  _getModelType(modelName = '') {
    const name = modelName.toLowerCase();
    if (name.includes('phi')) return 'phi';
    if (name.includes('mistral')) return 'mistral';
    if (name.includes('qwen')) return 'qwen';
    if (name.includes('codellama')) return 'codellama';
    if (name.includes('gpt')) return 'gpt';
    if (name.includes('deepseek-coder')) return 'deepseek_coder';
    if (name.includes('deepseek')) return 'deepseek';
    return 'default';
  }

  /**
   * Extract content from provider response
   * @param {Object} response - Provider response
   * @returns {string} Extracted content
   * @private
   */
  _extractResponseContent(response) {
    if (typeof response === 'string') {
      return response;
    }

    const choice = response.choices?.[0]?.message;
    if (!choice) {
      return JSON.stringify(response);
    }

    return typeof choice === 'string' ? choice : choice.content || JSON.stringify(choice);
  }

  /**
   * Update session with new interaction
   * @param {Object} session - Session object
   * @param {string} question - User question
   * @param {string} response - AI response
   * @param {string} questionHash - Hash of the question
   * @private
   */
  _updateSession(session, question, response, questionHash) {
    // Check if the user message already exists at the end of history
    const lastMessage = session.history[session.history.length - 1];
    const shouldAddUserMessage =
      !lastMessage || lastMessage.role !== 'user' || lastMessage.content !== question;

    // Add to history - avoid duplicating user messages
    if (shouldAddUserMessage) {
      session.history.push({ role: 'user', content: question });
    }
    session.history.push({ role: 'assistant', content: response });

    // Cache the response
    session.cache.set(questionHash, response);
    session.active = true;

    // Trim history if too long (keep last 20 messages)
    if (session.history.length > 20) {
      session.history = session.history.slice(-20);
    }
  }
}

module.exports = AIManager;
