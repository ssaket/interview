/**
 * AI System Usage Examples
 *
 * This file demonstrates how to use the new object-oriented AI system
 * with multiple providers, configuration management, and advanced features.
 */

// Import the new AI system components
const {
  AIManager,
  createProvider,
  createProviderWithEnvConfig,
  getAvailableProviders,
  OllamaProvider,
  OpenAIProvider,
  HuggingFaceProvider,
  DeepSeekProvider,
  aiConfig,
  getProviderConfig,
  validateConfig,
} = require('./index');

/**
 * Example 1: Basic Usage with AI Manager
 * This is the simplest way to use the system - similar to the old interface
 */
async function basicUsageExample(appController) {
  console.log('=== Basic Usage Example ===');

  // Create AI Manager (just like before)
  const aiManager = new AIManager(appController);

  // Ask a question (same as before)
  try {
    const response = await aiManager.ask('What is JavaScript?');
    console.log('Response:', response);
  } catch (error) {
    console.error('Error:', error.message);
  }

  // Switch providers (enhanced - now supports specific provider names)
  try {
    await aiManager.switchToProvider('openai');
    console.log('Switched to OpenAI');

    const response = await aiManager.ask('Explain async/await in JavaScript');
    console.log('OpenAI Response:', response);
  } catch (error) {
    console.error('OpenAI Error:', error.message);
  }
}

/**
 * Example 2: Using Provider Factory Directly
 * This gives you more control over provider creation and configuration
 */
async function providerFactoryExample() {
  console.log('=== Provider Factory Example ===');

  // Create providers with custom configuration
  const ollamaProvider = createProvider('ollama', {
    model: 'phi3:mini',
    baseUrl: 'http://localhost:11434',
    timeout: 60000,
  });

  const openaiProvider = createProvider('openai', {
    model: 'gpt-4',
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 30000,
  });

  // Test providers
  console.log('Testing Ollama provider...');
  const ollamaOnline = await ollamaProvider.warmup();
  console.log('Ollama online:', ollamaOnline);

  if (ollamaOnline) {
    const response = await ollamaProvider.chatCompletion({
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'What is Node.js?' },
      ],
    });
    console.log('Ollama response:', response.choices[0].message.content);
  }

  // Create provider from environment config
  try {
    const hfProvider = createProviderWithEnvConfig('huggingface');
    console.log('HuggingFace provider created with env config');
  } catch (error) {
    console.log('HuggingFace provider creation failed:', error.message);
  }
}

/**
 * Example 3: Multi-Provider Setup
 * Use multiple providers simultaneously for different tasks
 */
async function multiProviderExample(appController) {
  console.log('=== Multi-Provider Example ===');

  // Create multiple AI managers for different purposes
  const codeAssistant = new AIManager(appController);
  const chatAssistant = new AIManager(appController);
  const reasoningAssistant = new AIManager(appController);

  // Configure each for different use cases
  try {
    await codeAssistant.switchToProvider('ollama', { model: 'codellama:7b-instruct' });
    await chatAssistant.switchToProvider('openai', { model: 'gpt-3.5-turbo' });
    await reasoningAssistant.switchToProvider('deepseek', { model: 'deepseek-reasoner' });

    // Use them for different types of questions
    const codeQuestion = 'Write a function to sort an array in JavaScript';
    const chatQuestion = 'What is the weather like today?';
    const reasoningQuestion = 'Explain the philosophy behind functional programming';

    // Run questions in parallel
    const [codeResponse, chatResponse, reasoningResponse] = await Promise.allSettled([
      codeAssistant.ask(codeQuestion),
      chatAssistant.ask(chatQuestion),
      reasoningAssistant.ask(reasoningQuestion),
    ]);

    console.log(
      'Code Assistant:',
      codeResponse.status === 'fulfilled' ? codeResponse.value : codeResponse.reason
    );
    console.log(
      'Chat Assistant:',
      chatResponse.status === 'fulfilled' ? chatResponse.value : chatResponse.reason
    );
    console.log(
      'Reasoning Assistant:',
      reasoningResponse.status === 'fulfilled' ? reasoningResponse.value : reasoningResponse.reason
    );
  } catch (error) {
    console.error('Multi-provider setup error:', error.message);
  }
}

/**
 * Example 4: DeepSeek Provider Usage
 * Shows how to use DeepSeek with both chat and reasoning models
 */
