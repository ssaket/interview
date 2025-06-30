/**
 * AI Configuration Manager
 *
 * Centralizes configuration management for AI providers.
 * Handles environment variables, defaults, validation, and configuration persistence.
 */
class AIConfig {
  constructor() {
    this.defaultConfigs = this._getDefaultConfigs();
    this.envConfig = this._loadFromEnvironment();
    this.userConfig = {};
  }

  /**
   * Get default configurations for all providers
   * @returns {Object} Default configurations
   * @private
   */
  _getDefaultConfigs() {
    return {
      ollama: {
        name: 'ollama',
        model: 'deepseek-coder:6.7b',
        baseUrl: 'http://localhost:11434',
        timeout: 300000, // 5 minutes
        models: {
          simple: ['deepseek-coder-v2', 'codellama:7b-instruct', 'mistral'],
          primary: 'deepseek-coder:6.7b',
        },
        parameters: {
          temperature: 0.4,
          top_p: 0.9,
          repeat_penalty: 1.1,
          num_predict: -1,
        },
      },
      openai: {
        name: 'openai',
        model: 'gpt-3.5-turbo',
        baseUrl: 'https://api.openai.com/v1',
        timeout: 120000, // 2 minutes
        models: {
          chat: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'],
          primary: 'gpt-3.5-turbo',
          reasoning: ['gpt-4', 'gpt-4-turbo'],
          coding: ['gpt-4', 'gpt-3.5-turbo'],
        },
        parameters: {
          temperature: 0.7,
          top_p: 1.0,
          max_tokens: 2048,
          frequency_penalty: 0,
          presence_penalty: 0,
        },
      },
      huggingface: {
        name: 'huggingface',
        model: 'deepseek-ai/DeepSeek-R1-0528',
        provider: 'hyperbolic',
        baseUrl: 'https://api-inference.huggingface.co',
        timeout: 120000, // 2 minutes
        models: {
          chat: [
            'deepseek-ai/DeepSeek-R1-0528',
            'Qwen/Qwen2.5-7B-Instruct',
            'mistralai/Mistral-7B-Instruct-v0.3',
          ],
          primary: 'deepseek-ai/DeepSeek-R1-0528',
          reasoning: ['deepseek-ai/DeepSeek-R1-0528', 'Qwen/Qwen2.5-14B-Instruct'],
          coding: ['deepseek-ai/DeepSeek-R1-0528', 'Qwen/Qwen2.5-Coder-7B-Instruct'],
        },
        parameters: {
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 2048,
          do_sample: true,
          repetition_penalty: 1.1,
        },
      },
      deepseek: {
        name: 'deepseek',
        model: 'deepseek-chat',
        baseUrl: 'https://api.deepseek.com',
        timeout: 120000, // 2 minutes
        models: {
          chat: ['deepseek-chat', 'deepseek-reasoner'],
          primary: 'deepseek-chat',
          reasoning: ['deepseek-reasoner'],
          coding: ['deepseek-chat', 'deepseek-reasoner'],
        },
        parameters: {
          temperature: 0.7,
          top_p: 1.0,
          max_tokens: 2048,
          frequency_penalty: 0,
          presence_penalty: 0,
        },
      },
    };
  }

  /**
   * Load configuration from environment variables
   * @returns {Object} Environment configuration
   * @private
   */
  _loadFromEnvironment() {
    return {
      // Global settings
      defaultProvider: process.env.AI_PROVIDER || 'ollama',

      // Ollama settings
      ollama: {
        model: process.env.OLLAMA_MODEL,
        baseUrl: process.env.OLLAMA_BASE_URL,
        timeout: process.env.OLLAMA_TIMEOUT ? parseInt(process.env.OLLAMA_TIMEOUT) : undefined,
      },

      // OpenAI settings
      openai: {
        model: process.env.OPENAI_MODEL,
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: process.env.OPENAI_BASE_URL,
        timeout: process.env.OPENAI_TIMEOUT ? parseInt(process.env.OPENAI_TIMEOUT) : undefined,
      },

      // HuggingFace settings
      huggingface: {
        model: process.env.HF_MODEL,
        apiToken: process.env.HF_TOKEN,
        provider: process.env.HF_PROVIDER,
        baseUrl: process.env.HF_BASE_URL,
        timeout: process.env.HF_TIMEOUT ? parseInt(process.env.HF_TIMEOUT) : undefined,
      },

      // DeepSeek settings
      deepseek: {
        model: process.env.DEEPSEEK_MODEL,
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseUrl: process.env.DEEPSEEK_BASE_URL,
        timeout: process.env.DEEPSEEK_TIMEOUT ? parseInt(process.env.DEEPSEEK_TIMEOUT) : undefined,
      },
    };
  }

