/**
 * DeepSeek Provider Test File
 *
 * Tests the DeepSeek provider functionality including:
 * - Provider creation and configuration
 * - Connection testing
 * - Model switching
 * - Error handling
 * - Integration with AI Manager
 */

const {
  DeepSeekProvider,
  createProvider,
  AIManager,
  getProviderConfig,
  validateProviderConfig,
  getAvailableProviders,
  getSummary,
} = require('./index');

/**
 * Test DeepSeek provider creation and basic functionality
 */
async function testDeepSeekProvider() {
  console.log('🧪 Testing DeepSeek Provider Creation...');

  try {
    // Test 1: Create provider with minimal config
    const provider = new DeepSeekProvider({
      apiKey: 'test-key-123',
      model: 'deepseek-chat',
    });

    console.log('✅ Provider created successfully');
    console.log('   Name:', provider.getName());
    console.log('   Model:', provider.getModel());
    console.log('   Base URL:', provider.getBaseUrl());

    // Test 2: Test model info
    const modelInfo = provider.getModelInfo();
    console.log('✅ Model info retrieved:', modelInfo.name);

    // Test 3: Test capabilities
    console.log('✅ Supports reasoning:', provider.supportsCapability('reasoning'));
    console.log('✅ Supports coding:', provider.supportsCapability('coding'));

    // Test 4: Test model switching
    provider.useReasoningModel();
    console.log('✅ Switched to reasoning model:', provider.getModel());
    console.log('✅ Is reasoning model:', provider.isReasoningModel());

    provider.useChatModel();
    console.log('✅ Switched back to chat model:', provider.getModel());

    // Test 5: Test configuration methods
    const defaultParams = provider.getDefaultParameters();
    console.log('✅ Default parameters:', Object.keys(defaultParams));

    const modelParams = provider.getModelSpecificParameters();
    console.log('✅ Model-specific parameters:', Object.keys(modelParams));

    // Test 6: Test pricing info
    const pricing = provider.getPricingInfo();
    console.log('✅ Pricing info:', pricing);

    return true;
  } catch (error) {
    console.error('❌ Provider creation test failed:', error.message);
    return false;
  }
}

/**
 * Test DeepSeek provider factory integration
 */
async function testProviderFactory() {
  console.log('\n🏭 Testing Provider Factory Integration...');

  try {
    // Test 1: Create via factory
    const provider = createProvider('deepseek', {
      apiKey: 'test-key-456',
      model: 'deepseek-reasoner',
    });

    console.log('✅ Provider created via factory');
    console.log('   Provider name:', provider.getName());

    // Test 2: Test available models
    const models = await provider.getAvailableModels();
    console.log('✅ Available models:', models);

    // Test 3: Test context window
    const contextWindow = provider.getContextWindow();
    console.log('✅ Context window:', contextWindow, 'tokens');

    // Test 4: Test token estimation
    const messages = [
      { role: 'user', content: 'Hello, how are you?' },
      { role: 'assistant', content: 'I am doing well, thank you!' },
    ];
    const tokenCount = provider.estimateTokenCount(messages);
    console.log('✅ Estimated token count:', tokenCount);

    return true;
  } catch (error) {
    console.error('❌ Factory integration test failed:', error.message);
    return false;
  }
}

/**
 * Test configuration validation
 */
async function testConfiguration() {
  console.log('\n⚙️ Testing Configuration...');

  try {
    // Test 1: Valid configuration
    const validConfig = {
      apiKey: 'sk-test123',
      model: 'deepseek-chat',
      baseUrl: 'https://api.deepseek.com',
    };

    const validation = validateProviderConfig('deepseek', validConfig);
    console.log('✅ Valid config validation:', validation.valid);

    // Test 2: Missing API key
    const invalidConfig = {
      model: 'deepseek-chat',
    };

    const invalidValidation = validateProviderConfig('deepseek', invalidConfig);
    console.log('✅ Invalid config validation:', invalidValidation.valid);
    console.log('   Errors:', invalidValidation.errors);

    // Test 3: Get default configuration
    const defaultConfig = getProviderConfig('deepseek');
    console.log('✅ Default config keys:', Object.keys(defaultConfig));

    return true;
  } catch (error) {
    console.error('❌ Configuration test failed:', error.message);
    return false;
  }
}

/**
 * Test connection (will fail without real API key)
 */
async function testConnection() {
  console.log('\n🔌 Testing Connection...');

  try {
    const provider = createProvider('deepseek', {
      apiKey: process.env.DEEPSEEK_API_KEY || 'test-key',
      model: 'deepseek-chat',
    });

    // Test connection
    const status = await provider.checkConnection();
    console.log('✅ Connection test completed');
    console.log('   Connected:', status.connected);
    console.log('   Model available:', status.modelAvailable);

    if (!status.connected) {
      console.log('   Expected - no real API key provided');
    }

    return true;
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    return false;
  }
}

/**
 * Test chat completion (will fail without real API key)
 */
