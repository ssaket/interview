# AI System Migration Guide

## Overview

The AI Manager has been completely refactored to use a modern, object-oriented architecture with design patterns that make it easier to add new AI providers and maintain the codebase. This guide will help you understand the changes and migrate your code if needed.

## What Changed

### Before (Old System)
- Monolithic `ai-manager.js` with hardcoded provider logic
- Direct instantiation of `OllamaClient` and `InferenceClient`
- Mixed concerns: session management, caching, and provider communication in one class
- Difficult to add new providers
- Limited configuration options

### After (New System)
- **Strategy Pattern**: Pluggable AI providers with consistent interface
- **Factory Pattern**: Easy creation of provider instances
- **Separation of Concerns**: Dedicated classes for configuration, providers, and session management
- **Extensibility**: Easy to add new providers (OpenAI, Claude, etc.)
- **Configuration Management**: Centralized configuration with environment support

## Architecture Overview

```
ai/
├── index.js                 # Main export point
├── ai-manager.js            # New AI Manager using Strategy pattern
├── ai-config.js             # Configuration management
├── provider-factory.js      # Factory for creating providers
├── providers/
│   ├── base-provider.js     # Abstract base class for all providers
│   ├── ollama-provider.js   # Ollama implementation
│   ├── openai-provider.js   # OpenAI implementation
│   └── huggingface-provider.js # HuggingFace implementation
└── examples.js              # Usage examples
```

## Backward Compatibility

**Good News**: Your existing code will continue to work without changes! The old `ai-manager.js` has been updated to use the new system internally while maintaining the same external API.

### What Still Works
```javascript
// All of this continues to work exactly as before
const aiManager = new AIManager(appController);
await aiManager.ask('What is JavaScript?');
await aiManager.warmup();
aiManager.switchProvider();
const session = aiManager.getSession();
```

## New Features & Capabilities

### 1. Easy Provider Switching
```javascript
const aiManager = new AIManager(appController);

// Switch to specific providers
await aiManager.switchToProvider('openai');
await aiManager.switchToProvider('huggingface');
await aiManager.switchToProvider('ollama');

// Cycle through available providers
await aiManager.cycleProvider();
```

### 2. Custom Configuration
```javascript
// Configure providers with custom settings
await aiManager.switchToProvider('openai', {
  model: 'gpt-4',
  apiKey: 'your-key-here',
  timeout: 30000
});

await aiManager.switchToProvider('ollama', {
  model: 'codellama:7b-instruct',
  baseUrl: 'http://localhost:11434'
});
```

### 3. Direct Provider Usage
```javascript
const { createProvider } = require('./ai/index');

// Create providers directly for more control
const ollamaProvider = createProvider('ollama', {
  model: 'phi3:mini',
  baseUrl: 'http://localhost:11434'
});

const response = await ollamaProvider.chatCompletion({
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' }
  ]
});
```

### 4. Configuration Management
```javascript
const { aiConfig, getProviderConfig } = require('./ai/index');

// Get configuration for a provider
const ollamaConfig = getProviderConfig('ollama');

// Set custom configuration
aiConfig.setProviderConfig('ollama', {
  model: 'custom-model',
  timeout: 120000
});

// Validate configuration
const validation = aiConfig.validateConfig('openai', {
  apiKey: 'sk-...',
  model: 'gpt-3.5-turbo'
});
```

### 5. Streaming Responses
```javascript
// Stream responses in real-time (where supported)
const response = await aiManager.askStream(
  'Write a story about AI',
  (chunk) => {
    console.log('Received chunk:', chunk);
    // Update UI in real-time
  }
);
```

### 6. Multiple AI Managers
```javascript
// Use different managers for different purposes
const codeAssistant = new AIManager(appController);
const chatAssistant = new AIManager(appController);

await codeAssistant.switchToProvider('ollama', { model: 'codellama:7b-instruct' });
await chatAssistant.switchToProvider('openai', { model: 'gpt-3.5-turbo' });

// Use them independently
const codeResponse = await codeAssistant.ask('Write a function to sort an array');
const chatResponse = await chatAssistant.ask('How are you today?');
```

## Adding New Providers

### Step 1: Create Provider Class
```javascript
const BaseAIProvider = require('./providers/base-provider');

class MyCustomProvider extends BaseAIProvider {
  constructor(config = {}) {
    super({
      name: 'mycustom',
      model: config.model || 'default-model',
      ...config
    });
  }

  async chatCompletion(options) {
    // Implement your provider's chat completion logic
    // Must return standardized response format
    return {
      choices: [{
        message: {
          role: 'assistant',
          content: 'Response from my custom provider'
        }
      }],
      provider: this.name,
      model: this.model
    };
  }
}
```