  /**
   * Get configuration for a specific provider
   * @param {string} providerName - Provider name
   * @param {Object} overrides - Configuration overrides
   * @returns {Object} Merged configuration
   */
  getProviderConfig(providerName, overrides = {}) {
    if (!providerName) {
      throw new Error('Provider name is required');
    }

    const normalizedName = providerName.toLowerCase();
    const defaultConfig = this.defaultConfigs[normalizedName] || {};
    const envConfig = this.envConfig[normalizedName] || {};
    const userConfig = this.userConfig[normalizedName] || {};

    // Merge configurations: defaults < env < user < overrides
    return this._deepMerge(defaultConfig, envConfig, userConfig, overrides);
  }

  /**
   * Get all provider configurations
   * @returns {Object} All provider configurations
   */
  getAllProviderConfigs() {
    const configs = {};

    for (const providerName of Object.keys(this.defaultConfigs)) {
      configs[providerName] = this.getProviderConfig(providerName);
    }

    return configs;
  }

  /**
   * Set user configuration for a provider
   * @param {string} providerName - Provider name
   * @param {Object} config - Configuration to set
   */
  setProviderConfig(providerName, config) {
    if (!providerName) {
      throw new Error('Provider name is required');
    }

    const normalizedName = providerName.toLowerCase();
    this.userConfig[normalizedName] = { ...this.userConfig[normalizedName], ...config };
  }

  /**
   * Get the default provider name
   * @returns {string} Default provider name
   */
  getDefaultProvider() {
    return this.envConfig.defaultProvider || 'ollama';
  }

  /**
   * Set the default provider
   * @param {string} providerName - Provider name to set as default
   */
  setDefaultProvider(providerName) {
    this.envConfig.defaultProvider = providerName;
  }

  /**
   * Get available models for a provider
   * @param {string} providerName - Provider name
   * @param {string} category - Model category (optional)
   * @returns {Array} Available models
   */
  getAvailableModels(providerName, category = null) {
    const config = this.getProviderConfig(providerName);
    const models = config.models || {};

    if (category && models[category]) {
      return Array.isArray(models[category]) ? models[category] : [models[category]];
    }

    // Return all models if no category specified
    const allModels = new Set();
    for (const modelList of Object.values(models)) {
      if (Array.isArray(modelList)) {
        modelList.forEach((model) => allModels.add(model));
      } else if (typeof modelList === 'string') {
        allModels.add(modelList);
      }
    }

    return Array.from(allModels);
  }

  /**
   * Get primary model for a provider
   * @param {string} providerName - Provider name
   * @returns {string} Primary model name
   */
  getPrimaryModel(providerName) {
    const config = this.getProviderConfig(providerName);
    return config.models?.primary || config.model;
  }

