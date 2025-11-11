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
          timeout: 90000,
          models: {
            local: ['deepseek-coder-v2', 'qwen3:4b-instruct-2507-fp16', 'gpt-oss', 'magistral'],
            primary: 'gpt-oss',
            hybrid: 'qwen3:4b-instruct-2507-fp16', // Default model for hybrid AI flow (fallback)
            hybridByType: {
              // Interview-type-specific hybrid models (Phase 1 of hybrid flow)
              dsa: 'qwen3:4b-instruct-2507-fp16',
              systemDesign: 'magistral',
              lld: 'magistral',
            },
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
          model: 'deepseek-chat',
          baseUrl: 'https://api.deepseek.com',
          timeout: 120000,
          reasonerTimeout: 100000, // Timeout for deepseek-reasoner (100s default to limit thinking)
          stepsReasonerTimeout: 240000, // Timeout for deepseek-reasoner in STEPS flow (240s = 4 minutes)
          reasonerTimeoutByType: {
            // Interview-type-specific timeouts for deepseek-reasoner in CLOUD/HYBRID flows
            dsa: 100000, // 100s for DSA (default)
            systemDesign: 180000, // 180s (3 minutes) for System Design
            lld: 180000, // 180s (3 minutes) for Low-Level Design
          },
          stepsReasonerTimeoutByType: {
            // Interview-type-specific timeouts for deepseek-reasoner in STEPS flow
            dsa: 240000, // 240s (4 minutes) for DSA (default)
            systemDesign: 360000, // 360s (6 minutes) for System Design
            lld: 360000, // 360s (6 minutes) for Low-Level Design
          },
          models: {
            chat: ['deepseek-chat'],
            primary: 'deepseek-chat',
            reasoning: ['deepseek-reasoner'],
            coding: ['deepseek-chat'],
            cloud: 'deepseek-chat', // For CLOUD flow - fast, no extended reasoning
            hybrid: 'deepseek-reasoner', // For HYBRID flow - deep reasoning to optimize local solution
            steps: 'deepseek-reasoner', // For STEPS flow optimization phase - deep reasoning with 240s timeout
          },
          parameters: {
            temperature: 0.3,
            top_p: 0.9,
            max_tokens: 2048,
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
            hybridByType: {
              dsa: process.env.OLLAMA_HYBRID_MODEL_DSA || defaults.providers.ollama.models.hybridByType.dsa,
              systemDesign: process.env.OLLAMA_HYBRID_MODEL_SYSTEM_DESIGN || defaults.providers.ollama.models.hybridByType.systemDesign,
              lld: process.env.OLLAMA_HYBRID_MODEL_LLD || defaults.providers.ollama.models.hybridByType.lld,
            },
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
          reasonerTimeout: process.env.DEEPSEEK_REASONER_TIMEOUT
            ? parseInt(process.env.DEEPSEEK_REASONER_TIMEOUT)
            : defaults.providers.deepseek.reasonerTimeout,
          stepsReasonerTimeout: process.env.DEEPSEEK_STEPS_TIMEOUT
            ? parseInt(process.env.DEEPSEEK_STEPS_TIMEOUT)
            : defaults.providers.deepseek.stepsReasonerTimeout,
          reasonerTimeoutByType: {
            dsa: process.env.DEEPSEEK_REASONER_TIMEOUT_DSA
              ? parseInt(process.env.DEEPSEEK_REASONER_TIMEOUT_DSA)
              : defaults.providers.deepseek.reasonerTimeoutByType.dsa,
            systemDesign: process.env.DEEPSEEK_REASONER_TIMEOUT_SYSTEM_DESIGN
              ? parseInt(process.env.DEEPSEEK_REASONER_TIMEOUT_SYSTEM_DESIGN)
              : defaults.providers.deepseek.reasonerTimeoutByType.systemDesign,
            lld: process.env.DEEPSEEK_REASONER_TIMEOUT_LLD
              ? parseInt(process.env.DEEPSEEK_REASONER_TIMEOUT_LLD)
              : defaults.providers.deepseek.reasonerTimeoutByType.lld,
          },
          stepsReasonerTimeoutByType: {
            dsa: process.env.DEEPSEEK_STEPS_TIMEOUT_DSA
              ? parseInt(process.env.DEEPSEEK_STEPS_TIMEOUT_DSA)
              : defaults.providers.deepseek.stepsReasonerTimeoutByType.dsa,
            systemDesign: process.env.DEEPSEEK_STEPS_TIMEOUT_SYSTEM_DESIGN
              ? parseInt(process.env.DEEPSEEK_STEPS_TIMEOUT_SYSTEM_DESIGN)
              : defaults.providers.deepseek.stepsReasonerTimeoutByType.systemDesign,
            lld: process.env.DEEPSEEK_STEPS_TIMEOUT_LLD
              ? parseInt(process.env.DEEPSEEK_STEPS_TIMEOUT_LLD)
              : defaults.providers.deepseek.stepsReasonerTimeoutByType.lld,
          },
          models: {
            ...defaults.providers.deepseek.models,
            cloud: process.env.DEEPSEEK_CLOUD_MODEL || defaults.providers.deepseek.models.cloud,
            hybrid: process.env.DEEPSEEK_HYBRID_MODEL || defaults.providers.deepseek.models.hybrid,
            steps: process.env.DEEPSEEK_STEPS_MODEL || defaults.providers.deepseek.models.steps,
          },
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
   * Get hybrid model for a provider based on interview type
   * @param {string} providerName - Provider name
   * @param {string} interviewType - Interview type (dsa, systemDesign, lld)
   * @returns {string} Hybrid model name for the specific interview type
   */
  getHybridModelByType(providerName, interviewType) {
    const config = this.getProviderConfig(providerName);

    // Try to get interview-type-specific hybrid model
    if (config.models?.hybridByType && config.models.hybridByType[interviewType]) {
      return config.models.hybridByType[interviewType];
    }

    // Fallback to general hybrid model
    return this.getHybridModel(providerName);
  }

  /**
   * Get cloud model for a provider (used in cloud AI flow)
   * @param {string} providerName - Provider name
   * @returns {string} Cloud model name
   */
  getCloudModel(providerName) {
    const config = this.getProviderConfig(providerName);
    return config.models?.cloud || config.models?.primary || config.model;
  }

  /**
   * Get model for specific flow type
   * @param {string} providerName - Provider name
   * @param {string} flowType - Flow type ('local', 'cloud', 'hybrid')
   * @param {string} interviewType - Optional interview type for hybrid flow (dsa, systemDesign, lld)
   * @returns {string} Model name for the flow
   */
  getFlowModel(providerName, flowType, interviewType = null) {
    const config = this.getProviderConfig(providerName);

    let model;
    switch (flowType) {
      case 'cloud':
        model = config.models?.cloud || config.models?.primary || config.model;
        break;
      case 'hybrid':
        // For hybrid flow: Use interview-type-specific model if provided and available
        if (interviewType && config.models?.hybridByType && config.models.hybridByType[interviewType]) {
          model = config.models.hybridByType[interviewType];
        } else {
          model = config.models?.hybrid || config.models?.primary || config.model;
        }
        break;
      case 'steps':
        // For STEPS flow: Use steps model (deepseek-reasoner for optimization phase)
        model = config.models?.steps || config.models?.hybrid || config.models?.primary || config.model;
        break;
      case 'local':
        model = config.models?.local || config.models?.primary || config.model;
        break;
      default:
        model = config.models?.primary || config.model;
    }

    // If model is an array (like the local models list), use the primary model instead
    if (Array.isArray(model)) {
      return config.models?.primary || config.model;
    }

    return model;
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
   * Get reasoner timeout based on interview type and flow type
   * @param {string} providerName - Provider name (should be 'deepseek')
   * @param {string} flowType - Flow type ('cloud', 'hybrid', 'steps')
   * @param {string} interviewType - Interview type ('dsa', 'systemDesign', 'lld')
   * @returns {number} Timeout in milliseconds
   */
  getReasonerTimeout(providerName, flowType, interviewType) {
    const config = this.getProviderConfig(providerName);

    // Only applicable for DeepSeek
    if (providerName !== 'deepseek') {
      return config.timeout;
    }

    // Determine which timeout configuration to use based on flow type
    if (flowType === 'steps') {
      // STEPS flow uses stepsReasonerTimeoutByType
      if (config.stepsReasonerTimeoutByType && config.stepsReasonerTimeoutByType[interviewType]) {
        return config.stepsReasonerTimeoutByType[interviewType];
      }
      // Fallback to general stepsReasonerTimeout
      return config.stepsReasonerTimeout || config.timeout;
    } else {
      // CLOUD/HYBRID flows use reasonerTimeoutByType
      if (config.reasonerTimeoutByType && config.reasonerTimeoutByType[interviewType]) {
        return config.reasonerTimeoutByType[interviewType];
      }
      // Fallback to general reasonerTimeout
      return config.reasonerTimeout || config.timeout;
    }
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
