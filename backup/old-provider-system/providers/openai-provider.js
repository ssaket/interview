const axios = require('axios');
const BaseAIProvider = require('./base-provider');
const aiConfig = require('../ai-config');

/**
 * OpenAI AI Provider
 *
 * Provides integration with OpenAI's GPT models via their API
 */
class OpenAIProvider extends BaseAIProvider {
  constructor(overrides = {}) {
    const config = aiConfig.getProviderConfig('openai', overrides);
    super(config);

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;

    if (!this.apiKey) {
      throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass it in config.');
    }
  }

  /**
   * Perform chat completion using OpenAI API
   * @param {Object} options - Chat completion options
   * @returns {Promise<Object>} Standardized response
   */
  async chatCompletion(options) {
    this._validateChatOptions(options);

    const { messages, stream = false, parameters = {} } = options;
    const mergedParams = this._mergeParameters(parameters);

    try {
      const requestBody = {
        model: this.model,
        messages: messages,
        temperature: mergedParams.temperature,
        top_p: mergedParams.top_p,
        max_tokens: mergedParams.max_tokens,
        stream: stream,
        ...mergedParams
      };

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        requestBody,
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );

      // OpenAI response is already in the standard format
      return {
        ...response.data,
        provider: this.name,
        model: this.model
      };
    } catch (error) {
      this._handleOpenAIError(error);
    }
  }

  /**
   * Check if OpenAI API is accessible with current credentials
   * @returns {Promise<Object>} Connection status
   */
  async checkConnection() {
    try {
      const response = await axios.get(`${this.baseUrl}/models`, {
        timeout: 10000,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      const models = response.data.data || [];
      const hasModel = models.some((model) => model.id === this.model);

      return {
        connected: true,
        modelAvailable: hasModel,
        availableModels: models.map((m) => m.id),
        provider: this.name
      };
    } catch (error) {
      return {
        connected: false,
        modelAvailable: false,
        error: error.message,
        provider: this.name
      };
    }
  }

  /**
   * Get list of available models from OpenAI
   * @returns {Promise<Array>} List of available models
   */
  async getAvailableModels() {
    try {
      const response = await axios.get(`${this.baseUrl}/models`, {
        timeout: 10000,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      return response.data.data?.map(m => m.id) || [];
    } catch (error) {
      console.error(`[${this.name}] Failed to get available models:`, error.message);
      return [];
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

    try {
      const requestBody = {
        model: this.model,
        messages: messages,
        temperature: mergedParams.temperature,
        top_p: mergedParams.top_p,
        max_tokens: mergedParams.max_tokens,
        stream: true,
        ...mergedParams
      };

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        requestBody,
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          responseType: 'stream'
        }
      );

      let fullContent = '';

      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
          const lines = chunk.toString().split('\n').filter(line => line.trim());

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                resolve({
                  choices: [{
                    message: {
                      role: 'assistant',
                      content: fullContent
                    }
                  }],
                  provider: this.name,
                  model: this.model
                });
                return;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || '';
                if (content) {
                  fullContent += content;
                  if (onChunk) {
                    onChunk(content);
                  }
                }
              } catch (e) {
                // Ignore parsing errors for streaming data
              }
            }
          }
        });

        response.data.on('error', reject);
      });
    } catch (error) {
      this._handleOpenAIError(error);
    }
  }

  /**
   * Get token count for messages (approximate)
   * @param {Array} messages - Messages to count tokens for
   * @returns {number} Approximate token count
   */
  estimateTokenCount(messages) {
    // Simple approximation: ~4 characters per token
    const totalText = messages.map(m => m.content).join(' ');
    return Math.ceil(totalText.length / 4);
  }

  /**
   * Check if model supports function calling
   * @returns {boolean} True if model supports functions
   */
  supportsFunctionCalling() {
    const functionModels = [
      'gpt-4',
      'gpt-4-turbo',
      'gpt-4-turbo-preview',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-1106'
    ];
    return functionModels.some(model => this.model.includes(model));
  }

  /**
   * Handle OpenAI-specific errors
   * @param {Error} error - Original error
   * @throws {Error} Formatted error
   */
  _handleOpenAIError(error) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      switch (status) {
        case 401:
          throw new Error('Invalid OpenAI API key. Please check your OPENAI_API_KEY.');
        case 429:
          throw new Error('OpenAI API rate limit exceeded. Please try again later.');
        case 400:
          throw new Error(`OpenAI API bad request: ${data.error?.message || 'Invalid request'}`);
        case 404:
          throw new Error(`OpenAI model '${this.model}' not found or not accessible.`);
        case 500:
          throw new Error('OpenAI API server error. Please try again later.');
        default:
          throw new Error(`OpenAI API error (${status}): ${data.error?.message || error.message}`);
      }
    }

    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      throw new Error('OpenAI API request timeout. Please try again.');
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      throw new Error('Unable to connect to OpenAI API. Please check your internet connection.');
    }

    throw new Error(`OpenAI request failed: ${error.message}`);
  }

  /**
   * Get default OpenAI parameters
   * @returns {Object} Default parameters
   */
  getDefaultParameters() {
    return {
      temperature: 0.3,
      top_p: 1.0,
      max_tokens: 2048,
      frequency_penalty: 0,
      presence_penalty: 0,
      stream: false
    };
  }

  /**
   * Set the API key
   * @param {string} apiKey - New API key
   */
  setApiKey(apiKey) {
    this.apiKey = apiKey;
    this.config.apiKey = apiKey;
  }

  /**
   * Get the current API key (masked for security)
   * @returns {string} Masked API key
   */
  getApiKey() {
    if (!this.apiKey) return null;
    return this.apiKey.substring(0, 8) + '...' + this.apiKey.substring(this.apiKey.length - 4);
  }

  /**
   * Set the base URL for custom OpenAI-compatible endpoints
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
   * Get model-specific context window size
   * @returns {number} Context window size in tokens
   */
  getContextWindow() {
    const contextWindows = {
      'gpt-4': 8192,
      'gpt-4-32k': 32768,
      'gpt-4-turbo': 128000,
      'gpt-4-turbo-preview': 128000,
      'gpt-3.5-turbo': 4096,
      'gpt-3.5-turbo-16k': 16384,
      'gpt-3.5-turbo-1106': 16384
    };

    for (const [model, size] of Object.entries(contextWindows)) {
      if (this.model.includes(model)) {
        return size;
      }
    }

    return 4096; // Default fallback
  }
}

module.exports = OpenAIProvider;
