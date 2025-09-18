const axios = require('axios');
const BaseAIProvider = require('./base-provider');
const aiConfig = require('../ai-config');

/**
 * Ollama AI Provider
 *
 * Provides integration with Ollama local AI models
 */
class OllamaProvider extends BaseAIProvider {
  constructor(overrides = {}) {
    const config = aiConfig.getProviderConfig('ollama', overrides);
    super(config);
    this.baseUrl = config.baseUrl;
  }

  /**
   * Perform chat completion using Ollama API
   * @param {Object} options - Chat completion options
   * @returns {Promise<Object>} Standardized response
   */
  async chatCompletion(options) {
    this._validateChatOptions(options);

    const { messages, stream = false, parameters = {} } = options;
    const mergedParams = this._mergeParameters(parameters);

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/chat`,
        {
          model: this.model,
          messages: messages,
          stream: stream,
          options: {
            temperature: mergedParams.temperature,
            top_p: mergedParams.top_p,
            // repeat_penalty: mergedParams.repeat_penalty,
          },
        },
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      // Transform Ollama response to standardized format
      return {
        choices: [
          {
            message: {
              role: 'assistant',
              content: response.data.message.content,
            },
          },
        ],
        provider: this.name,
        model: this.model
      };
    } catch (error) {
      this._handleOllamaError(error);
    }
  }

  /**
   * Check if Ollama server is running and model is available
   * @returns {Promise<Object>} Connection status
   */
  async checkConnection() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000,
      });

      const models = response.data.models || [];
      const hasModel = models.some((model) => model.name.includes(this.model));

      return {
        connected: true,
        modelAvailable: hasModel,
        availableModels: models.map((m) => m.name),
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
   * Pull a model from Ollama registry
   * @param {string} modelName - Model to pull (defaults to current model)
   * @returns {Promise<Object>} Pull result
   */
  async pullModel(modelName = this.model) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/pull`,
        {
          name: modelName,
        },
        {
          timeout: 600000, // 10 minute timeout for model pulling
        }
      );

      return {
        success: true,
        data: response.data,
        model: modelName,
        provider: this.name
      };
    } catch (error) {
      console.error(`[${this.name}] Error pulling model:`, error.message);
      throw new Error(`Failed to pull model ${modelName}: ${error.message}`);
    }
  }

  /**
   * Warm up the model with a simple request
   * @returns {Promise<Object>} Warmup result
   */
  async warmupModel() {
    try {
      const startTime = Date.now();
      await this.chatCompletion({
        messages: [
          {
            role: 'user',
            content: "Just say 'Ready' in one word.",
          },
        ],
        stream: false,
      });
      const duration = Date.now() - startTime;
      return {
        success: true,
        duration,
        model: this.model,
        provider: this.name
      };
    } catch (error) {
      console.error(`[${this.name}] Model warmup failed:`, error.message);
      return {
        success: false,
        error: error.message,
        model: this.model,
        provider: this.name
      };
    }
  }

  /**
   * Chat completion with progress callback
   * @param {Object} options - Chat options
   * @param {Function} progressCallback - Progress callback function
   * @returns {Promise<Object>} Response
   */
  async chatCompletionWithProgress(options, progressCallback) {
    this._validateChatOptions(options);

    const { messages, stream = false, parameters = {} } = options;
    const mergedParams = this._mergeParameters(parameters);

    if (progressCallback) {
      progressCallback('Starting inference...');
    }

    const startTime = Date.now();

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/chat`,
        {
          model: this.model,
          messages: messages,
          stream: stream,
          options: {
            temperature: mergedParams.temperature,
            top_p: mergedParams.top_p,
          },
        },
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
          },
          onUploadProgress: () => {
            if (progressCallback) {
              progressCallback('Request sent, waiting for response...');
            }
          },
        }
      );

      const duration = Date.now() - startTime;
      if (progressCallback) {
        progressCallback(`Response received in ${Math.round(duration / 1000)}s`);
      }

      return {
        choices: [
          {
            message: {
              role: 'assistant',
              content: response.data.message.content,
            },
          },
        ],
        provider: this.name,
        model: this.model,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[${this.name}] ${this.model} failed after ${duration}ms:`, error.message);

      if (progressCallback) {
        progressCallback(`Failed after ${Math.round(duration / 1000)}s`);
      }

      this._handleOllamaError(error);
    }
  }

  /**
   * Get list of available models
   * @returns {Promise<Array>} List of available models
   */
  async getAvailableModels() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000,
      });
      return response.data.models?.map(m => m.name) || [];
    } catch (error) {
      console.error(`[${this.name}] Failed to get available models:`, error.message);
      return [];
    }
  }

  /**
   * Handle Ollama-specific errors
   * @param {Error} error - Original error
   * @throws {Error} Formatted error
   */
  _handleOllamaError(error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Ollama server not running. Please start with: ollama serve');
    }

    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      throw new Error(
        `Ollama response timeout. ${this.model} typically takes 60-90 seconds for complex coding questions. This timeout suggests the question was particularly complex or system resources are limited.`
      );
    }

    if (error.response) {
      if (error.response.status === 404) {
        throw new Error(
          `Model '${this.model}' not found. Please pull it with: ollama pull ${this.model}`
        );
      }
      throw new Error(
        `Ollama API error: ${error.response.status} - ${error.response.data?.error || error.response.statusText}`
      );
    }

    throw new Error(`Ollama request failed: ${error.message}`);
  }

  /**
   * Get default Ollama parameters
   * @returns {Object} Default parameters
   */
  getDefaultParameters() {
    return {
      temperature: 0.3,
      top_p: 0.9,
      stream: false,
      num_predict: -1, // Generate until stop
      repeat_penalty: 1.1
    };
  }

  /**
   * Set the base URL for Ollama server
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
}

module.exports = OllamaProvider;
