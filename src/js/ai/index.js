/**
 * AI Module Index
 *
 * Central export point for all AI-related components.
 * Provides a clean API for consuming the AI management system.
 */

// Core AI Manager
const AIManager = require('./ai-manager');

// Provider Factory and related utilities
const {
  ProviderFactory,
  defaultFactory,
  createProvider,
  createProviderWithEnvConfig,
  getAvailableProviders,
  hasProvider,
  registerProvider,
  getProviderConfigTemplate,
  validateProviderConfig,
} = require('./provider-factory');

// Configuration management
const {
  AIConfig,
  aiConfig,
  getProviderConfig,
  setProviderConfig,
  getDefaultProvider,
  setDefaultProvider,
  getAvailableModels,
  getPrimaryModel,
  validateConfig,
  getSummary,
} = require('./ai-config');

// Individual providers
const BaseAIProvider = require('./providers/base-provider');
const OllamaProvider = require('./providers/ollama-provider');
const OpenAIProvider = require('./providers/openai-provider');
const HuggingFaceProvider = require('./providers/huggingface-provider');
const DeepSeekProvider = require('./providers/deepseek-provider');

// Export main components
module.exports = {
  // Core AI Manager
  AIManager,

  // Provider Factory
  ProviderFactory,
  defaultFactory,
  createProvider,
  createProviderWithEnvConfig,
  getAvailableProviders,
  hasProvider,
  registerProvider,
  getProviderConfigTemplate,
  validateProviderConfig,

  // Configuration Management
  AIConfig,
  aiConfig,
  getProviderConfig,
  setProviderConfig,
  getDefaultProvider,
  setDefaultProvider,
  getAvailableModels,
  getPrimaryModel,
  validateConfig,
  getSummary,

  // Provider Classes
  BaseAIProvider,
  OllamaProvider,
  OpenAIProvider,
  HuggingFaceProvider,
  DeepSeekProvider,

  // Convenience factory functions
  providers: {
    BaseAIProvider,
    OllamaProvider,
    OpenAIProvider,
    HuggingFaceProvider,
    DeepSeekProvider,
  },

  // Quick setup utilities
  utils: {
    /**
     * Create a fully configured AI Manager with default settings
     * @param {Object} appController - Application controller instance
     * @param {string} provider - Provider name (optional)
     * @returns {AIManager} Configured AI Manager
     */
    createAIManager(appController, provider = null) {
      const manager = new AIManager(appController);
      if (provider) {
        manager.initialize(provider);
      }
      return manager;
    },

    /**
     * Create multiple providers from environment configuration
     * @returns {Map<string, BaseAIProvider>} Map of provider instances
     */
    createProvidersFromEnv() {
      const providers = new Map();
      const availableProviders = getAvailableProviders();

      for (const providerName of availableProviders) {
        try {
          const provider = createProviderWithEnvConfig(providerName);
          providers.set(providerName, provider);
        } catch (error) {
          console.warn(`Failed to create ${providerName} provider:`, error.message);
        }
      }

      return providers;
    },

    /**
     * Get system status for all providers
     * @returns {Promise<Object>} Status information
     */
    async getSystemStatus() {
      const status = {
        timestamp: new Date().toISOString(),
        config: getSummary(),
        providers: {},
      };

      const providers = this.createProvidersFromEnv();

      for (const [name, provider] of providers) {
        try {
          const isOnline = await provider.warmup();
          status.providers[name] = {
            online: isOnline,
            model: provider.getModel(),
            config: provider.getConfig(),
          };
        } catch (error) {
          status.providers[name] = {
            online: false,
            error: error.message,
          };
        }
      }

      return status;
    },

    /**
     * Register a custom provider
     * @param {string} name - Provider name
     * @param {Class} providerClass - Provider class
     * @param {Object} defaultConfig - Default configuration
     */
    registerCustomProvider(name, providerClass, defaultConfig = {}) {
      // Register with factory
      registerProvider(name, providerClass);

      // Add to configuration
      aiConfig.defaultConfigs[name.toLowerCase()] = defaultConfig;
    },
  },
};

// Also export as named exports for ES6 compatibility
module.exports.default = module.exports;