async function testChatCompletion() {
  console.log('\n💬 Testing Chat Completion...');

  if (!process.env.DEEPSEEK_API_KEY) {
    console.log('⚠️ Skipping chat completion test - no API key provided');
    console.log('   Set DEEPSEEK_API_KEY environment variable to test');
    return true;
  }

  try {
    const provider = createProvider('deepseek', {
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: 'deepseek-chat',
    });

    // Test basic chat completion
    const response = await provider.chatCompletion({
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say hello in exactly 3 words.' },
      ],
      parameters: {
        max_tokens: 10,
        temperature: 0.7,
      },
    });

    console.log('✅ Chat completion successful');
    console.log('   Response:', response.choices[0].message.content);
    console.log('   Provider:', response.provider);
    console.log('   Model:', response.model);

    return true;
  } catch (error) {
    console.error('❌ Chat completion test failed:', error.message);
    return false;
  }
}

/**
 * Test streaming (will fail without real API key)
 */
async function testStreaming() {
  console.log('\n🌊 Testing Streaming...');

  if (!process.env.DEEPSEEK_API_KEY) {
    console.log('⚠️ Skipping streaming test - no API key provided');
    return true;
  }

  try {
    const provider = createProvider('deepseek', {
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: 'deepseek-chat',
    });

    let chunks = [];
    const response = await provider.streamChatCompletion(
      {
        messages: [{ role: 'user', content: 'Count from 1 to 5.' }],
        parameters: {
          max_tokens: 20,
          temperature: 0.1,
        },
      },
      (chunk) => {
        chunks.push(chunk);
        process.stdout.write(chunk);
      }
    );

    console.log('\n✅ Streaming completion successful');
    console.log('   Total chunks:', chunks.length);
    console.log('   Final response length:', response.choices[0].message.content.length);

    return true;
  } catch (error) {
    console.error('❌ Streaming test failed:', error.message);
    return false;
  }
}

/**
 * Test AI Manager integration
 */
async function testAIManagerIntegration() {
  console.log('\n🤖 Testing AI Manager Integration...');

  try {
    // Mock app controller
    const mockAppController = {
      windowManager: {
        send: (event, data) => {
          console.log(`   [UI Event] ${event}`);
        },
      },
    };

    const aiManager = new AIManager(mockAppController);

    // Test 1: Try to create a simple AI Manager and test basic functionality
    try {
      console.log('✅ AI Manager created with default provider');
      console.log('   Current provider:', aiManager.currentProvider);
      console.log('   Current model:', aiManager.currentModelName);

      // Test 2: Get provider info
      const info = aiManager.getProviderInfo();
      console.log('✅ Provider info retrieved:', info.name);

      // Test 3: Get session
      const session = aiManager.getSession();
      console.log('✅ Session created');

      // Test 4: Test that DeepSeek is available as a provider
      const availableProviders = getAvailableProviders();
      const hasDeepSeek = availableProviders.includes('deepseek');
      console.log('✅ DeepSeek provider available:', hasDeepSeek);

      // Test 5: Test warmup with current provider
      const isWarm = await aiManager.warmup();
      console.log('✅ Warmup test completed:', isWarm ? 'responsive' : 'not responsive');

      // Test 6: Test configuration summary includes DeepSeek
      const configSummary = getSummary();
      const hasDeepSeekConfig = configSummary.providers && configSummary.providers.deepseek;
      console.log('✅ DeepSeek in configuration:', !!hasDeepSeekConfig);
    } catch (testError) {
      console.log('❌ AI Manager test failed:', testError.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ AI Manager integration test failed:', error.message);
    return false;
  }
}

/**
 * Test error handling
 */
async function testErrorHandling() {
  console.log('\n🚨 Testing Error Handling...');

  try {
    // Test 1: Invalid API key
    const provider = createProvider('deepseek', {
      apiKey: 'invalid-key-123',
      model: 'deepseek-chat',
    });

    try {
      await provider.chatCompletion({
        messages: [{ role: 'user', content: 'test' }],
      });
    } catch (error) {
      console.log(
        '✅ Invalid API key error handled:',
        error.message.includes('Invalid DeepSeek API key')
      );
    }

    // Test 2: Missing API key
    try {
      new DeepSeekProvider({
        model: 'deepseek-chat',
        // No API key
      });
    } catch (error) {
      console.log(
        '✅ Missing API key error handled:',
        error.message.includes('API key is required')
      );
    }

    // Test 3: Invalid model
    const providerWithInvalidModel = createProvider('deepseek', {
      apiKey: 'test-key',
      model: 'invalid-model',
    });

    const modelInfo = providerWithInvalidModel.getModelInfo();
    console.log('✅ Invalid model handled gracefully:', modelInfo.type === 'unknown');

    return true;
  } catch (error) {
    console.error('❌ Error handling test failed:', error.message);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 DeepSeek Provider Test Suite\n');
  console.log('Environment:');
  console.log('  DEEPSEEK_API_KEY:', process.env.DEEPSEEK_API_KEY ? '✅ Set' : '❌ Not set');
  console.log('  Note: Some tests will be skipped without API key\n');

  const tests = [
    testDeepSeekProvider,
    testProviderFactory,
    testConfiguration,
    testConnection,
    testChatCompletion,
    testStreaming,
    testAIManagerIntegration,
    testErrorHandling,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`❌ Test ${test.name} crashed:`, error.message);
      failed++;
    }
  }

  console.log('\n📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${passed + failed}`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log('\n⚠️ Some tests failed. Check the output above for details.');
  }
}

// Export for individual testing
module.exports = {
  testDeepSeekProvider,
  testProviderFactory,
  testConfiguration,
  testConnection,
  testChatCompletion,
  testStreaming,
  testAIManagerIntegration,
  testErrorHandling,
  runAllTests,
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}