  /**
   * Validate provider configuration
   * @param {string} providerName - Provider name
   * @param {Object} config - Configuration to validate
   * @returns {Object} Validation result
   */
  validateConfig(providerName, config) {
    const errors = [];
    const warnings = [];

    // Provider-specific validation
    switch (providerName.toLowerCase()) {
      case 'openai':
        if (!config.apiKey) {
          errors.push('OpenAI API key is required');
        }
        break;

      case 'huggingface':
        if (!config.apiToken) {
          warnings.push('HuggingFace API token recommended for better access');
        }
        break;

      case 'ollama':
        if (!config.baseUrl) {
          errors.push('Ollama base URL is required');
        }
        break;
    }

    // Common validation
    if (config.timeout && (config.timeout < 1000 || config.timeout > 600000)) {
      warnings.push('Timeout should be between 1 second and 10 minutes');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Create a configuration preset
   * @param {string} name - Preset name
   * @param {Object} configs - Provider configurations
   */
  createPreset(name, configs) {
    if (!this.presets) {
      this.presets = {};
    }
    this.presets[name] = configs;
  }

  /**
   * Load a configuration preset
   * @param {string} name - Preset name
   * @returns {Object} Preset configurations
   */
  loadPreset(name) {
    if (!this.presets || !this.presets[name]) {
      throw new Error(`Preset '${name}' not found`);
    }
    return this.presets[name];
  }

  /**
   * Get development configuration
   * @returns {Object} Development configuration
   */
  getDevelopmentConfig() {
    return {
      ollama: {
        model: 'phi3:mini',
        baseUrl: 'http://localhost:11434',
        timeout: 60000, // Shorter timeout for development
      },
      openai: {
        model: 'gpt-3.5-turbo',
        timeout: 30000, // Shorter timeout for development
      },
      huggingface: {
        model: 'deepseek-ai/DeepSeek-R1-0528',
        provider: 'hyperbolic',
        timeout: 30000,
      },
    };
  }

  /**
   * Get production configuration
   * @returns {Object} Production configuration
   */
  getProductionConfig() {
    return {
      ollama: {
        timeout: 300000, // 5 minutes for production
        parameters: {
          temperature: 0.4, // More conservative for production
        },
      },
      openai: {
        timeout: 120000, // 2 minutes for production
        parameters: {
          temperature: 0.4,
        },
      },
      huggingface: {
        timeout: 120000,
        parameters: {
          temperature: 0.4,
        },
      },
    };
  }

  /**
   * Export current configuration
   * @returns {Object} Exportable configuration
   */
  exportConfig() {
    return {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      defaultProvider: this.getDefaultProvider(),
      providers: this.getAllProviderConfigs(),
      presets: this.presets || {},
    };
  }

  /**
   * Import configuration
   * @param {Object} configData - Configuration data to import
   */
  importConfig(configData) {
    if (!configData || typeof configData !== 'object') {
      throw new Error('Invalid configuration data');
    }

    if (configData.defaultProvider) {
      this.setDefaultProvider(configData.defaultProvider);
    }

    if (configData.providers) {
      for (const [providerName, config] of Object.entries(configData.providers)) {
        this.setProviderConfig(providerName, config);
      }
    }

    if (configData.presets) {
      this.presets = { ...this.presets, ...configData.presets };
    }
  }

  /**
   * Reset configuration to defaults
   * @param {string} providerName - Provider to reset (optional, resets all if not specified)
   */
  resetConfig(providerName = null) {
    if (providerName) {
      delete this.userConfig[providerName.toLowerCase()];
    } else {
      this.userConfig = {};
      this.envConfig = this._loadFromEnvironment();
    }
  }

  /**
   * Deep merge multiple objects
   * @param {...Object} objects - Objects to merge
   * @returns {Object} Merged object
   * @private
   */
  _deepMerge(...objects) {
    const result = {};

    for (const obj of objects) {
      if (!obj || typeof obj !== 'object') continue;

      for (const [key, value] of Object.entries(obj)) {
        if (value === null || value === undefined) continue;

        if (Array.isArray(value)) {
          result[key] = [...value];
        } else if (typeof value === 'object' && !Array.isArray(value)) {
          result[key] = this._deepMerge(result[key] || {}, value);
        } else {
          result[key] = value;
        }
      }
    }

    return result;
  }

  /**
   * Get configuration summary
   * @returns {Object} Configuration summary
   */
  getSummary() {
    const summary = {
      defaultProvider: this.getDefaultProvider(),
      providers: {},
      environment: {
        hasOllamaUrl: !!process.env.OLLAMA_BASE_URL,
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        hasHFToken: !!process.env.HF_TOKEN,
      },
    };

    for (const providerName of Object.keys(this.defaultConfigs)) {
      const config = this.getProviderConfig(providerName);
      summary.providers[providerName] = {
        model: config.model,
        configured: this._isProviderConfigured(providerName, config),
      };
    }

    return summary;
  }

  /**
   * Check if a provider is properly configured
   * @param {string} providerName - Provider name
   * @param {Object} config - Provider configuration
   * @returns {boolean} True if properly configured
   * @private
   */
  _isProviderConfigured(providerName, config) {
    switch (providerName.toLowerCase()) {
      case 'openai':
        return !!config.apiKey;
      case 'ollama':
        return !!config.baseUrl;
      case 'huggingface':
        return true; // Can work without token for some models
      case 'deepseek':
        return !!config.apiKey;
      default:
        return true;
    }
  }
}

// Create and export singleton instance
const aiConfig = new AIConfig();

module.exports = {
  AIConfig,
  aiConfig,

  // Convenience methods using singleton
  getProviderConfig: (providerName, overrides) =>
    aiConfig.getProviderConfig(providerName, overrides),
  setProviderConfig: (providerName, config) => aiConfig.setProviderConfig(providerName, config),
  getDefaultProvider: () => aiConfig.getDefaultProvider(),
  setDefaultProvider: (providerName) => aiConfig.setDefaultProvider(providerName),
  getAvailableModels: (providerName, category) =>
    aiConfig.getAvailableModels(providerName, category),
  getPrimaryModel: (providerName) => aiConfig.getPrimaryModel(providerName),
  validateConfig: (providerName, config) => aiConfig.validateConfig(providerName, config),
  getSummary: () => aiConfig.getSummary(),
};