### Step 2: Register Provider
```javascript
const { registerProvider } = require('./ai/provider-factory');

registerProvider('mycustom', MyCustomProvider);

// Now you can use it
const provider = createProvider('mycustom', { model: 'my-model' });
```

## Environment Variables

The new system supports comprehensive environment configuration:

```bash
# Global settings
AI_PROVIDER=ollama

# Ollama settings
OLLAMA_MODEL=phi3:mini
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_TIMEOUT=300000

# OpenAI settings
OPENAI_MODEL=gpt-3.5-turbo
OPENAI_API_KEY=sk-your-api-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_TIMEOUT=120000

# HuggingFace settings
HF_MODEL=deepseek-ai/DeepSeek-R1-0528
HF_TOKEN=your-hf-token
HF_PROVIDER=hyperbolic
HF_TIMEOUT=120000
```

## Migration Examples

### Scenario 1: Adding OpenAI Support
**Before**: Not easily possible without modifying core files
**After**: 
```javascript
// Just set environment variable and use
process.env.OPENAI_API_KEY = 'your-key';
await aiManager.switchToProvider('openai');
```

### Scenario 2: Custom Model Configuration
**Before**: Required code changes to support new models
**After**:
```javascript
await aiManager.switchToProvider('ollama', {
  model: 'my-custom-model:latest'
});
```

### Scenario 3: Multiple Concurrent Sessions
**Before**: Only one session at a time
**After**:
```javascript
const coding = new AIManager(appController);
const chat = new AIManager(appController);
const analysis = new AIManager(appController);

// Each maintains independent sessions
```

## Best Practices

### 1. Error Handling
```javascript
const availableProviders = AIManager.getAvailableProviders();

for (const provider of availableProviders) {
  try {
    await aiManager.switchToProvider(provider);
    const isOnline = await aiManager.warmup();
    if (isOnline) {
      const response = await aiManager.ask(question);
      break; // Success!
    }
  } catch (error) {
    console.log(`${provider} failed:`, error.message);
    continue;
  }
}
```

### 2. Configuration Validation
```javascript
const { validateProviderConfig } = require('./ai/index');

const config = { apiKey: 'sk-test', model: 'gpt-3.5-turbo' };
const validation = validateProviderConfig('openai', config);

if (!validation.valid) {
  console.error('Configuration errors:', validation.errors);
  return;
}
```

### 3. Resource Management
```javascript
// Clear sessions periodically to manage memory
aiManager.clearSession();

// Or clear all sessions
aiManager.clearAllSessions();
```

## Troubleshooting

### Common Issues

**Issue**: "Provider not found" error
**Solution**: Check if the provider is registered and spelled correctly
```javascript
console.log('Available providers:', AIManager.getAvailableProviders());
```

**Issue**: OpenAI authentication errors
**Solution**: Verify your API key is set correctly
```javascript
const config = getProviderConfig('openai');
console.log('API key configured:', !!config.apiKey);
```

**Issue**: Ollama connection failures
**Solution**: Check if Ollama server is running
```javascript
const aiManager = new AIManager(appController);
await aiManager.switchToProvider('ollama');
const isOnline = await aiManager.warmup();
console.log('Ollama online:', isOnline);
```

### Debug Information
```javascript
// Get system status
const summary = AIManager.getConfigSummary();
console.log('System configuration:', summary);

// Get provider info
const info = aiManager.getProviderInfo();
console.log('Current provider:', info);

// Get session stats
const stats = aiManager.getSessionStats();
console.log('Session statistics:', stats);
```

## Performance Considerations

1. **Provider Caching**: Providers are cached automatically for reuse
2. **Session Management**: Sessions are maintained per provider-model combination
3. **Memory Usage**: Clear sessions periodically for long-running applications
4. **Timeout Configuration**: Adjust timeouts based on your use case

## Testing

The new system includes comprehensive examples:

```bash
# Run all examples
node src/js/ai/examples.js

# Or import specific examples
const { basicUsageExample } = require('./ai/examples');
await basicUsageExample(appController);
```

## Future Enhancements

The new architecture makes it easy to add:
- **Claude/Anthropic** support
- **Google Gemini** integration
- **Local model** providers
- **Custom authentication** methods
- **Response caching** strategies
- **Load balancing** across providers

## Support

If you encounter issues during migration:
1. Check the examples in `src/js/ai/examples.js`
2. Review configuration with `AIManager.getConfigSummary()`
3. Test providers individually with the factory pattern
4. Verify environment variables are set correctly

The new system is designed to be backward compatible, so your existing code should continue working while you gradually adopt the new features.