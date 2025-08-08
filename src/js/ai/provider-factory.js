const OllamaProvider = require('./providers/ollama-provider');
const OpenAIProvider = require('./providers/openai-provider');
const HuggingFaceProvider = require('./providers/huggingface-provider');
const DeepSeekProvider = require('./providers/deepseek-provider');

/**
 * AI Provider Factory
 *
 * Factory class for creating AI provider instances using the Factory pattern.
 * Supports registering custom providers and creating instances based on provider type.
 */
class ProviderFactory {
  constructor() {
    this._providers = new Map();
    this._registerBuiltInProviders();
  }

  /**
   * Register built-in providers
   * @private
   */
  _registerBuiltInProviders() {
    this.registerProvider('ollama', OllamaProvider);
    this.registerProvider('openai', OpenAIProvider);
    this.registerProvider('huggingface', HuggingFaceProvider);
    this.registerProvider('hf', HuggingFaceProvider); // Alias
    this.registerProvider('deepseek', DeepSeekProvider);
  }

  /**
   * Register a new provider type
   * @param {string} name - Provider name
   * @param {Class} providerClass - Provider class constructor
   */
  registerProvider(name, providerClass) {
    if (typeof name !== 'string' || !name.trim()) {
      throw new Error('Provider name must be a non-empty string');
    }

    if (!providerClass || typeof providerClass !== 'function') {
      throw new Error('Provider class must be a constructor function');
    }

    this._providers.set(name.toLowerCase(), providerClass);
  }

  /**
   * Create a provider instance
   * @param {string} providerName - Name of the provider to create
   * @param {Object} config - Configuration for the provider
   * @returns {BaseAIProvider} Provider instance
   */
  createProvider(providerName, config = {}) {
    if (!providerName || typeof providerName !== 'string') {
      throw new Error('Provider name is required and must be a string');
    }

    const normalizedName = providerName.toLowerCase();
    const ProviderClass = this._providers.get(normalizedName);

    if (!ProviderClass) {
      const availableProviders = Array.from(this._providers.keys()).join(', ');
      throw new Error(
        `Unknown provider: ${providerName}. Available providers: ${availableProviders}`
      );
    }

    try {
      return new ProviderClass(config);
    } catch (error) {
      throw new Error(`Failed to create ${providerName} provider: ${error.message}`);
    }
  }

  /**
   * Get list of registered provider names
   * @returns {Array<string>} Array of provider names
   */
  getAvailableProviders() {
    return Array.from(this._providers.keys());
  }

  /**
   * Check if a provider is registered
   * @param {string} providerName - Provider name to check
   * @returns {boolean} True if provider is registered
   */
  hasProvider(providerName) {
    if (!providerName || typeof providerName !== 'string') {
      return false;
    }
    return this._providers.has(providerName.toLowerCase());
  }

  /**
   * Unregister a provider
   * @param {string} providerName - Provider name to unregister
   * @returns {boolean} True if provider was unregistered
   */
  unregisterProvider(providerName) {
    if (!providerName || typeof providerName !== 'string') {
      return false;
    }
    return this._providers.delete(providerName.toLowerCase());
  }

