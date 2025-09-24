const axios = require('axios');
const http = require('http');
const https = require('https');
const aiConfig = require('./ai-config');

/**
 * Simplified AI Module
 *
 * Replaces complex provider class hierarchy with simple functions.
 * Most AI providers use OpenAI-compatible APIs, so we can unify them.
 * Optimized for streaming responses with connection pooling for better performance.
 */

// Connection pooling agents for better streaming performance
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 5, // Max concurrent connections per host
  maxFreeSockets: 2, // Keep 2 idle connections ready
  timeout: 60000, // Socket timeout (60s)
  freeSocketTimeout: 30000, // How long to keep idle sockets (30s)
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 5, // Max concurrent connections per host
  maxFreeSockets: 2, // Keep 2 idle connections ready
  timeout: 60000, // Socket timeout (60s)
  freeSocketTimeout: 30000, // How long to keep idle sockets (30s)
});

/**
 * Get appropriate HTTP agent for URL
 * @param {string} url - Request URL
 * @returns {http.Agent|https.Agent} Appropriate pooling agent
 */
function getHttpAgent(url) {
  return url.startsWith('https:') ? httpsAgent : httpAgent;
}

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
async function chatCompletion({
  provider,
  messages,
  parameters = {},
  stream = false,
  onChunk = null,
}) {
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
      // Streaming response with connection pooling
      const response = await axios.post(`${config.baseUrl}/api/chat`, requestBody, {
        timeout: config.timeout,
        headers: { 'Content-Type': 'application/json' },
        responseType: 'stream',
        httpAgent: getHttpAgent(config.baseUrl),
        httpsAgent: getHttpAgent(config.baseUrl),
      });

      let fullContent = '';

      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
          const lines = chunk
            .toString()
            .split('\n')
            .filter((line) => line.trim());

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
                  choices: [
                    {
                      message: {
                        role: 'assistant',
                        content: fullContent,
                      },
                    },
                  ],
                  provider: 'ollama',
                  model: config.model,
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
              choices: [
                {
                  message: {
                    role: 'assistant',
                    content: fullContent,
                  },
                },
              ],
              provider: 'ollama',
              model: config.model,
            });
          }
        });
      });
    } else {
      // Non-streaming response with connection pooling
      const response = await axios.post(`${config.baseUrl}/api/chat`, requestBody, {
        timeout: config.timeout,
        headers: { 'Content-Type': 'application/json' },
        httpAgent: getHttpAgent(config.baseUrl),
        httpsAgent: getHttpAgent(config.baseUrl),
      });

      return {
        choices: [
          {
            message: {
              role: 'assistant',
              content: response.data.message.content,
            },
          },
        ],
        provider: 'ollama',
        model: config.model,
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

  const requestBody = buildOpenAIRequestBody(config, messages, parameters, stream);
  const headers = buildOpenAIHeaders(config.apiKey);

  try {
    if (stream && onChunk) {
      return await handleOpenAIStreaming(config, requestBody, headers, onChunk);
    } else {
      return await handleOpenAINonStreaming(config, requestBody, headers);
    }
  } catch (error) {
    throw formatError('openai', error);
  }
}

/**
 * Build OpenAI request body
 * @private
 */
function buildOpenAIRequestBody(config, messages, parameters, stream) {
  return {
    model: config.model,
    messages: messages,
    temperature: parameters.temperature ?? config.parameters.temperature,
    top_p: parameters.top_p ?? config.parameters.top_p,
    max_tokens: parameters.max_tokens ?? config.parameters.max_tokens,
    stream: stream,
    ...parameters,
  };
}

/**
 * Build OpenAI headers
 * @private
 */
function buildOpenAIHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

/**
 * Handle OpenAI streaming response with connection pooling
 * @private
 */
async function handleOpenAIStreaming(config, requestBody, headers, onChunk) {
  const response = await axios.post(`${config.baseUrl}/chat/completions`, requestBody, {
    timeout: config.timeout,
    headers,
    responseType: 'stream',
    httpAgent: getHttpAgent(config.baseUrl),
    httpsAgent: getHttpAgent(config.baseUrl),
  });

  let fullContent = '';

  return new Promise((resolve, reject) => {
    response.data.on('data', (chunk) => {
      const lines = chunk
        .toString()
        .split('\n')
        .filter((line) => line.trim());

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();

          if (data === '[DONE]') {
            resolve({
              choices: [
                {
                  message: {
                    role: 'assistant',
                    content: fullContent,
                  },
                },
              ],
              provider: 'openai',
              model: config.model,
            });
            return;
          }

          try {
            const parsed = JSON.parse(data);
            if (parsed.choices?.[0]?.delta?.content) {
              const content = parsed.choices[0].delta.content;
              fullContent += content;
              if (onChunk) {
                onChunk(content);
              }
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
          choices: [
            {
              message: {
                role: 'assistant',
                content: fullContent,
              },
            },
          ],
          provider: 'openai',
          model: config.model,
        });
      }
    });
  });
}

/**
 * Handle OpenAI non-streaming response with connection pooling
 * @private
 */