async function deepSeekExample(appController) {
  console.log('=== DeepSeek Provider Example ===');

  // Create DeepSeek provider directly
  try {
    const deepSeekProvider = createProvider('deepseek', {
      model: 'deepseek-chat',
      apiKey: process.env.DEEPSEEK_API_KEY || 'your-api-key-here',
    });

    console.log('DeepSeek provider created:', deepSeekProvider.getName());
    console.log('Model info:', deepSeekProvider.getModelInfo());

    // Test connectivity (will fail without real API key)
    const connectionStatus = await deepSeekProvider.checkConnection();
    console.log('Connection status:', connectionStatus);

    // Example with AI Manager
    const aiManager = new AIManager(appController);

    // Use DeepSeek chat model
    await aiManager.switchToProvider('deepseek', {
      model: 'deepseek-chat',
      apiKey: process.env.DEEPSEEK_API_KEY,
    });

    console.log('Switched to DeepSeek chat model');

    // Example questions for chat model
    if (process.env.DEEPSEEK_API_KEY) {
      try {
        const chatResponse = await aiManager.ask(
          'Explain what makes DeepSeek different from other AI models'
        );
        console.log('Chat response:', chatResponse.substring(0, 100) + '...');
      } catch (error) {
        console.log('Chat request failed:', error.message);
      }
    }

    // Switch to reasoning model
    await aiManager.switchToProvider('deepseek', {
      model: 'deepseek-reasoner',
      apiKey: process.env.DEEPSEEK_API_KEY,
    });

    console.log('Switched to DeepSeek reasoning model');

    if (process.env.DEEPSEEK_API_KEY) {
      try {
        const reasoningResponse = await aiManager.ask(
          'Solve this step by step: If a train travels 120 km in 2 hours, then stops for 30 minutes, then travels another 90 km in 1.5 hours, what is the average speed for the entire journey?'
        );
        console.log('Reasoning response:', reasoningResponse.substring(0, 100) + '...');
      } catch (error) {
        console.log('Reasoning request failed:', error.message);
      }
    }

    // Show model capabilities
    console.log('Chat model supports reasoning:', deepSeekProvider.supportsCapability('reasoning'));
    deepSeekProvider.useReasoningModel();
    console.log(
      'Reasoning model supports reasoning:',
      deepSeekProvider.supportsCapability('reasoning')
    );
    console.log('Is reasoning model:', deepSeekProvider.isReasoningModel());

    // Show pricing info
    console.log('Pricing info:', deepSeekProvider.getPricingInfo());
  } catch (error) {
    console.error('DeepSeek example error:', error.message);
  }
}

/**
 * Example 5: Custom Provider Implementation
 * Shows how to create and register a custom provider
 */
class CustomAIProvider extends require('./providers/base-provider') {
  constructor(config = {}) {
    super({
      name: 'custom',
      model: config.model || 'custom-model',
      ...config,
    });
    this.apiEndpoint = config.apiEndpoint || 'http://localhost:8080/api/chat';
  }

  async chatCompletion(options) {
    this._validateChatOptions(options);

    const { messages } = options;

    // Custom implementation - could be any API
    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          model: this.model,
          temperature: 0.7,
        }),
      });

      const data = await response.json();

      return {
        choices: [
          {
            message: {
              role: 'assistant',
              content: data.response || 'Custom provider response',
            },
          },
        ],
        provider: this.name,
        model: this.model,
      };
    } catch (error) {
      this._handleError(error, 'chat completion');
    }
  }
}

async function customProviderExample() {
  console.log('=== Custom Provider Example ===');

  // Register the custom provider
  const { registerProvider } = require('./provider-factory');
  registerProvider('custom', CustomAIProvider);

  // Now you can use it like any other provider
  try {
    const customProvider = createProvider('custom', {
      model: 'my-custom-model',
      apiEndpoint: 'http://localhost:8080/api/chat',
    });

    console.log('Custom provider created:', customProvider.getName());

    // Test it (will fail unless you have the endpoint running)
    // const response = await customProvider.chatCompletion({
    //   messages: [{ role: 'user', content: 'Hello custom provider!' }]
    // });
    // console.log('Custom response:', response);
  } catch (error) {
    console.log('Custom provider error (expected):', error.message);
  }
}

/**
 * Example 5: Configuration Management
 * Shows how to manage configurations across providers
 */
async function configurationExample() {
  console.log('=== Configuration Management Example ===');

  // Get configuration summary
  const summary = aiConfig.getSummary();
  console.log('Configuration Summary:', JSON.stringify(summary, null, 2));

  // Validate configurations
  const providers = ['ollama', 'openai', 'huggingface', 'deepseek'];

  for (const provider of providers) {
    const config = getProviderConfig(provider);
    const validation = validateConfig(provider, config);

    console.log(`${provider.toUpperCase()} Config:`, {
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
    });
  }

  // Set custom configuration
  aiConfig.setProviderConfig('ollama', {
    model: 'custom-phi3',
    timeout: 120000,
    parameters: {
      temperature: 0.5,
      top_p: 0.8,
    },
  });

  console.log('Updated Ollama config:', getProviderConfig('ollama'));

  // Create preset configurations
  aiConfig.createPreset('development', {
    ollama: { model: 'phi3:mini', timeout: 30000 },
    openai: { model: 'gpt-3.5-turbo', timeout: 15000 },
    deepseek: { model: 'deepseek-chat', timeout: 20000 },
  });

  console.log('Created development preset');
}

