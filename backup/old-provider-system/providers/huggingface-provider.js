const BaseAIProvider = require('./base-provider');
const aiConfig = require('../ai-config');

/**
 * HuggingFace AI Provider
 *
 * Provides integration with HuggingFace models via their Inference API
 * Supports both HuggingFace Hub and third-party providers like Hyperbolic
 */
class HuggingFaceProvider extends BaseAIProvider {
  constructor(overrides = {}) {
    const config = aiConfig.getProviderConfig('huggingface', overrides);
    super(config);

    this.apiToken = config.apiToken;
    this.provider = config.provider;
    this.baseUrl = config.baseUrl;

    // Lazy load the HuggingFace client
    this._client = null;

    if (!this.apiToken) {
      console.warn('[HuggingFace] No API token provided. Some models may not be accessible.');
    }
  }

  /**
   * Get or create the HuggingFace client
   * @returns {Object} HuggingFace InferenceClient
   */
  _getClient() {
    if (!this._client) {
      try {
        const { InferenceClient } = require('@huggingface/inference');
        this._client = new InferenceClient(this.apiToken);
      } catch (error) {
        throw new Error('HuggingFace Inference package not found. Please install: npm install @huggingface/inference');
      }
    }
    return this._client;
  }

  /**
   * Perform chat completion using HuggingFace Inference API
   * @param {Object} options - Chat completion options
   * @returns {Promise<Object>} Standardized response
   */
  async chatCompletion(options) {
    this._validateChatOptions(options);

    const { messages, stream = false, parameters = {} } = options;
    const mergedParams = this._mergeParameters(parameters);
    const client = this._getClient();

    try {
      const chatCompletion = await client.chatCompletion({
        provider: this.provider,
        model: this.model,
        messages: messages,
        stream: stream,
        temperature: mergedParams.temperature,
        top_p: mergedParams.top_p,
        max_tokens: mergedParams.max_tokens,
        ...mergedParams
      });

      // HuggingFace response should already be in standard format
      return {
        ...chatCompletion,
        provider: this.name,
        model: this.model
      };
    } catch (error) {
      this._handleHuggingFaceError(error);
    }
  }

  /**
   * Check if HuggingFace API is accessible
   * @returns {Promise<Object>} Connection status
   */
  async checkConnection() {
    try {
      const client = this._getClient();

      // Try a simple completion to test connectivity
      await client.chatCompletion({
        provider: this.provider,
        model: this.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1
      });

      return {
        connected: true,
        modelAvailable: true,
        provider: this.name,
        hfProvider: this.provider
      };
    } catch (error) {
      return {
        connected: false,
        modelAvailable: false,
        error: error.message,
        provider: this.name,
        hfProvider: this.provider
      };
    }
  }

  /**
   * Stream chat completion with callback for each chunk
   * @param {Object} options - Chat completion options
   * @param {Function} onChunk - Callback for each stream chunk
   * @returns {Promise<Object>} Final response
   */
  async streamChatCompletion(options, onChunk) {
    this._validateChatOptions(options);

    const { messages, parameters = {} } = options;
    const mergedParams = this._mergeParameters(parameters);
    const client = this._getClient();

    try {
      let fullContent = '';

      const stream = await client.chatCompletion({
        provider: this.provider,
        model: this.model,
        messages: messages,
        stream: true,
        temperature: mergedParams.temperature,
        top_p: mergedParams.top_p,
        max_tokens: mergedParams.max_tokens,
        ...mergedParams
      });

      for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          if (onChunk) {
            onChunk(content);
          }
        }
      }