async function handleOpenAINonStreaming(config, requestBody, headers) {
  const response = await axios.post(`${config.baseUrl}/chat/completions`, requestBody, {
    timeout: config.timeout,
    headers,
    httpAgent: getHttpAgent(config.baseUrl),
    httpsAgent: getHttpAgent(config.baseUrl),
  });

  return {
    ...response.data,
    provider: 'openai',
    model: config.model,
  };
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
    ...parameters,
  };

  try {
    if (stream && onChunk) {
      // Streaming response with connection pooling
      const response = await axios.post(`${baseUrl}/chat/completions`, requestBody, {
        timeout: config.timeout,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        responseType: 'stream',
        httpAgent: getHttpAgent(baseUrl),
        httpsAgent: getHttpAgent(baseUrl),
      });

      let fullContent = '';

      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
          const lines = chunk
            .toString()
            .split('\n')
            .filter((line) => line.trim());

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();

              if (data === '[DONE]') {
                resolve({
                  choices: [
                    {
                      message: {
                        role: 'assistant',
                        content: fullContent,
                      },
                    },
                  ],
                  provider: 'deepseek',
                  model: config.model,
                  version: '3.1',
                });
                return;
              }

              try {
                const parsed = JSON.parse(data);
                if (
                  parsed.choices &&
                  parsed.choices[0] &&
                  parsed.choices[0].delta &&
                  parsed.choices[0].delta.content
                ) {
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
              choices: [
                {
                  message: {
                    role: 'assistant',
                    content: fullContent,
                  },
                },
              ],
              provider: 'deepseek',
              model: config.model,
              version: '3.1',
            });
          }
        });
      });
    } else {
      // Non-streaming response with connection pooling
      const response = await axios.post(`${baseUrl}/chat/completions`, requestBody, {
        timeout: config.timeout,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        httpAgent: getHttpAgent(baseUrl),
        httpsAgent: getHttpAgent(baseUrl),
      });

      return {
        ...response.data,
        provider: 'deepseek',
        model: config.model,
        version: '3.1',
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
    ...parameters,
  };

  const headers = {
    'Content-Type': 'application/json',
  };

  if (config.apiToken) {
    headers.Authorization = `Bearer ${config.apiToken}`;
  }

  try {
    // Note: HuggingFace streaming implementation would depend on the specific provider
    // For now, we'll implement basic streaming support with connection pooling
    const response = await axios.post(`${config.baseUrl}/models/${config.model}`, requestBody, {
      timeout: config.timeout,
      headers,
      responseType: stream && onChunk ? 'stream' : 'json',
      httpAgent: getHttpAgent(config.baseUrl),
      httpsAgent: getHttpAgent(config.baseUrl),
    });

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
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: fullContent,
                },
              },
            ],
            provider: 'huggingface',
            model: config.model,
          });
        });
      });
    } else {
      return {
        choices: [
          {
            message: {
              role: 'assistant',
              content: response.data.generated_text || response.data.content || response.data,
            },
          },
        ],
        provider: 'huggingface',
        model: config.model,
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
        return new Error(
          `${provider} API bad request: ${data.error?.message || 'Invalid request'}`
        );
      case 404:
        return new Error(`${provider} model not found or not accessible.`);
      case 500:
      case 503:
        return new Error(`${provider} API server error. Please try again later.`);
      default:
        return new Error(
          `${provider} API error (${status}): ${data.error?.message || error.message}`
        );
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
      parameters: { max_tokens: 1 },
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

/**
 * Get connection pool statistics
 * @returns {Object} Pool stats for monitoring
 */
function getConnectionPoolStats() {
  return {
    http: {
      maxSockets: httpAgent.maxSockets,
      maxFreeSockets: httpAgent.maxFreeSockets,
      sockets: httpAgent.sockets ? Object.keys(httpAgent.sockets).length : 0,
      freeSockets: httpAgent.freeSockets ? Object.keys(httpAgent.freeSockets).length : 0,
      timeout: 60000, // Static value since agent.timeout might be undefined
      freeSocketTimeout: 30000, // Static value since agent.freeSocketTimeout might be undefined
    },
    https: {
      maxSockets: httpsAgent.maxSockets,
      maxFreeSockets: httpsAgent.maxFreeSockets,
      sockets: httpsAgent.sockets ? Object.keys(httpsAgent.sockets).length : 0,
      freeSockets: httpsAgent.freeSockets ? Object.keys(httpsAgent.freeSockets).length : 0,
      timeout: 60000, // Static value since agent.timeout might be undefined
      freeSocketTimeout: 30000, // Static value since agent.freeSocketTimeout might be undefined
    },
  };
}

/**
 * Close all pooled connections (useful for cleanup)
 */
function closeAllConnections() {
  httpAgent.destroy();
  httpsAgent.destroy();
  console.log('[SimpleAI] All connection pools closed');
}

module.exports = {
  chatCompletion,
  testProvider,
  getAvailableModels,
  getCurrentModel,
  updateProviderConfig,
  getConnectionPoolStats,
  closeAllConnections,

  // Re-export config functions
  getDefaultProvider: () => aiConfig.getDefaultProvider(),
  getAllProviders: () => Object.keys(aiConfig.getAllProviderConfigs()),
  getProviderConfig: (provider) => aiConfig.getProviderConfig(provider),
  setDefaultProvider: (provider) => aiConfig.setDefaultProvider(provider),
};