  /**
   * Create multiple providers from configuration
   * @param {Object} providersConfig - Configuration object with provider configs
   * @returns {Map<string, BaseAIProvider>} Map of provider instances
   * @example
   * const providers = factory.createProviders({
   *   ollama: { model: 'phi3:mini', baseUrl: 'http://localhost:11434' },
   *   openai: { model: 'gpt-3.5-turbo', apiKey: 'sk-...' }
   * });
   */
  createProviders(providersConfig) {
    if (!providersConfig || typeof providersConfig !== 'object') {
      throw new Error('Providers configuration must be an object');
    }

    const providers = new Map();
    const errors = [];

    for (const [providerName, config] of Object.entries(providersConfig)) {
      try {
        const provider = this.createProvider(providerName, config);
        providers.set(providerName, provider);
      } catch (error) {
        errors.push(`${providerName}: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Failed to create some providers:\n${errors.join('\n')}`);
    }

    return providers;
  }

  /**
   * Create a provider with automatic configuration from environment
   * @param {string} providerName - Provider name
   * @param {Object} overrides - Configuration overrides
   * @returns {BaseAIProvider} Provider instance
   */
  createProviderWithEnvConfig(providerName, overrides = {}) {
    const envConfigs = {
      ollama: {
        model: process.env.OLLAMA_MODEL,
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      },
      openai: {
        model: process.env.OPENAI_MODEL,
        apiKey: process.env.OPENAI_API_KEY,
      },
      huggingface: {
        model: process.env.HF_MODEL,
        apiToken: process.env.HF_TOKEN,
        provider: process.env.HF_PROVIDER || 'hyperbolic',
      },
      deepseek: {
        model: process.env.DEEPSEEK_MODEL,
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      },
    };

    const normalizedName = providerName.toLowerCase();
    const envConfig = envConfigs[normalizedName] || {};
    const finalConfig = { ...envConfig, ...overrides };

    return this.createProvider(providerName, finalConfig);
  }

  /**
   * Get provider configuration template
   * @param {string} providerName - Provider name
   * @returns {Object} Configuration template with descriptions
   */
  getProviderConfigTemplate(providerName) {
    const templates = {
      ollama: {
        model: {
          required: false,
          default: 'gpt-oss',
          description: 'Ollama model name',
        },
        baseUrl: {
          required: false,
          default: 'http://localhost:11434',
          description: 'Ollama server URL',
        },
        timeout: {
          required: false,
          default: 300000,
          description: 'Request timeout in milliseconds',
        },
      },
      openai: {
        model: { required: false, default: 'gpt-3.5-turbo', description: 'OpenAI model name' },
        apiKey: { required: true, description: 'OpenAI API key' },
        baseUrl: {
          required: false,
          default: 'https://api.openai.com/v1',
          description: 'API base URL',
        },
        timeout: {
          required: false,
          default: 120000,
          description: 'Request timeout in milliseconds',
        },
      },
      huggingface: {
        model: {
          required: false,
          default: 'deepseek-ai/DeepSeek-R1-0528',
          description: 'HuggingFace model name',
        },
        apiToken: { required: false, description: 'HuggingFace API token' },
        provider: { required: false, default: 'hyperbolic', description: 'HuggingFace provider' },
        timeout: {
          required: false,
          default: 120000,
          description: 'Request timeout in milliseconds',
        },
      },
      deepseek: {
        model: {
          required: false,
          default: 'deepseek-chat',
          description: 'DeepSeek model name (deepseek-chat or deepseek-reasoner)',
        },
        apiKey: { required: true, description: 'DeepSeek API key' },
        baseUrl: {
          required: false,
          default: 'https://api.deepseek.com',
          description: 'DeepSeek API base URL',
        },
        timeout: {
          required: false,
          default: 120000,
          description: 'Request timeout in milliseconds',
        },
      },
    };

    const normalizedName = providerName.toLowerCase();
    return templates[normalizedName] || {};
  }

  /**
   * Validate provider configuration
   * @param {string} providerName - Provider name
   * @param {Object} config - Configuration to validate
   * @returns {Object} Validation result with errors if any
   */
  validateProviderConfig(providerName, config) {
    const template = this.getProviderConfigTemplate(providerName);
    const errors = [];
    const warnings = [];

    for (const [key, requirements] of Object.entries(template)) {
      if (requirements.required && (!config[key] || config[key] === '')) {
        errors.push(`${key} is required for ${providerName} provider`);
      }
    }

    // Check for unknown configuration keys
    for (const key of Object.keys(config)) {
      if (!template[key]) {
        warnings.push(`Unknown configuration key: ${key}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

// Create and export a singleton instance for convenience
const defaultFactory = new ProviderFactory();

module.exports = {
  ProviderFactory,
  defaultFactory,

  // Convenience methods using the default factory
  createProvider: (providerName, config) => defaultFactory.createProvider(providerName, config),
  createProviderWithEnvConfig: (providerName, overrides) =>
    defaultFactory.createProviderWithEnvConfig(providerName, overrides),
  getAvailableProviders: () => defaultFactory.getAvailableProviders(),
  hasProvider: (providerName) => defaultFactory.hasProvider(providerName),
  registerProvider: (name, providerClass) => defaultFactory.registerProvider(name, providerClass),
  getProviderConfigTemplate: (providerName) =>
    defaultFactory.getProviderConfigTemplate(providerName),
  validateProviderConfig: (providerName, config) =>
    defaultFactory.validateProviderConfig(providerName, config),
};
