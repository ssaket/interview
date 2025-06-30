/**
 * Base AI Provider Interface
 *
 * This abstract class defines the interface that all AI providers must implement.
 * It provides common functionality and ensures consistency across different providers.
 */
class BaseAIProvider {
  constructor(config = {}) {
    if (this.constructor === BaseAIProvider) {
      throw new Error('BaseAIProvider is an abstract class and cannot be instantiated directly');
    }

    this.config = config;
    this.name = config.name || 'unknown';
    this.model = config.model || 'default';
    this.timeout = config.timeout || 300000; // 5 minutes default
  }

  /**
   * Perform a chat completion request
   * @param {Object} options - Chat completion options
   * @param {Array} options.messages - Array of message objects
   * @param {boolean} options.stream - Whether to stream the response
   * @param {Object} options.parameters - Additional model parameters
   * @returns {Promise<Object>} Standardized response object
   */
  async chatCompletion(options) {
    throw new Error('chatCompletion method must be implemented by subclass');
  }

  /**
   * Test if the provider is available and responsive
   * @returns {Promise<boolean>} True if provider is available
   */
  async warmup() {
    try {
      await this.chatCompletion({
        messages: [{ role: 'user', content: 'ping' }],
        stream: false
      });
      return true;
    } catch (error) {
      console.warn(`[${this.name}] Warmup failed:`, error.message);
      return false;
    }
  }

  /**
   * Get provider-specific configuration
   * @returns {Object} Configuration object
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Update provider configuration
   * @param {Object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get the current model name
   * @returns {string} Model name
   */
  getModel() {
    return this.model;
  }

  /**
   * Set the model to use
   * @param {string} model - Model name
   */
  setModel(model) {
    this.model = model;
  }

  /**
   * Get provider name
   * @returns {string} Provider name
   */
  getName() {
    return this.name;
  }

  /**
   * Standardize response format across providers
   * @param {any} rawResponse - Raw response from provider
   * @returns {Object} Standardized response
   */
  _standardizeResponse(rawResponse) {
    // Default implementation - subclasses can override
    return {
      choices: [
        {
          message: {
            role: 'assistant',
            content: rawResponse
          }
        }
      ]
    };
  }

  /**
   * Handle provider-specific errors
   * @param {Error} error - Original error
   * @param {string} context - Context where error occurred
   * @throws {Error} Standardized error
   */
  _handleError(error, context = 'request') {
    const errorMessage = `[${this.name}] ${context} failed: ${error.message}`;
    console.error(errorMessage, error);
    throw new Error(errorMessage);
  }

  /**
   * Validate chat completion options
   * @param {Object} options - Options to validate
   * @throws {Error} If options are invalid
   */
  _validateChatOptions(options) {
    if (!options || typeof options !== 'object') {
      throw new Error('Chat options must be an object');
    }

    if (!options.messages || !Array.isArray(options.messages)) {
      throw new Error('Messages must be an array');
    }

    if (options.messages.length === 0) {
      throw new Error('Messages array cannot be empty');
    }

    // Validate message format
    for (const message of options.messages) {
      if (!message.role || !message.content) {
        throw new Error('Each message must have role and content properties');
      }
    }
  }

  /**
   * Get default parameters for this provider
   * @returns {Object} Default parameters
   */
  getDefaultParameters() {
    return {
      temperature: 0.7,
      top_p: 0.9,
      stream: false
    };
  }

  /**
   * Merge user parameters with defaults
   * @param {Object} userParams - User-provided parameters
   * @returns {Object} Merged parameters
   */
  _mergeParameters(userParams = {}) {
    return {
      ...this.getDefaultParameters(),
      ...userParams
    };
  }
}

module.exports = BaseAIProvider;
