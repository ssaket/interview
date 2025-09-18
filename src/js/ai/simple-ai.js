const axios = require('axios');
const aiConfig = require('./ai-config');

/**
 * Simplified AI Module
 *
 * Replaces complex provider class hierarchy with simple functions.
 * Most AI providers use OpenAI-compatible APIs, so we can unify them.
 */

/**
 * Make a chat completion request to any AI provider
 * @param {Object} options - Request options
 * @param {string} options.provider - Provider name (ollama, openai, deepseek, huggingface)
 * @param {Array} options.messages - Chat messages
 * @param {Object} options.parameters - Additional parameters
 * @returns {Promise<Object>} Standardized response
 */
async function chatCompletion({ provider, messages, parameters = {} }) {
  if (!provider) {
    provider = aiConfig.getDefaultProvider();
  }

  const config = aiConfig.getProviderConfig(provider);

  // Validate messages
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error('Messages must be a non-empty array');
  }

  // Provider-specific handling
  switch (provider.toLowerCase()) {
    case 'ollama':
      return await handleOllama(config, messages, parameters);
    case 'openai':
      return await handleOpenAI(config, messages, parameters);
    case 'deepseek':
      return await handleDeepSeek(config, messages, parameters);
    case 'huggingface':
      return await handleHuggingFace(config, messages, parameters);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Handle Ollama requests
 */
async function handleOllama(config, messages, parameters) {
  const requestBody = {
    model: config.model,
    messages: messages,
    stream: false,
    options: {
      temperature: parameters.temperature ?? config.parameters.temperature,
      top_p: parameters.top_p ?? config.parameters.top_p,
    },
  };

  try {
    const response = await axios.post(
      `${config.baseUrl}/api/chat`,
      requestBody,
      {
        timeout: config.timeout,
        headers: { 'Content-Type': 'application/json' },
      }
    );

    return {
      choices: [{
        message: {
          role: 'assistant',
          content: response.data.message.content,
        },
      }],
      provider: 'ollama',
      model: config.model
    };
  } catch (error) {
    throw formatError('ollama', error);
  }
}

/**
 * Handle OpenAI requests
 */
async function handleOpenAI(config, messages, parameters) {
  if (!config.apiKey) {
    throw new Error('OpenAI API key is required');
  }

  const requestBody = {
    model: config.model,
    messages: messages,
    temperature: parameters.temperature ?? config.parameters.temperature,
    top_p: parameters.top_p ?? config.parameters.top_p,
    max_tokens: parameters.max_tokens ?? config.parameters.max_tokens,
    stream: false,
    ...parameters
  };

  try {
    const response = await axios.post(
      `${config.baseUrl}/chat/completions`,
      requestBody,
      {
        timeout: config.timeout,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
      }
    );

    return {
      ...response.data,
      provider: 'openai',
      model: config.model
    };
  } catch (error) {
    throw formatError('openai', error);
  }
}

/**
 * Handle DeepSeek requests (V3.1 with think mode support)
 */
async function handleDeepSeek(config, messages, parameters) {
  if (!config.apiKey) {
    throw new Error('DeepSeek API key is required');
  }

  // Ensure base URL has /v1 for OpenAI compatibility
  let baseUrl = config.baseUrl;
  if (!baseUrl.endsWith('/v1') && !baseUrl.includes('/chat/completions')) {
    baseUrl = baseUrl.replace(/\/$/, '') + '/v1';
  }

  // Build request body for V3.1
  const requestBody = {
    model: config.model,
    messages: messages,
    temperature: parameters.temperature ?? config.parameters.temperature,
    top_p: parameters.top_p ?? config.parameters.top_p,
    max_tokens: parameters.max_tokens ?? config.parameters.max_tokens,
    stream: false,
    ...parameters
  };

  try {
    const response = await axios.post(
      `${baseUrl}/chat/completions`,
      requestBody,
      {
        timeout: config.timeout,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
      }
    );

    return {
      ...response.data,
      provider: 'deepseek',
      model: config.model,
      version: '3.1'
    };
  } catch (error) {
    throw formatError('deepseek', error);
  }
}

/**
 * Handle HuggingFace requests
 */
async function handleHuggingFace(config, messages, parameters) {
  // HuggingFace provider logic (simplified)
  const requestBody = {
    model: config.model,
    messages: messages,
    temperature: parameters.temperature ?? config.parameters.temperature,
    top_p: parameters.top_p ?? config.parameters.top_p,
    max_tokens: parameters.max_tokens ?? config.parameters.max_tokens,
    stream: false,
    ...parameters
  };

  const headers = {
    'Content-Type': 'application/json',
  };

  if (config.apiToken) {
    headers.Authorization = `Bearer ${config.apiToken}`;
  }

  try {
    const response = await axios.post(
      `${config.baseUrl}/models/${config.model}`,
      requestBody,
      {
        timeout: config.timeout,
        headers,
      }
    );

    return {
      choices: [{
        message: {
          role: 'assistant',
          content: response.data.generated_text || response.data.content || response.data,
        },
      }],
      provider: 'huggingface',
      model: config.model
    };
  } catch (error) {
    throw formatError('huggingface', error);
  }
}

/**
 * Format errors consistently
 */
function formatError(provider, error) {
  if (error.code === 'ECONNREFUSED') {
    if (provider === 'ollama') {
      return new Error('Ollama server not running. Please start with: ollama serve');
    }
    return new Error(`Unable to connect to ${provider} API. Please check your connection.`);
  }

  if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
    return new Error(`${provider} API request timeout. Please try again.`);
  }

  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;

    switch (status) {
      case 401:
        return new Error(`Invalid ${provider} API key. Please check your credentials.`);
      case 429:
        return new Error(`${provider} API rate limit exceeded. Please try again later.`);
      case 400:
        return new Error(`${provider} API bad request: ${data.error?.message || 'Invalid request'}`);
      case 404:
        return new Error(`${provider} model not found or not accessible.`);
      case 500:
      case 503:
        return new Error(`${provider} API server error. Please try again later.`);
      default:
        return new Error(`${provider} API error (${status}): ${data.error?.message || error.message}`);
    }
  }

  return new Error(`${provider} request failed: ${error.message}`);
}