/**
 * Example 6: Streaming Responses
 * Shows how to use streaming for real-time responses
 */
async function streamingExample(appController) {
  console.log('=== Streaming Example ===');

  const aiManager = new AIManager(appController);

  try {
    // Switch to a provider that supports streaming (DeepSeek or OpenAI)
    await aiManager.switchToProvider('deepseek');

    console.log('Starting streaming response...');

    let fullResponse = '';
    const response = await aiManager.askStream(
      'Write a short story about a robot learning to paint',
      (chunk) => {
        process.stdout.write(chunk); // Stream output to console
        fullResponse += chunk;
      }
    );

    console.log('\n\nFull response received:', fullResponse === response);
  } catch (error) {
    console.error('Streaming error:', error.message);

    // Fallback to regular response
    console.log('Falling back to regular response...');
    const response = await aiManager.ask('Write a short story about a robot learning to paint');
    console.log('Fallback response:', response.substring(0, 100) + '...');
  }
}

/**
 * Example 7: Error Handling and Fallbacks
 * Shows robust error handling with multiple providers
 */
async function errorHandlingExample(appController) {
  console.log('=== Error Handling Example ===');

  const aiManager = new AIManager(appController);
  const availableProviders = getAvailableProviders();

  const question = 'What is the meaning of life?';
  let response = null;

  // Try each provider until one works
  for (const provider of availableProviders) {
    try {
      console.log(`Trying ${provider}...`);
      await aiManager.switchToProvider(provider);

      // Test if provider is responsive
      const isOnline = await aiManager.warmup();
      if (!isOnline) {
        console.log(`${provider} is not responsive`);
        continue;
      }

      response = await aiManager.ask(question);
      console.log(`Success with ${provider}:`, response.substring(0, 100) + '...');
      break;
    } catch (error) {
      console.log(`${provider} failed:`, error.message);
      continue;
    }
  }

  if (!response) {
    console.log('All providers failed');
  }
}

/**
 * Example 8: Session Management
 * Shows how to manage conversation sessions
 */
async function sessionManagementExample(appController) {
  console.log('=== Session Management Example ===');

  const aiManager = new AIManager(appController);

  // Start a conversation
  console.log('Starting conversation...');
  await aiManager.ask('My name is Alice. Remember this.');

  // Continue conversation
  const response1 = await aiManager.ask('What is my name?');
  console.log('Response 1:', response1);

  // Check session stats
  const stats = aiManager.getSessionStats();
  console.log('Session stats:', stats);

  // Switch provider but keep session
  const originalProvider = aiManager.currentProvider;
  try {
    await aiManager.switchToProvider('openai');
  } catch (error) {
    console.log('Could not switch to OpenAI, staying with', originalProvider);
  }

  // Ask again (new session with new provider)
  const response2 = await aiManager.ask('What is my name?');
  console.log('Response 2 (new session):', response2);

  // Clear session
  aiManager.clearSession();
  console.log('Session cleared');

  // Ask again (should not remember)
  const response3 = await aiManager.ask('What is my name?');
  console.log('Response 3 (after clear):', response3);
}

/**
 * Main example runner
 */
async function runAllExamples() {
  console.log('Running AI System Examples...\n');

  // Mock app controller for examples
  const mockAppController = {
    windowManager: {
      send: (event, data) => console.log(`[UI Event] ${event}:`, data),
    },
  };

  try {
    await basicUsageExample(mockAppController);
    console.log('\n' + '='.repeat(50) + '\n');

    await providerFactoryExample();
    console.log('\n' + '='.repeat(50) + '\n');

    await multiProviderExample(mockAppController);
    console.log('\n' + '='.repeat(50) + '\n');

    await deepSeekExample(mockAppController);
    console.log('\n' + '='.repeat(50) + '\n');

    await customProviderExample();
    console.log('\n' + '='.repeat(50) + '\n');

    await configurationExample();
    console.log('\n' + '='.repeat(50) + '\n');

    await streamingExample(mockAppController);
    console.log('\n' + '='.repeat(50) + '\n');

    await errorHandlingExample(mockAppController);
    console.log('\n' + '='.repeat(50) + '\n');

    await sessionManagementExample(mockAppController);
  } catch (error) {
    console.error('Example error:', error);
  }
}

// Export examples for individual testing
module.exports = {
  basicUsageExample,
  providerFactoryExample,
  multiProviderExample,
  deepSeekExample,
  customProviderExample,
  configurationExample,
  streamingExample,
  errorHandlingExample,
  sessionManagementExample,
  runAllExamples,
  CustomAIProvider,
};

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}
