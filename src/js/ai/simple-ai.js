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
 * @param {boolean} options.stream - Enable streaming responses
 * @param {Function} options.onChunk - Callback for streaming chunks
 * @returns {Promise<Object>} Standardized response
 */
async function chatCompletion({ provider, messages, parameters = {}, stream = false, onChunk = null }) {
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
      return await handleOllama(config, messages, parameters, stream, onChunk);
    case 'openai':
      return await handleOpenAI(config, messages, parameters, stream, onChunk);
    case 'deepseek':
      return await handleDeepSeek(config, messages, parameters, stream, onChunk);
    case 'huggingface':
      return await handleHuggingFace(config, messages, parameters, stream, onChunk);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Handle Ollama requests
 */
async function handleOllama(config, messages, parameters, stream = false, onChunk = null) {
  const requestBody = {
    model: config.model,
    messages: messages,
    stream: stream,
    options: {
      temperature: parameters.temperature ?? config.parameters.temperature,
      top_p: parameters.top_p ?? config.parameters.top_p,
    },
  };

  try {
    if (stream && onChunk) {
      // Streaming response
      const response = await axios.post(
        `${config.baseUrl}/api/chat`,
        requestBody,
        {
          timeout: config.timeout,
          headers: { 'Content-Type': 'application/json' },
          responseType: 'stream',
        }
      );

      let fullContent = '';

      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
          const lines = chunk.toString().split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.message && data.message.content) {
                const content = data.message.content;
                fullContent += content;
                onChunk(content);
              }

              if (data.done) {
                resolve({
                  choices: [{
                    message: {
                      role: 'assistant',
                      content: fullContent,
                    },
                  }],
                  provider: 'ollama',
                  model: config.model
                });
              }
            } catch (parseError) {
              // Ignore parsing errors for partial chunks
            }
          }
        });

        response.data.on('error', (error) => {
          reject(formatError('ollama', error));
        });

        response.data.on('end', () => {
          if (fullContent) {
            resolve({
              choices: [{
                message: {
                  role: 'assistant',
                  content: fullContent,
                },
              }],
              provider: 'ollama',
              model: config.model
            });
          }
        });
      });
    } else {
      // Non-streaming response
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
    }
  } catch (error) {
    throw formatError('ollama', error);
  }
}

/**
 * Handle OpenAI requests
 */
async function handleOpenAI(config, messages, parameters, stream = false, onChunk = null) {
  if (!config.apiKey) {
    throw new Error('OpenAI API key is required');
  }

  const requestBody = {
    model: config.model,
    messages: messages,
    temperature: parameters.temperature ?? config.parameters.temperature,
    top_p: parameters.top_p ?? config.parameters.top_p,
    max_tokens: parameters.max_tokens ?? config.parameters.max_tokens,
    stream: stream,
    ...parameters
  };

  try {
    if (stream && onChunk) {
      // Streaming response
      const response = await axios.post(
        `${config.baseUrl}/chat/completions`,
        requestBody,
        {
          timeout: config.timeout,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
          },
          responseType: 'stream',
        }
      );

      let fullContent = '';

      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
          const lines = chunk.toString().split('\n').filter(line => line.trim());

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();

              if (data === '[DONE]') {
                resolve({
                  choices: [{
                    message: {
                      role: 'assistant',
                      content: fullContent,
                    },
                  }],
                  provider: 'openai',
                  model: config.model
                });
                return;
              }

              try {
                const parsed = JSON.parse(data);
                if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                  const content = parsed.choices[0].delta.content;
                  fullContent += content;
                  onChunk(content);
                }
              } catch (parseError) {
                // Ignore parsing errors for partial chunks
              }
            }
          }
        });

        response.data.on('error', (error) => {
          reject(formatError('openai', error));
        });

        response.data.on('end', () => {
          if (fullContent) {
            resolve({
              choices: [{
                message: {
                  role: 'assistant',
                  content: fullContent,
                },
              }],
              provider: 'openai',
              model: config.model
            });
          }
        });
      });
    } else {
      // Non-streaming response
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
    }
  } catch (error) {
    throw formatError('openai', error);
  }
}

/**
 * Handle DeepSeek requests (V3.1 with think mode support)
 */
async function handleDeepSeek(config, messages, parameters, stream = false, onChunk = null) {
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
    stream: stream,
    ...parameters
  };

  try {
    if (stream && onChunk) {
      // Streaming response
      const response = await axios.post(
        `${baseUrl}/chat/completions`,
        requestBody,
        {
          timeout: config.timeout,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
          },
          responseType: 'stream',
        }
      );

      let fullContent = '';

      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
          const lines = chunk.toString().split('\n').filter(line => line.trim());

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();

              if (data === '[DONE]') {
                resolve({
                  choices: [{
                    message: {
                      role: 'assistant',
                      content: fullContent,
                    },
                  }],
                  provider: 'deepseek',
                  model: config.model,
                  version: '3.1'
                });
                return;
              }

              try {
                const parsed = JSON.parse(data);
                if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                  const content = parsed.choices[0].delta.content;
                  fullContent += content;
                  onChunk(content);
                }
              } catch (parseError) {
                // Ignore parsing errors for partial chunks
              }
            }
          }
        });

        response.data.on('error', (error) => {
          reject(formatError('deepseek', error));
        });

        response.data.on('end', () => {
          if (fullContent) {
            resolve({
              choices: [{
                message: {
                  role: 'assistant',
                  content: fullContent,
                },
              }],
              provider: 'deepseek',
              model: config.model,
              version: '3.1'
            });
          }
        });
      });
    } else {
      // Non-streaming response
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
    }
  } catch (error) {
    throw formatError('deepseek', error);
  }
}

/**
 * Handle HuggingFace requests
 */
async function handleHuggingFace(config, messages, parameters, stream = false, onChunk = null) {
  // HuggingFace provider logic (simplified)
  const requestBody = {
    model: config.model,
    messages: messages,
    temperature: parameters.temperature ?? config.parameters.temperature,
    top_p: parameters.top_p ?? config.parameters.top_p,
    max_tokens: parameters.max_tokens ?? config.parameters.max_tokens,
    stream: stream,
    ...parameters
  };

  const headers = {
    'Content-Type': 'application/json',
  };

  if (config.apiToken) {
    headers.Authorization = `Bearer ${config.apiToken}`;
  }

  try {
    // Note: HuggingFace streaming implementation would depend on the specific provider
    // For now, we'll implement basic streaming support
    const response = await axios.post(
      `${config.baseUrl}/models/${config.model}`,
      requestBody,
      {
        timeout: config.timeout,
        headers,
        responseType: stream && onChunk ? 'stream' : 'json',
      }
    );

    if (stream && onChunk) {
      // Basic streaming for HuggingFace (implementation varies by provider)
      let fullContent = '';

      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
          try {
            const content = chunk.toString();
            fullContent += content;
            onChunk(content);
          } catch (error) {
            // Handle chunk processing errors
          }
        });

        response.data.on('error', (error) => {
          reject(formatError('huggingface', error));
        });

        response.data.on('end', () => {
          resolve({
            choices: [{
              message: {
                role: 'assistant',
                content: fullContent,
              },
            }],
            provider: 'huggingface',
            model: config.model
          });
        });
      });
    } else {
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
    }
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