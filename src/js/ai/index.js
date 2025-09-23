/**
 * Simplified AI Module Index
 *
 * Exports the simplified AI system components.
 * Replaces the complex provider class hierarchy with simple functions.
 */

const simpleAI = require('./simple-ai');
const SimpleAIManager = require('./simple-ai-manager');
const aiConfig = require('./ai-config');

// Export everything from simpleAI for convenience
module.exports = {
  // Main AI functions
  chatCompletion: simpleAI.chatCompletion,
  testProvider: simpleAI.testProvider,

  // Configuration functions
  getDefaultProvider: simpleAI.getDefaultProvider,
  getAllProviders: simpleAI.getAllProviders,
  getProviderConfig: simpleAI.getProviderConfig,
  setDefaultProvider: simpleAI.setDefaultProvider,
  getAvailableModels: simpleAI.getAvailableModels,
  getCurrentModel: simpleAI.getCurrentModel,
  updateProviderConfig: simpleAI.updateProviderConfig,

  // Classes
  SimpleAIManager,
  AIManager: SimpleAIManager, // Compatibility alias

  // Configuration
  aiConfig,

  // Utility functions
  /**
   * Create a simple AI manager instance
   * @param {Object} appController - Application controller instance
   * @returns {SimpleAIManager} Configured AI Manager
   */
  createAIManager(appController) {
    return new SimpleAIManager(appController);
  },

  /**
   * Get configuration summary
   * @returns {Object} Configuration summary
   */
  getSummary() {
    return aiConfig.getSummary();
  },

  /**
   * Test all providers
   * @returns {Promise<Object>} Test results for all providers
   */
  async testAllProviders() {
    const results = {};
    const providers = simpleAI.getAllProviders();

    for (const provider of providers) {
      try {
        results[provider] = await simpleAI.testProvider(provider);
      } catch (error) {
        results[provider] = false;
      }
    }

    return results;
  },
};
