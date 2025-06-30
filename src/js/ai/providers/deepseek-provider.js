const axios = require('axios');
const BaseAIProvider = require('./base-provider');

/**
 * DeepSeek AI Provider
 *
 * Provides integration with DeepSeek's AI models via their OpenAI-compatible API
 * Supports both DeepSeek-Chat (V3) and DeepSeek-Reasoner (R1) models
 */
class DeepSeekProvider extends BaseAIProvider {
  constructor(config = {}) {
    super({
      name: 'deepseek',
      model: config.model || 'deepseek-chat',
      apiKey: config.apiKey || process.env.DEEPSEEK_API_KEY,
      baseUrl: config.baseUrl || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      timeout: config.timeout || 120000, // 2 minute timeout
      ...config
    });

    this.apiKey = this.config.apiKey;
    this.baseUrl = this.config.baseUrl;

    if (!this.apiKey) {
      throw new Error('DeepSeek API key is required. Set DEEPSEEK_API_KEY environment variable or pass it in config.');
    }

    // Ensure base URL has /v1 for OpenAI compatibility
    if (!this.baseUrl.endsWith('/v1') && !this.baseUrl.includes('/chat/completions')) {
      this.baseUrl = this.baseUrl.replace(/\/$/, '') + '/v1';
    }
  }

  /**
   * Perform chat completion using DeepSeek API
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

      // DeepSeek response is in OpenAI format
      return {
        ...response.data,
        provider: this.name,
        model: this.model
      };
    } catch (error) {
      this._handleDeepSeekError(error);
    }
  }

  /**
   * Check if DeepSeek API is accessible with current credentials
   * @returns {Promise<Object>} Connection status
   */
  async checkConnection() {
    try {
      // Try a simple completion to test connectivity
      const response = await this.chatCompletion({
        messages: [{ role: 'user', content: 'ping' }],
        parameters: { max_tokens: 1 }
      });

      return {
        connected: true,
        modelAvailable: true,
        model: this.model,
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
   * Get list of available DeepSeek models
   * @returns {Promise<Array>} List of available models
   */
  async getAvailableModels() {
    // DeepSeek currently has two main models
    return [
      'deepseek-chat',     // DeepSeek-V3-0324 - General chat model
      'deepseek-reasoner'  // DeepSeek-R1-0528 - Reasoning model
    ];
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
      this._handleDeepSeekError(error);
    }
  }

  /**
   * Get model information and capabilities
   * @returns {Object} Model information
   */
  getModelInfo() {
    const modelInfo = {
      'deepseek-chat': {
        name: 'DeepSeek-V3-0324',
        type: 'chat',
        description: 'General-purpose chat model with strong reasoning capabilities',
        contextWindow: 64000,
        maxTokens: 4096,
        capabilities: ['chat', 'reasoning', 'coding', 'math']
      },
      'deepseek-reasoner': {
        name: 'DeepSeek-R1-0528',
        type: 'reasoning',
        description: 'Specialized reasoning model with enhanced logical thinking',
        contextWindow: 64000,
        maxTokens: 4096,
        capabilities: ['reasoning', 'analysis', 'problem-solving', 'math']
      }
    };

    return modelInfo[this.model] || {
      name: this.model,
      type: 'unknown',
      description: 'DeepSeek model',
      contextWindow: 64000,
      maxTokens: 4096,
      capabilities: ['chat']
    };
  }

  /**
   * Check if current model supports specific capabilities
   * @param {string} capability - Capability to check
   * @returns {boolean} True if capability is supported
   */
  supportsCapability(capability) {
    const info = this.getModelInfo();
    return info.capabilities.includes(capability);
  }

  /**
   * Get estimated token count for messages (approximate)
   * @param {Array} messages - Messages to count tokens for
   * @returns {number} Approximate token count
   */
  estimateTokenCount(messages) {
    // Simple approximation: ~4 characters per token
    const totalText = messages.map(m => m.content).join(' ');
    return Math.ceil(totalText.length / 4);
  }

  /**
   * Handle DeepSeek-specific errors
   * @param {Error} error - Original error
   * @throws {Error} Formatted error
   */
  _handleDeepSeekError(error) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      switch (status) {
        case 401:
          throw new Error('Invalid DeepSeek API key. Please check your DEEPSEEK_API_KEY.');
        case 429:
          throw new Error('DeepSeek API rate limit exceeded. Please try again later.');
        case 400:
          throw new Error(`DeepSeek API bad request: ${data.error?.message || 'Invalid request'}`);
        case 404:
          throw new Error(`DeepSeek model '${this.model}' not found or not accessible.`);
        case 500:
          throw new Error('DeepSeek API server error. Please try again later.');
        case 503:
          throw new Error('DeepSeek API service unavailable. Please try again later.');
        default:
          throw new Error(`DeepSeek API error (${status}): ${data.error?.message || error.message}`);
      }
    }

    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      throw new Error('DeepSeek API request timeout. Please try again.');
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      throw new Error('Unable to connect to DeepSeek API. Please check your internet connection.');
    }

    throw new Error(`DeepSeek request failed: ${error.message}`);
  }

  /**
   * Get default DeepSeek parameters
   * @returns {Object} Default parameters
   */
  getDefaultParameters() {
    return {
      temperature: 0.7,
      top_p: 1.0,
      max_tokens: 2048,
      frequency_penalty: 0,
      presence_penalty: 0,
      stream: false
    };
  }

  /**
   * Get model-specific parameters for better performance
   * @returns {Object} Model-specific parameters
   */
  getModelSpecificParameters() {
    const params = {
      'deepseek-chat': {
        temperature: 0.7,
        top_p: 0.95,
        max_tokens: 2048
      },
      'deepseek-reasoner': {
        temperature: 0.3, // Lower temperature for more focused reasoning
        top_p: 0.9,
        max_tokens: 4096  // Higher token limit for detailed reasoning
      }
    };

    return params[this.model] || this.getDefaultParameters();
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
   * Get model-specific context window size
   * @returns {number} Context window size in tokens
   */
  getContextWindow() {
    const info = this.getModelInfo();
    return info.contextWindow || 64000;
  }

  /**
   * Switch to reasoning model if available
   */
  useReasoningModel() {
    this.setModel('deepseek-reasoner');
  }

  /**
   * Switch to chat model
   */
  useChatModel() {
    this.setModel('deepseek-chat');
  }

  /**
   * Check if current model is the reasoning model
   * @returns {boolean} True if using reasoning model
   */
  isReasoningModel() {
    return this.model === 'deepseek-reasoner';
  }

  /**
   * Get pricing information (approximate)
   * @returns {Object} Pricing information
   */
  getPricingInfo() {
    return {
      'deepseek-chat': {
        input: 0.14,   // per 1M tokens (approximate)
        output: 0.28   // per 1M tokens (approximate)
      },
      'deepseek-reasoner': {
        input: 0.55,   // per 1M tokens (approximate)
        output: 2.19   // per 1M tokens (approximate)
      }
    }[this.model] || { input: 0.14, output: 0.28 };
  }
}

module.exports = DeepSeekProvider;