      return {
        choices: [{
          message: {
            role: 'assistant',
            content: fullContent
          }
        }],
        provider: this.name,
        model: this.model
      };
    } catch (error) {
      this._handleHuggingFaceError(error);
    }
  }

  /**
   * Get list of available models (limited without proper API access)
   * @returns {Promise<Array>} List of popular models
   */
  async getAvailableModels() {
    // HuggingFace doesn't provide a simple way to list all chat models
    // Return a curated list of popular models
    return [
      'deepseek-ai/DeepSeek-R1-0528',
      'microsoft/DialoGPT-medium',
      'microsoft/DialoGPT-large',
      'facebook/blenderbot-400M-distill',
      'facebook/blenderbot-1B-distill',
      'facebook/blenderbot-3B',
      'Qwen/Qwen2.5-7B-Instruct',
      'Qwen/Qwen2.5-14B-Instruct',
      'meta-llama/Llama-2-7b-chat-hf',
      'meta-llama/Llama-2-13b-chat-hf',
      'mistralai/Mistral-7B-Instruct-v0.3',
      'mistralai/Mixtral-8x7B-Instruct-v0.1'
    ];
  }

  /**
   * Test a specific model for availability
   * @param {string} modelName - Model to test
   * @returns {Promise<boolean>} True if model is available
   */
  async testModel(modelName) {
    try {
      const client = this._getClient();
      await client.chatCompletion({
        provider: this.provider,
        model: modelName,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      });
      return true;
    } catch (error) {
      console.warn(`[${this.name}] Model ${modelName} not available:`, error.message);
      return false;
    }
  }

  /**
   * Handle HuggingFace-specific errors
   * @param {Error} error - Original error
   * @throws {Error} Formatted error
   */
  _handleHuggingFaceError(error) {
    const message = error.message || '';

    if (message.includes('401') || message.includes('unauthorized')) {
      throw new Error('Invalid HuggingFace API token. Please check your HF_TOKEN.');
    }

    if (message.includes('429') || message.includes('rate limit')) {
      throw new Error('HuggingFace API rate limit exceeded. Please try again later.');
    }

    if (message.includes('400') || message.includes('bad request')) {
      throw new Error(`HuggingFace API bad request: ${message}`);
    }

    if (message.includes('404') || message.includes('not found')) {
      throw new Error(`HuggingFace model '${this.model}' not found or not accessible.`);
    }

    if (message.includes('500') || message.includes('server error')) {
      throw new Error('HuggingFace API server error. Please try again later.');
    }

    if (message.includes('timeout')) {
      throw new Error('HuggingFace API request timeout. Please try again.');
    }

    if (message.includes('ECONNREFUSED') || message.includes('ENOTFOUND')) {
      throw new Error('Unable to connect to HuggingFace API. Please check your internet connection.');
    }

    throw new Error(`HuggingFace request failed: ${message}`);
  }

  /**
   * Get default HuggingFace parameters
   * @returns {Object} Default parameters
   */
  getDefaultParameters() {
    return {
      temperature: 0.3,
      top_p: 0.9,
      max_tokens: 2048,
      stream: false,
      do_sample: true,
      repetition_penalty: 1.1
    };
  }

  /**
   * Set the API token
   * @param {string} token - New API token
   */
  setApiToken(token) {
    this.apiToken = token;
    this.config.apiToken = token;
    this._client = null; // Reset client to use new token
  }

  /**
   * Get the current API token (masked for security)
   * @returns {string} Masked API token
   */
  getApiToken() {
    if (!this.apiToken) return null;
    return this.apiToken.substring(0, 8) + '...' + this.apiToken.substring(this.apiToken.length - 4);
  }

  /**
   * Set the HuggingFace provider (e.g., 'hyperbolic', 'huggingface')
   * @param {string} provider - Provider name
   */
  setProvider(provider) {
    this.provider = provider;
    this.config.provider = provider;
  }

  /**
   * Get the current HuggingFace provider
   * @returns {string} Provider name
   */
  getProvider() {
    return this.provider;
  }

  /**
   * Set the base URL for custom endpoints
   * @param {string} baseUrl - New base URL
   */
  setBaseUrl(baseUrl) {
    this.baseUrl = baseUrl;
    this.config.baseUrl = baseUrl;
  }

  /**
   * Get the current base URL
   * @returns {string} Base URL
   */
  getBaseUrl() {
    return this.baseUrl;
  }

  /**
   * Get model information if available
   * @returns {Promise<Object>} Model information
   */
  async getModelInfo() {
    try {
      const client = this._getClient();
      // This is a placeholder - HuggingFace doesn't have a standard model info endpoint
      // for inference API. In practice, you'd need to use the Hub API separately.
      return {
        model: this.model,
        provider: this.provider,
        available: await this.testModel(this.model)
      };
    } catch (error) {
      return {
        model: this.model,
        provider: this.provider,
        available: false,
        error: error.message
      };
    }
  }
}

module.exports = HuggingFaceProvider;