/**
 * Test if a provider is available
 * @param {string} provider - Provider name
 * @returns {Promise<boolean>} True if available
 */
async function testProvider(provider) {
  try {
    await chatCompletion({
      provider,
      messages: [{ role: 'user', content: 'ping' }],
      parameters: { max_tokens: 1 }
    });
    return true;
  } catch (error) {
    console.warn(`[${provider}] Test failed:`, error.message);
    return false;
  }
}

/**
 * Get available models for a provider
 * @param {string} provider - Provider name
 * @returns {Array} Available models
 */
function getAvailableModels(provider) {
  return aiConfig.getAvailableModels(provider);
}

/**
 * Get current model for a provider
 * @param {string} provider - Provider name
 * @returns {string} Current model
 */
function getCurrentModel(provider) {
  const config = aiConfig.getProviderConfig(provider);
  return config.model;
}

/**
 * Update provider configuration
 * @param {string} provider - Provider name
 * @param {Object} updates - Configuration updates
 */
function updateProviderConfig(provider, updates) {
  aiConfig.updateProviderConfig(provider, updates);
}

module.exports = {
  chatCompletion,
  testProvider,
  getAvailableModels,
  getCurrentModel,
  updateProviderConfig,

  // Re-export config functions
  getDefaultProvider: () => aiConfig.getDefaultProvider(),
  getAllProviders: () => Object.keys(aiConfig.getAllProviderConfigs()),
  getProviderConfig: (provider) => aiConfig.getProviderConfig(provider),
  setDefaultProvider: (provider) => aiConfig.setDefaultProvider(provider),
};