/**
 * AI Configuration Manager
 *
 * Single source of truth for all AI provider configurations.
 * Handles environment variables, defaults, validation, and configuration persistence.
 */
class AIConfig {
  constructor() {
    this.config = this._loadConfiguration();
  }

  /**
   * Load complete configuration from environment and defaults
   * @returns {Object} Complete configuration
   * @private
   */
  _loadConfiguration() {
    const defaults = {
      defaultProvider: 'ollama',
      providers: {
        ollama: {
          name: 'ollama',
          model: 'gpt-oss',
          baseUrl: 'http://localhost:11434',
          timeout: 300000,
          models: {
            local: ['deepseek-coder-v2', 'qwen3:4b-instruct-2507-fp16', 'gpt-oss', 'magistral'],
            primary: 'gpt-oss',
            hybrid: 'qwen3:4b-instruct-2507-fp16', // Default model for hybrid AI flow
          },
          parameters: {
            temperature: 0.3,
            top_p: 0.9,
            repeat_penalty: 1.1,
            num_predict: -1,
          },
        },
        openai: {
          name: 'openai',
          model: 'gpt-3.5-turbo',
          baseUrl: 'https://api.openai.com/v1',
          timeout: 120000,
          models: {
            chat: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'],
            primary: 'gpt-3.5-turbo',
            reasoning: ['gpt-4', 'gpt-4-turbo'],
            coding: ['gpt-4', 'gpt-3.5-turbo'],
          },
          parameters: {
            temperature: 0.3,
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
          timeout: 120000,
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
            temperature: 0.3,
            top_p: 0.9,
            max_tokens: 2048,
            do_sample: true,
            repetition_penalty: 1.1,
          },
        },
        deepseek: {
          name: 'deepseek',
          model: 'deepseek-reasoner',
          baseUrl: 'https://api.deepseek.com',
          timeout: 120000,
          models: {
            chat: ['deepseek-reasoner'],
            primary: 'deepseek-reasoner',
            reasoning: ['deepseek-reasoner'],
            coding: ['deepseek-reasoner'],
          },
          parameters: {
            temperature: 0.1,
            top_p: 0.9,
            max_tokens: 4096,
            frequency_penalty: 0,
            presence_penalty: 0,
          },
          version: '3.1',
        },
      },
    };

    // Override with environment variables
    const envOverrides = {
      defaultProvider: process.env.AI_PROVIDER || defaults.defaultProvider,
      providers: {
        ollama: {
          ...defaults.providers.ollama,
          model: process.env.OLLAMA_MODEL || defaults.providers.ollama.model,
          baseUrl: process.env.OLLAMA_BASE_URL || defaults.providers.ollama.baseUrl,
          timeout: process.env.OLLAMA_TIMEOUT
            ? parseInt(process.env.OLLAMA_TIMEOUT)
            : defaults.providers.ollama.timeout,
          models: {
            ...defaults.providers.ollama.models,
            hybrid: process.env.OLLAMA_HYBRID_MODEL || defaults.providers.ollama.models.hybrid,
          },
        },
        openai: {
          ...defaults.providers.openai,
          model: process.env.OPENAI_MODEL || defaults.providers.openai.model,
          apiKey: process.env.OPENAI_API_KEY,
          baseUrl: process.env.OPENAI_BASE_URL || defaults.providers.openai.baseUrl,
          timeout: process.env.OPENAI_TIMEOUT
            ? parseInt(process.env.OPENAI_TIMEOUT)
            : defaults.providers.openai.timeout,
        },
        huggingface: {
          ...defaults.providers.huggingface,
          model: process.env.HF_MODEL || defaults.providers.huggingface.model,
          apiToken: process.env.HF_TOKEN,
          provider: process.env.HF_PROVIDER || defaults.providers.huggingface.provider,
          baseUrl: process.env.HF_BASE_URL || defaults.providers.huggingface.baseUrl,
          timeout: process.env.HF_TIMEOUT
            ? parseInt(process.env.HF_TIMEOUT)
            : defaults.providers.huggingface.timeout,
        },
        deepseek: {
          ...defaults.providers.deepseek,
          model: process.env.DEEPSEEK_MODEL || defaults.providers.deepseek.model,
          apiKey: process.env.DEEPSEEK_API_KEY,
          baseUrl: process.env.DEEPSEEK_BASE_URL || defaults.providers.deepseek.baseUrl,
          timeout: process.env.DEEPSEEK_TIMEOUT
            ? parseInt(process.env.DEEPSEEK_TIMEOUT)
            : defaults.providers.deepseek.timeout,
        },
      },
    };

    return envOverrides;
  }

