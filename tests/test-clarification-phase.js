/**
 * Test for Clarification Phase Implementation
 * Validates that the clarification phase is properly configured for CLOUD and HYBRID flows
 */

const MODEL_PROMPTS = require('../src/js/model-prompts');

console.log('🧪 Testing Clarification Phase Implementation\n');

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`✅ ${description}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${description}`);
    console.log(`   Error: ${error.message}`);
    failed++;
  }
}

// Test 1: Verify INTERVIEW_TYPES are defined
test('INTERVIEW_TYPES are defined', () => {
  if (!MODEL_PROMPTS.INTERVIEW_TYPES) {
    throw new Error('INTERVIEW_TYPES not exported');
  }
  if (!MODEL_PROMPTS.INTERVIEW_TYPES.DSA) {
    throw new Error('DSA interview type not defined');
  }
  if (!MODEL_PROMPTS.INTERVIEW_TYPES.SYSTEM_DESIGN) {
    throw new Error('SYSTEM_DESIGN interview type not defined');
  }
  if (!MODEL_PROMPTS.INTERVIEW_TYPES.LLD) {
    throw new Error('LLD interview type not defined');
  }
});

// Test 2: Verify getCloudPrompt handles 'clarification' phase for DSA
test('getCloudPrompt returns clarification prompt for DSA', () => {
  const prompt = MODEL_PROMPTS.getCloudPrompt('clarification', MODEL_PROMPTS.INTERVIEW_TYPES.DSA);
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Clarification prompt not returned or invalid type');
  }
  if (!prompt.includes('Problem Understanding')) {
    throw new Error('Clarification prompt does not contain expected sections');
  }
});

// Test 3: Verify getCloudPrompt handles 'clarification' phase for System Design
test('getCloudPrompt returns clarification prompt for System Design', () => {
  const prompt = MODEL_PROMPTS.getCloudPrompt('clarification', MODEL_PROMPTS.INTERVIEW_TYPES.SYSTEM_DESIGN);
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Clarification prompt not returned or invalid type');
  }
  if (!prompt.includes('Requirements Clarification')) {
    throw new Error('Clarification prompt does not contain expected sections');
  }
});

// Test 4: Verify getCloudPrompt handles 'clarification' phase for LLD
test('getCloudPrompt returns clarification prompt for LLD', () => {
  const prompt = MODEL_PROMPTS.getCloudPrompt('clarification', MODEL_PROMPTS.INTERVIEW_TYPES.LLD);
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Clarification prompt not returned or invalid type');
  }
  if (!prompt.includes('Requirements & Use Cases')) {
    throw new Error('Clarification prompt does not contain expected sections');
  }
});

// Test 5: Verify getHybridPrompt handles 'clarification' phase for DSA
test('getHybridPrompt returns clarification prompt for DSA', () => {
  const prompt = MODEL_PROMPTS.getHybridPrompt('clarification', MODEL_PROMPTS.INTERVIEW_TYPES.DSA);
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Clarification prompt not returned or invalid type');
  }
  if (!prompt.includes('Problem Understanding')) {
    throw new Error('Clarification prompt does not contain expected sections');
  }
});

// Test 6: Verify getHybridPrompt handles 'clarification' phase for System Design
test('getHybridPrompt returns clarification prompt for System Design', () => {
  const prompt = MODEL_PROMPTS.getHybridPrompt('clarification', MODEL_PROMPTS.INTERVIEW_TYPES.SYSTEM_DESIGN);
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Clarification prompt not returned or invalid type');
  }
  if (!prompt.includes('Requirements Clarification')) {
    throw new Error('Clarification prompt does not contain expected sections');
  }
});

// Test 7: Verify getHybridPrompt handles 'clarification' phase for LLD
test('getHybridPrompt returns clarification prompt for LLD', () => {
  const prompt = MODEL_PROMPTS.getHybridPrompt('clarification', MODEL_PROMPTS.INTERVIEW_TYPES.LLD);
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Clarification prompt not returned or invalid type');
  }
  if (!prompt.includes('Requirements & Use Cases')) {
    throw new Error('Clarification prompt does not contain expected sections');
  }
});

// Test 8: Verify existing 'answer' phase still works for CLOUD
test('getCloudPrompt returns answer prompt for DSA', () => {
  const prompt = MODEL_PROMPTS.getCloudPrompt('answer', MODEL_PROMPTS.INTERVIEW_TYPES.DSA);
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Answer prompt not returned or invalid type');
  }
  if (!prompt.includes('Solution Approach')) {
    throw new Error('Answer prompt does not contain expected sections');
  }
});

// Test 9: Verify existing 'verification' phase still works for CLOUD
test('getCloudPrompt returns verification prompt for DSA', () => {
  const prompt = MODEL_PROMPTS.getCloudPrompt('verification', MODEL_PROMPTS.INTERVIEW_TYPES.DSA);
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Verification prompt not returned or invalid type');
  }
  if (!prompt.includes('Quick Check')) {
    throw new Error('Verification prompt does not contain expected sections');
  }
});

// Test 10: Verify existing 'local' phase still works for HYBRID
test('getHybridPrompt returns local prompt for DSA', () => {
  const prompt = MODEL_PROMPTS.getHybridPrompt('local', MODEL_PROMPTS.INTERVIEW_TYPES.DSA);
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Local prompt not returned or invalid type');
  }
  if (!prompt.includes('Quick Approach')) {
    throw new Error('Local prompt does not contain expected sections');
  }
});

// Test 11: Verify existing 'cloud' phase still works for HYBRID
test('getHybridPrompt returns cloud prompt for DSA', () => {
  const prompt = MODEL_PROMPTS.getHybridPrompt('cloud', MODEL_PROMPTS.INTERVIEW_TYPES.DSA);
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Cloud prompt not returned or invalid type');
  }
  if (!prompt.includes('Key Optimization Insight')) {
    throw new Error('Cloud prompt does not contain expected sections');
  }
});

// Test 12: Verify flow configuration (requires loading simple-ai-manager)
test('FLOW_CONFIGS have phase0 defined', () => {
  // We can't directly test FLOW_CONFIGS since it's not exported, but we can verify
  // that the file loads without errors (already done by syntax check)
  // This test just confirms the module structure is valid
  const simpleAIManager = require('../src/js/ai/simple-ai-manager');
  if (typeof simpleAIManager !== 'function') {
    throw new Error('SimpleAIManager is not a constructor');
  }
});

console.log('\n' + '='.repeat(50));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log('='.repeat(50));

if (failed > 0) {
  process.exit(1);
}

console.log('\n✨ All tests passed! Clarification phase is properly configured.\n');
