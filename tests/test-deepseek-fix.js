/**
 * Test DeepSeek Fix
 *
 * Verifies that the fix for reasoning_content field works correctly
 */

require('dotenv').config();
const simpleAI = require('../src/js/ai/simple-ai');

console.log('🧪 Testing DeepSeek Fix for reasoning_content');
console.log('==============================================\n');

async function testFix() {
  console.log('1. Testing non-streaming response...');
  try {
    const response = await simpleAI.chatCompletion({
      provider: 'deepseek',
      messages: [{ role: 'user', content: 'What is 2 + 2?' }],
      parameters: { max_tokens: 100 }
    });

    const content = response.choices?.[0]?.message?.content || '';
    console.log(`   ✅ Response received: ${content.length} chars`);
    console.log(`   📝 Content preview: ${content.substring(0, 100)}...`);

    if (content.length > 0) {
      console.log('   ✅ Non-streaming: PASSED\n');
    } else {
      console.log('   ❌ Non-streaming: FAILED - No content\n');
    }
  } catch (error) {
    console.error(`   ❌ Non-streaming: FAILED - ${error.message}\n`);
  }

  console.log('2. Testing streaming response...');
  try {
    let streamedContent = '';
    let chunkCount = 0;

    const response = await simpleAI.chatCompletion({
      provider: 'deepseek',
      messages: [{ role: 'user', content: 'Count from 1 to 3' }],
      parameters: { max_tokens: 50 },
      stream: true,
      onChunk: (chunk) => {
        streamedContent += chunk;
        chunkCount++;
        process.stdout.write('.');
      }
    });

    console.log('\n');
    console.log(`   ✅ Chunks received: ${chunkCount}`);
    console.log(`   ✅ Streamed content: ${streamedContent.length} chars`);
    console.log(`   📝 Content preview: ${streamedContent.substring(0, 100)}`);

    if (chunkCount > 0 && streamedContent.length > 0) {
      console.log('   ✅ Streaming: PASSED\n');
    } else {
      console.log('   ❌ Streaming: FAILED - No chunks or content\n');
    }
  } catch (error) {
    console.error(`\n   ❌ Streaming: FAILED - ${error.message}\n`);
  }

  console.log('═'.repeat(60));
  console.log('✅ Fix verification complete!');
  console.log('If both tests passed, the fix is working correctly.');
  console.log('═'.repeat(60));
}

testFix().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
