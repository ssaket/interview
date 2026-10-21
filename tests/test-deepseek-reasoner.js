/**
 * DeepSeek Reasoner Test
 *
 * Tests DeepSeek V4 thinking mode to verify:
 * 1. API connection works
 * 2. Response format and structure
 * 3. Thinking block handling
 * 4. Content extraction
 */

require('dotenv').config();
const simpleAI = require('../src/js/ai/simple-ai');
const aiConfig = require('../src/js/ai/ai-config');
const InterviewCodeFormatter = require('../src/js/formatter');

console.log('🧪 Testing DeepSeek V4 Thinking Mode');
console.log('===================================\n');

// Test configuration
const TEST_QUERY = "What is 2 + 2? Think through this step by step.";

async function runTests() {
  // Test 1: Verify configuration
  console.log('1. Checking DeepSeek configuration...');
  try {
    const config = aiConfig.getProviderConfig('deepseek');
    console.log(`   ✅ Provider: ${config.name}`);
    console.log(`   ✅ Model: ${config.model}`);
    console.log(`   ✅ Base URL: ${config.baseUrl}`);
    console.log(`   ✅ API Key: ${config.apiKey ? 'Set (***' + config.apiKey.slice(-4) + ')' : '❌ MISSING'}`);
    console.log(`   ✅ Version: ${config.version}`);
    console.log(`   ✅ Max tokens: ${config.parameters.max_tokens}`);
    console.log(`   ✅ Temperature: ${config.parameters.temperature}`);

    if (!config.apiKey) {
      console.error('\n❌ ERROR: DEEPSEEK_API_KEY not set in .env file!');
      console.log('Please add: DEEPSEEK_API_KEY=your_key_here\n');
      process.exit(1);
    }

    console.log('   ✅ Configuration check: PASSED\n');
  } catch (error) {
    console.error(`   ❌ Configuration check: FAILED - ${error.message}\n`);
    process.exit(1);
  }

  // Test 2: Test API connection
  console.log('2. Testing DeepSeek API connection...');
  try {
    const startTime = Date.now();
    const testResponse = await simpleAI.chatCompletion({
      provider: 'deepseek',
      messages: [{ role: 'user', content: 'ping' }],
      parameters: { max_tokens: 10 }
    });
    const elapsed = Date.now() - startTime;

    console.log(`   ✅ Connection successful (${elapsed}ms)`);
    console.log(`   ✅ Response provider: ${testResponse.provider}`);
    console.log(`   ✅ Response model: ${testResponse.model}`);
    console.log('   ✅ API connection: PASSED\n');
  } catch (error) {
    console.error(`   ❌ API connection: FAILED - ${error.message}`);
    console.log('\nPossible issues:');
    console.log('  - Invalid API key');
    console.log('  - Network connectivity');
    console.log('  - API service unavailable\n');
    process.exit(1);
  }

  // Test 3: Test V4 thinking mode. On V4 the mode is a per-request switch derived
  // from flowType, so this must pass a thinking flow ('steps') to exercise it.
  console.log('3. Testing V4 thinking mode response...');
  console.log(`   Query: "${TEST_QUERY}"\n`);

  try {
    const startTime = Date.now();
    const response = await simpleAI.chatCompletion({
      provider: 'deepseek',
      messages: [{ role: 'user', content: TEST_QUERY }],
      flowType: 'steps',
      interviewType: 'dsa',
      parameters: {
        max_tokens: 2000
      }
    });
    const elapsed = Date.now() - startTime;

    console.log(`   ✅ Response received (${elapsed}ms)`);

    // Extract content
    const content = response.choices?.[0]?.message?.content || '';

    console.log('\n   📝 RAW RESPONSE (first 500 chars):');
    console.log('   ' + '─'.repeat(60));
    console.log(content.substring(0, 500).split('\n').map(line => '   ' + line).join('\n'));
    if (content.length > 500) {
      console.log('   ... (truncated, total length: ' + content.length + ' chars)');
    }
    console.log('   ' + '─'.repeat(60));

    // Analyze response structure
    console.log('\n   🔍 RESPONSE ANALYSIS:');
    console.log(`   ✅ Total length: ${content.length} characters`);

    const hasThinkTags = /<think>[\s\S]*?<\/think>/i.test(content);
    console.log(`   ${hasThinkTags ? '✅' : '⚠️ '} Contains <think> tags: ${hasThinkTags}`);

    if (hasThinkTags) {
      const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/i);
      const thinkContent = thinkMatch ? thinkMatch[1] : '';
      const answerContent = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

      console.log(`   ✅ Thinking block length: ${thinkContent.length} chars`);
      console.log(`   ✅ Answer content length: ${answerContent.length} chars`);

      console.log('\n   🧠 THINKING CONTENT (first 200 chars):');
      console.log('   ' + '─'.repeat(60));
      console.log(thinkContent.substring(0, 200).split('\n').map(line => '   ' + line).join('\n'));
      if (thinkContent.length > 200) {
        console.log('   ... (truncated)');
      }
      console.log('   ' + '─'.repeat(60));

      console.log('\n   💬 ANSWER CONTENT:');
      console.log('   ' + '─'.repeat(60));
      console.log(answerContent.split('\n').map(line => '   ' + line).join('\n'));
      console.log('   ' + '─'.repeat(60));
    } else {
      console.log('   ⚠️  No thinking tags found - this might be the issue!');
      console.log('   💡 The model may not be using think mode, or the format changed.');
    }

    console.log('\n   ✅ Reasoner model test: PASSED\n');

  } catch (error) {
    console.error(`   ❌ Reasoner model test: FAILED - ${error.message}`);
    console.error('\nError details:', error);
    process.exit(1);
  }

  // Test 4: Test formatter behavior
  console.log('4. Testing formatter behavior...');
  try {
    const formatter = new InterviewCodeFormatter();

    const testContent = `<think>
This is the reasoning process.
Step 1: Analyze the problem
Step 2: Find solution
</think>

The answer is: 2 + 2 = 4`;

    console.log('   📝 Test input with thinking tags:');
    console.log('   ' + '─'.repeat(60));
    console.log(testContent.split('\n').map(line => '   ' + line).join('\n'));
    console.log('   ' + '─'.repeat(60));

    const formatted = formatter.format(testContent, false, true);

    console.log('\n   📝 Formatter output (text):');
    console.log('   ' + '─'.repeat(60));
    console.log(formatted.text.split('\n').map(line => '   ' + line).join('\n'));
    console.log('   ' + '─'.repeat(60));

    const hasThinkInOutput = formatted.text.includes('reasoning process');
    console.log(`\n   ${hasThinkInOutput ? '✅' : '❌'} Thinking content preserved: ${hasThinkInOutput}`);

    if (!hasThinkInOutput) {
      console.log('   ⚠️  WARNING: Formatter is removing thinking blocks!');
      console.log('   💡 This is why you\'re not seeing AI responses.');
    }

    console.log('   ✅ Formatter test: COMPLETED\n');

  } catch (error) {
    console.error(`   ❌ Formatter test: FAILED - ${error.message}\n`);
  }

  // Test 5: Test streaming
  console.log('5. Testing streaming response...');
  try {
    let streamedContent = '';
    let chunkCount = 0;

    const startTime = Date.now();
    await simpleAI.chatCompletion({
      provider: 'deepseek',
      messages: [{ role: 'user', content: 'Count from 1 to 5' }],
      parameters: { max_tokens: 100 },
      stream: true,
      onChunk: (chunk) => {
        streamedContent += chunk;
        chunkCount++;
      }
    });
    const elapsed = Date.now() - startTime;

    console.log(`   ✅ Streaming successful (${elapsed}ms)`);
    console.log(`   ✅ Received ${chunkCount} chunks`);
    console.log(`   ✅ Total streamed content: ${streamedContent.length} chars`);
    console.log('   ✅ Streaming test: PASSED\n');

  } catch (error) {
    console.error(`   ❌ Streaming test: FAILED - ${error.message}\n`);
  }

  // Summary
  console.log('═'.repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('═'.repeat(70));
  console.log('✅ All tests completed!');
  console.log('\n🔍 KEY FINDINGS:');
  console.log('   1. DeepSeek API connection: Working');
  console.log('   2. V4 thinking mode: Responding');
  console.log('   3. Check the response analysis above for thinking tags');
  console.log('   4. If formatter removes thinking blocks, that\'s the issue!');
  console.log('\n💡 NEXT STEPS:');
  console.log('   - If thinking blocks are being removed, modify formatter.js');
  console.log('   - Consider making thinking block display configurable');
  console.log('   - Test in the actual application after fixes');
  console.log('═'.repeat(70));
}

// Run all tests
runTests().catch(error => {
  console.error('\n❌ Test suite failed:', error);
  process.exit(1);
});
