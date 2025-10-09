/**
 * Debug non-streaming response structure
 */

require('dotenv').config();
const simpleAI = require('../src/js/ai/simple-ai');

async function test() {
  console.log('Testing non-streaming response structure...\n');

  const response = await simpleAI.chatCompletion({
    provider: 'deepseek',
    messages: [{ role: 'user', content: 'Say hello' }],
    parameters: { max_tokens: 50 }
  });

  console.log('Full response structure:');
  console.log(JSON.stringify(response, null, 2));

  console.log('\n\nChoice[0]:');
  if (response.choices && response.choices[0]) {
    console.log(JSON.stringify(response.choices[0], null, 2));

    console.log('\n\nMessage:');
    if (response.choices[0].message) {
      console.log(JSON.stringify(response.choices[0].message, null, 2));
    }
  }
}

test().catch(console.error);