  /**
   * Get configuration for a specific provider
   * @param {string} providerName - Provider name
   * @param {Object} overrides - Configuration overrides
   * @returns {Object} Complete provider configuration
   */
  getProviderConfig(providerName, overrides = {}) {
    if (!providerName) {
      throw new Error('Provider name is required');
    }

    const normalizedName = providerName.toLowerCase();
    const providerConfig = this.config.providers[normalizedName];

    if (!providerConfig) {
      throw new Error(`Unknown provider: ${providerName}`);
    }

    return { ...providerConfig, ...overrides };
  }

  /**
   * Get all provider configurations
   * @returns {Object} All provider configurations
   */
  getAllProviderConfigs() {
    return this.config.providers;
  }

  /**
   * Update configuration for a provider
   * @param {string} providerName - Provider name
   * @param {Object} newConfig - Configuration updates
   */
  updateProviderConfig(providerName, newConfig) {
    if (!providerName) {
      throw new Error('Provider name is required');
    }

    const normalizedName = providerName.toLowerCase();
    if (!this.config.providers[normalizedName]) {
      throw new Error(`Unknown provider: ${providerName}`);
    }

    this.config.providers[normalizedName] = {
      ...this.config.providers[normalizedName],
      ...newConfig,
    };
  }

  /**
   * Get the default provider name
   * @returns {string} Default provider name
   */
  getDefaultProvider() {
    return this.config.defaultProvider;
  }

  /**
   * Set the default provider
   * @param {string} providerName - Provider name to set as default
   */
  setDefaultProvider(providerName) {
    if (!this.config.providers[providerName.toLowerCase()]) {
      throw new Error(`Unknown provider: ${providerName}`);
    }
    this.config.defaultProvider = providerName;
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
   * Get hybrid model for a provider (used in hybrid AI flow)
   * @param {string} providerName - Provider name
   * @returns {string} Hybrid model name
   */
  getHybridModel(providerName) {
    const config = this.getProviderConfig(providerName);
    return config.models?.hybrid || config.models?.primary || config.model;
  }

  /**
   * Validate provider configuration
   * @param {string} providerName - Provider name
   * @returns {Object} Validation result
   */
  validateProvider(providerName) {
    const config = this.getProviderConfig(providerName);
    const errors = [];
    const warnings = [];

    switch (providerName.toLowerCase()) {
      case 'openai':
        if (!config.apiKey) {
          errors.push('OpenAI API key is required');
        }
        break;
      case 'deepseek':
        if (!config.apiKey) {
          errors.push('DeepSeek API key is required');
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
   * Check if a provider is properly configured
   * @param {string} providerName - Provider name
   * @returns {boolean} True if properly configured
   */
  isProviderConfigured(providerName) {
    const validation = this.validateProvider(providerName);
    return validation.valid;
  }

  /**
   * Get configuration summary
   * @returns {Object} Configuration summary
   */
  getSummary() {
    const summary = {
      defaultProvider: this.getDefaultProvider(),
      providers: {},
    };

    for (const [providerName, config] of Object.entries(this.config.providers)) {
      summary.providers[providerName] = {
        model: config.model,
        configured: this.isProviderConfigured(providerName),
      };
    }

    return summary;
  }

  /**
   * Reset configuration to defaults and reload from environment
   */
  reset() {
    this.config = this._loadConfiguration();
  }
}

// Export singleton instance
module.exports = new AIConfig();
