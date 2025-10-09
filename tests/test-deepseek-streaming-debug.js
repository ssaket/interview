/**
 * DeepSeek Streaming Debug Test
 *
 * This test debugs the streaming response format to see why chunks aren't being received.
 */

require('dotenv').config();
const axios = require('axios');
const aiConfig = require('../src/js/ai/ai-config');

console.log('🔍 DeepSeek Streaming Debug Test');
console.log('==================================\n');

async function testStreaming() {
  const config = aiConfig.getProviderConfig('deepseek');

  if (!config.apiKey) {
    console.error('❌ DEEPSEEK_API_KEY not set!');
    process.exit(1);
  }

  const baseUrl = config.baseUrl.endsWith('/v1')
    ? config.baseUrl
    : config.baseUrl.replace(/\/$/, '') + '/v1';

  const requestBody = {
    model: config.model,
    messages: [{ role: 'user', content: 'Say "Hello World" and nothing else.' }],
    temperature: 0.1,
    max_tokens: 50,
    stream: true
  };

  console.log('📤 Request:');
  console.log(`   URL: ${baseUrl}/chat/completions`);
  console.log(`   Model: ${config.model}`);
  console.log(`   Stream: true\n`);

  try {
    const response = await axios.post(`${baseUrl}/chat/completions`, requestBody, {
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      responseType: 'stream'
    });

    console.log('📥 Receiving streaming response...\n');
    console.log('─'.repeat(70));

    let chunkCount = 0;
    let fullContent = '';
    let rawChunks = [];

    response.data.on('data', (chunk) => {
      chunkCount++;
      const chunkStr = chunk.toString();
      rawChunks.push(chunkStr);

      console.log(`\n🔸 Chunk #${chunkCount}:`);
      console.log(chunkStr);
      console.log('─'.repeat(70));

      // Try to parse it
      const lines = chunkStr.split('\n').filter(line => line.trim());

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();

          if (data === '[DONE]') {
            console.log('✅ Received [DONE] marker');
            continue;
          }

          try {
            const parsed = JSON.parse(data);
            console.log('\n📊 Parsed JSON structure:');
            console.log(JSON.stringify(parsed, null, 2));

            // Check various possible locations for content
            if (parsed.choices && parsed.choices[0]) {
              const choice = parsed.choices[0];
              console.log('\n🔍 Choice structure:');
              console.log(`   - delta: ${JSON.stringify(choice.delta)}`);
              console.log(`   - message: ${JSON.stringify(choice.message)}`);
              console.log(`   - text: ${choice.text}`);

              // Extract content from various possible fields
              const content =
                choice.delta?.content ||
                choice.message?.content ||
                choice.text ||
                '';

              if (content) {
                fullContent += content;
                console.log(`   ✅ Found content: "${content}"`);
              } else {
                console.log('   ⚠️  No content in this chunk');
              }
            }
          } catch (parseError) {
            console.log(`   ⚠️  JSON parse error: ${parseError.message}`);
          }
        } else {
          console.log(`   ℹ️  Non-data line: ${line.substring(0, 50)}`);
        }
      }
    });

    response.data.on('error', (error) => {
      console.error('\n❌ Stream error:', error);
    });

    response.data.on('end', () => {
      console.log('\n✅ Stream ended');
      console.log(`\n📊 Summary:`);
      console.log(`   - Total chunks: ${chunkCount}`);
      console.log(`   - Full content: "${fullContent}"`);
      console.log(`   - Content length: ${fullContent.length} chars`);

      if (fullContent.length === 0) {
        console.log('\n⚠️  WARNING: No content extracted from stream!');
        console.log('This explains why streaming returns 0 chunks in the app.');
        console.log('\n💡 Check the chunk structure above to see the actual format.');
      } else {
        console.log('\n✅ Streaming is working! Content was extracted successfully.');
      }
    });

  } catch (error) {
    console.error('❌ Request failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

testStreaming();
