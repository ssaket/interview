const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
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
    this.globalCache = new Map(); // Shared cache across sessions

    // State
    this.isInitialized = true;
    this.systemPromptsEnabled = true; // Toggle for system prompts

    console.log(`[SimpleAIManager] Initialized with ${this.currentProvider} using model: ${this.currentModel}`);
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

      console.log(`[SimpleAIManager] ${silent ? 'Silently switched' : 'Switched'} to ${providerName} using model: ${this.currentModel}`);
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
        console.log(`[SimpleAIManager] System prompt for ${this.currentProvider}:${this.currentModel}:`);
        console.log('--- SYSTEM PROMPT START ---');
        console.log(systemPrompt);
        console.log('--- SYSTEM PROMPT END ---');
        session.messages.push({
          role: 'system',
          content: systemPrompt,
        });
      } else {
        console.log(`[SimpleAIManager] No system prompt found for ${this.currentProvider}:${this.currentModel}`);
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
    console.log(`[SimpleAIManager] Sending ${session.messages.length} messages to ${this.currentProvider}:${this.currentModel}`);
    session.messages.forEach((msg, index) => {
      if (msg.role === 'system') {
        console.log(`Message ${index}: [SYSTEM] (${msg.content.length} chars)`);
      } else {
        console.log(`Message ${index}: [${msg.role.toUpperCase()}] ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
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

      // Store response to temporary file
      this._storeResponseToFile(query, content, {
        sessionKey,
        requestCount: session.requestCount,
        messageCount: session.messages.length
      });

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
    // Handle hybrid flow with sequential streaming
    if (options.flow === 'hybrid') {
      return await this.askHybrid(question, options);
    }

    // Handle hybrid flow model selection (legacy)
    if (options.flow === 'hybrid' && this.currentProvider === 'ollama') {
      const aiConfig = require('./ai-config');
      const hybridModel = aiConfig.getHybridModel('ollama');
      const originalModel = this.currentModel;

      console.log(`[SimpleAIManager] Using hybrid model: ${hybridModel} (was: ${originalModel})`);

      // Temporarily switch to hybrid model
      this.setModel(hybridModel);

      try {
        const response = await this.query(question, options);
        return response.content;
      } finally {
        // Restore original model
        this.setModel(originalModel);
      }
    }

    const response = await this.query(question, options);
    return response.content;
  }

  /**
   * Hybrid AI flow: stream local response first, then stream DeepSeek analysis
   * @param {string} question - The question to ask
   * @param {Object} options - Additional options including onChunk callback
   * @returns {Promise<string>} Combined response content
   */
  async askHybrid(question, options = {}) {
    console.log('[SimpleAIManager] Starting hybrid flow with streaming...');

    let combinedResponse = '';
    const onChunk = options.onChunk;

    // Store original state outside try block
    const originalProvider = this.currentProvider;
    const originalModel = this.currentModel;

    try {
      // Phase 1: Stream local Ollama response
      console.log('[SimpleAIManager] Phase 1: Streaming local response...');

      if (onChunk) {
        onChunk('🚀 **Local AI Response:**\n\n');
      }

      const aiConfig = require('./ai-config');
      const hybridModel = aiConfig.getHybridModel('ollama');

      // Switch to local provider with hybrid model (silently)
      if (originalProvider !== 'ollama') {
        await this.switchProvider('ollama', true);
      }
      this.setModel(hybridModel);

      const localResponse = await this.query(`Brief analysis: ${question}`, {
        stream: true,
        onChunk: onChunk,
        parameters: options.parameters || {}
      });

      combinedResponse += localResponse.content;

      // Add separator
      const separator = '\n\n---\n\n**🧠 DeepSeek Analysis:**\n\n';
      combinedResponse += separator;
      if (onChunk) {
        onChunk(separator);
      }

      // Phase 2: Stream DeepSeek response
      console.log('[SimpleAIManager] Phase 2: Streaming DeepSeek response...');

      // Switch to DeepSeek (silently)
      await this.switchProvider('deepseek', true);

      const deepseekResponse = await this.query(question, {
        stream: true,
        onChunk: onChunk,
        parameters: options.parameters || {}
      });

      combinedResponse += deepseekResponse.content;

      // Restore original provider and model (silently)
      if (originalProvider !== 'deepseek') {
        await this.switchProvider(originalProvider, true);
        this.setModel(originalModel);
      }

      console.log('[SimpleAIManager] Hybrid flow completed successfully');
      return combinedResponse;

    } catch (error) {
      console.error('[SimpleAIManager] Hybrid flow failed:', error.message);

      // Add error message to response
      const errorMsg = `\n\n**❌ DeepSeek Error:** ${error.message}`;
      combinedResponse += errorMsg;
      if (onChunk) {
        onChunk(errorMsg);
      }

      // Try to restore original provider (silently)
      try {
        if (originalProvider && this.currentProvider !== originalProvider) {
          await this.switchProvider(originalProvider, true);
          this.setModel(originalModel);
        }
      } catch (restoreError) {
        console.error('[SimpleAIManager] Failed to restore provider:', restoreError.message);
      }

      return combinedResponse;
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
        cache: new Map(),
        active: false,
      };
    }

    // Convert messages to history format for compatibility
    const history = session.messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

    return {
      history,
      cache: new Map(), // Simple cache for compatibility
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
    console.log(`[SimpleAIManager] System prompts ${this.systemPromptsEnabled ? 'enabled' : 'disabled'}`);
    return this.systemPromptsEnabled;
  }

  /**
   * Get system prompts enabled state
   * @returns {boolean} Whether system prompts are enabled
   */
  getSystemPromptsEnabled() {
    return this.systemPromptsEnabled;
  }

  /**
   * Store agent response to temporary file
   * @param {string} query - Original user query
   * @param {string} response - AI response content
   * @param {Object} metadata - Additional metadata
   */
  _storeResponseToFile(query, response, metadata = {}) {
    try {
      const timestamp = new Date().toISOString();
      const responseData = {
        timestamp,
        provider: this.currentProvider,
        model: this.currentModel,
        systemPromptsEnabled: this.systemPromptsEnabled,
        query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
        response,
        metadata
      };

      const fileName = `agent-responses-${new Date().toISOString().split('T')[0]}.jsonl`;
      const filePath = path.join(process.cwd(), fileName);

      // Append as JSONL (JSON Lines) format
      const line = JSON.stringify(responseData) + '\n';
      fs.appendFileSync(filePath, line);

      console.log(`[SimpleAIManager] Response stored to ${fileName}`);
    } catch (error) {
      console.error('[SimpleAIManager] Failed to store response:', error.message);
    }
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

    const prompt = MODEL_PROMPTS[modelType];

    if (prompt && typeof prompt === 'string') {
      return prompt;
    }

    // Fallback to default prompt
    return MODEL_PROMPTS.default || null;
  }

  _getModelType(modelName = '') {
    const name = modelName.toLowerCase();
    if (name.includes('phi')) return 'phi';
    if (name.includes('mistral') || name.includes('magistral')) return 'mistral';
    if (name.includes('qwen')) return 'qwen';
    if (name.includes('codellama')) return 'codellama';
    if (name.includes('gpt')) return 'gpt';
    if (name.includes('deepseek-coder')) return 'deepseek_coder';
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