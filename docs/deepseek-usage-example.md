# DeepSeek Provider Usage Guide

## Overview

DeepSeek is now supported as a provider in the AI Manager system. DeepSeek offers two main models:
- **deepseek-chat** (DeepSeek-V3): General-purpose chat model with strong reasoning capabilities
- **deepseek-reasoner** (DeepSeek-R1): Specialized reasoning model for complex problem-solving

## Prerequisites

1. **Get API Key**: Sign up at [DeepSeek Platform](https://platform.deepseek.com/) and obtain an API key
2. **Set Environment Variable**: 
   ```bash
   export DEEPSEEK_API_KEY="your-api-key-here"
   ```

## Quick Start

### Using AI Manager (Recommended)

```javascript
const { AIManager } = require('./src/js/ai/index');

// Create AI Manager
const aiManager = new AIManager(appController);

// Switch to DeepSeek chat model
await aiManager.switchProvider('deepseek', {
  model: 'deepseek-chat',
  apiKey: process.env.DEEPSEEK_API_KEY
});

// Ask a question
const response = await aiManager.ask('Explain quantum computing in simple terms');
console.log(response);
```

### Using Provider Directly

```javascript
const { createProvider } = require('./src/js/ai/index');

// Create DeepSeek provider
const deepseek = createProvider('deepseek', {
  model: 'deepseek-chat',
  apiKey: process.env.DEEPSEEK_API_KEY
});

// Use the provider
const response = await deepseek.chatCompletion({
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is machine learning?' }
  ]
});

console.log(response.choices[0].message.content);
```

## Configuration Options

### Environment Variables

```bash
# Required
DEEPSEEK_API_KEY=your-api-key-here

# Optional
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_TIMEOUT=120000
```

### Configuration Object

```javascript
const config = {
  model: 'deepseek-chat',           // or 'deepseek-reasoner'
  apiKey: 'your-api-key',
  baseUrl: 'https://api.deepseek.com',
  timeout: 120000,                  // 2 minutes
  parameters: {
    temperature: 0.7,
    top_p: 1.0,
    max_tokens: 2048
  }
};
```

## Model Comparison

### DeepSeek-Chat (deepseek-chat)
- **Best for**: General conversations, coding, creative writing
- **Context Window**: 64,000 tokens
- **Pricing**: ~$0.14/1M input tokens, ~$0.28/1M output tokens
- **Temperature**: 0.7 (default)

```javascript
await aiManager.switchProvider('deepseek', {
  model: 'deepseek-chat',
  apiKey: process.env.DEEPSEEK_API_KEY
});

const response = await aiManager.ask('Write a Python function to calculate fibonacci numbers');
```

### DeepSeek-Reasoner (deepseek-reasoner)
- **Best for**: Complex reasoning, math problems, step-by-step analysis
- **Context Window**: 64,000 tokens
- **Pricing**: ~$0.55/1M input tokens, ~$2.19/1M output tokens
- **Temperature**: 0.3 (default, more focused)

```javascript
await aiManager.switchProvider('deepseek', {
  model: 'deepseek-reasoner',
  apiKey: process.env.DEEPSEEK_API_KEY
});

const response = await aiManager.ask(`
Solve this step by step:
A company's revenue increased by 25% in the first quarter, 
then decreased by 15% in the second quarter. 
If the revenue at the end of Q2 was $850,000, 
what was the original revenue?
`);
```

## Advanced Usage

### Streaming Responses

```javascript
const { createProvider } = require('./src/js/ai/index');

const deepseek = createProvider('deepseek', {
  model: 'deepseek-chat',
  apiKey: process.env.DEEPSEEK_API_KEY
});

// Stream response in real-time
await deepseek.streamChatCompletion({
  messages: [
    { role: 'user', content: 'Write a short story about AI' }
  ]
}, (chunk) => {
  process.stdout.write(chunk); // Print each chunk as it arrives
});
```

### Using with AI Manager Streaming

```javascript
const { AIManager } = require('./src/js/ai/index');

const aiManager = new AIManager(appController);
await aiManager.switchProvider('deepseek');

const response = await aiManager.askStream(
  'Explain how neural networks work',
  (chunk) => {
    // Update UI with each chunk
    updateUI(chunk);
  }
);
```

### Model Switching

```javascript
const { createProvider } = require('./src/js/ai/index');

const deepseek = createProvider('deepseek', {
  apiKey: process.env.DEEPSEEK_API_KEY
});

// Start with chat model
deepseek.useChatModel();
console.log('Current model:', deepseek.getModel()); // deepseek-chat

// Switch to reasoning model for complex problems
deepseek.useReasoningModel();
console.log('Current model:', deepseek.getModel()); // deepseek-reasoner
console.log('Is reasoning model:', deepseek.isReasoningModel()); // true
```

### Multiple Providers

```javascript
const { AIManager } = require('./src/js/ai/index');

// Create different managers for different tasks
const chatAssistant = new AIManager(appController);
const reasoningAssistant = new AIManager(appController);
const codeAssistant = new AIManager(appController);

// Configure each for specific use cases
await chatAssistant.switchProvider('deepseek', { 
  model: 'deepseek-chat' 
});

await reasoningAssistant.switchProvider('deepseek', { 
  model: 'deepseek-reasoner' 
});

await codeAssistant.switchProvider('ollama', { 
  model: 'codellama:7b-instruct' 
});

// Use them for different types of questions
const [chatResponse, reasoningResponse, codeResponse] = await Promise.all([
  chatAssistant.ask('How are you today?'),
  reasoningAssistant.ask('Solve this logic puzzle: ...'),
  codeAssistant.ask('Write a sorting algorithm in JavaScript')
]);
```

## Error Handling

```javascript
const { createProvider } = require('./src/js/ai/index');

try {
  const deepseek = createProvider('deepseek', {
    apiKey: process.env.DEEPSEEK_API_KEY || 'invalid-key',
    model: 'deepseek-chat'
  });

  const response = await deepseek.chatCompletion({
    messages: [{ role: 'user', content: 'Hello' }]
  });

  console.log(response.choices[0].message.content);
} catch (error) {
  if (error.message.includes('Invalid DeepSeek API key')) {
    console.error('Please check your DEEPSEEK_API_KEY environment variable');
  } else if (error.message.includes('rate limit')) {
    console.error('Rate limit exceeded, please try again later');
  } else {
    console.error('DeepSeek API error:', error.message);
  }
}
```

## Best Practices

### 1. Choose the Right Model
```javascript
// For general chat and coding
const chatModel = 'deepseek-chat';

// For complex reasoning and math
const reasoningModel = 'deepseek-reasoner';
```

### 2. Optimize Parameters
```javascript
// For creative tasks
const creativeParams = {
  temperature: 0.8,
  top_p: 0.95,
  max_tokens: 2048
};

// For factual/analytical tasks
const analyticalParams = {
  temperature: 0.3,
  top_p: 0.9,
  max_tokens: 4096
};
```

### 3. Handle Context Windows
```javascript
const deepseek = createProvider('deepseek', {
  apiKey: process.env.DEEPSEEK_API_KEY
});

// Check context window
const contextWindow = deepseek.getContextWindow(); // 64000 tokens

// Estimate token usage
const tokenCount = deepseek.estimateTokenCount(messages);
if (tokenCount > contextWindow * 0.8) {
  console.warn('Approaching context window limit');
}
```

### 4. Monitor Costs
```javascript
const deepseek = createProvider('deepseek', {
  model: 'deepseek-reasoner' // More expensive than chat model
});

const pricing = deepseek.getPricingInfo();
console.log('Pricing:', pricing); // { input: 0.55, output: 2.19 }
```

## Integration Examples

### With Express.js

```javascript
const express = require('express');
const { AIManager } = require('./src/js/ai/index');

const app = express();
app.use(express.json());

const aiManager = new AIManager(mockAppController);
await aiManager.switchProvider('deepseek');

app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const response = await aiManager.ask(message);
    res.json({ response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### With Real-time Updates

```javascript
const { createProvider } = require('./src/js/ai/index');

const deepseek = createProvider('deepseek', {
  apiKey: process.env.DEEPSEEK_API_KEY
});

// Simulate real-time chat
async function streamChat(userMessage, onUpdate) {
  await deepseek.streamChatCompletion({
    messages: [
      { role: 'user', content: userMessage }
    ]
  }, (chunk) => {
    onUpdate(chunk); // Send to WebSocket, SSE, etc.
  });
}

// Usage
streamChat('Explain quantum computing', (chunk) => {
  console.log('Received:', chunk);
  // Send to frontend via WebSocket
  ws.send(JSON.stringify({ type: 'chunk', data: chunk }));
});
```

## Troubleshooting

### Common Issues

1. **API Key Not Working**
   ```bash
   # Check if API key is set
   echo $DEEPSEEK_API_KEY
   
   # Should start with 'sk-'
   ```

2. **Rate Limiting**
   ```javascript
   // Add retry logic
   const maxRetries = 3;
   let retries = 0;
   
   while (retries < maxRetries) {
     try {
       const response = await deepseek.chatCompletion({...});
       break;
     } catch (error) {
       if (error.message.includes('rate limit') && retries < maxRetries - 1) {
         retries++;
         await new Promise(resolve => setTimeout(resolve, 1000 * retries));
       } else {
         throw error;
       }
     }
   }
   ```

3. **Model Not Found**
   ```javascript
   // Check available models
   const models = await deepseek.getAvailableModels();
   console.log('Available models:', models);
   ```

### Testing Connection

```javascript
const { createProvider } = require('./src/js/ai/index');

async function testDeepSeek() {
  const deepseek = createProvider('deepseek', {
    apiKey: process.env.DEEPSEEK_API_KEY
  });

  // Test connection
  const status = await deepseek.checkConnection();
  console.log('Connection status:', status);

  if (status.connected) {
    console.log('✅ DeepSeek is ready to use!');
  } else {
    console.log('❌ Connection failed:', status.error);
  }
}

testDeepSeek();
```

## Next Steps

1. **Explore Model Capabilities**: Try both chat and reasoning models
2. **Implement Streaming**: Use real-time responses for better UX
3. **Add Error Handling**: Implement robust error handling and retries
4. **Monitor Usage**: Track token usage and costs
5. **Combine with Other Providers**: Use DeepSeek alongside Ollama, OpenAI, etc.

For more examples, check out the test file: `src/js/ai/test-deepseek.js`
