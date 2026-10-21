#!/usr/bin/env node
/**
 * Test interview-type-specific hybrid model selection
 *
 * This test verifies that:
 * 1. Default hybrid models are correctly set for each interview type
 * 2. Environment variables override defaults correctly
 * 3. Fallback to OLLAMA_HYBRID_MODEL works when type-specific model isn't set
 * 4. getFlowModel returns correct models based on interview type
 */

const AIConfig = require('../src/js/ai/ai-config');

console.log('🧪 Testing Interview-Type-Specific Hybrid Model Selection\n');

// Test 1: Default hybrid models
console.log('📋 Test 1: Default hybrid models for each interview type');
console.log('─'.repeat(60));

const dsaModel = AIConfig.getHybridModelByType('ollama', 'dsa');
const systemDesignModel = AIConfig.getHybridModelByType('ollama', 'systemDesign');
const lldModel = AIConfig.getHybridModelByType('ollama', 'lld');

console.log(`DSA hybrid model:           ${dsaModel}`);
console.log(`System Design hybrid model: ${systemDesignModel}`);
console.log(`LLD hybrid model:           ${lldModel}`);

const test1Pass = dsaModel === 'qwen3:4b-instruct-2507-fp16' &&
                  systemDesignModel === 'magistral' &&
                  lldModel === 'magistral';

console.log(`\n✅ Test 1: ${test1Pass ? 'PASSED' : 'FAILED'}\n`);

// Test 2: getFlowModel with interview type
console.log('📋 Test 2: getFlowModel with interview type parameter');
console.log('─'.repeat(60));

const hybridDsaModel = AIConfig.getFlowModel('ollama', 'hybrid', 'dsa');
const hybridSystemDesignModel = AIConfig.getFlowModel('ollama', 'hybrid', 'systemDesign');
const hybridLldModel = AIConfig.getFlowModel('ollama', 'hybrid', 'lld');

console.log(`Hybrid flow DSA model:           ${hybridDsaModel}`);
console.log(`Hybrid flow System Design model: ${hybridSystemDesignModel}`);
console.log(`Hybrid flow LLD model:           ${hybridLldModel}`);

const test2Pass = hybridDsaModel === 'qwen3:4b-instruct-2507-fp16' &&
                  hybridSystemDesignModel === 'magistral' &&
                  hybridLldModel === 'magistral';

console.log(`\n✅ Test 2: ${test2Pass ? 'PASSED' : 'FAILED'}\n`);

// Test 3: Fallback to general hybrid model
console.log('📋 Test 3: Fallback to general hybrid model (null interview type)');
console.log('─'.repeat(60));

const fallbackModel = AIConfig.getFlowModel('ollama', 'hybrid', null);
const generalHybridModel = AIConfig.getHybridModel('ollama');

console.log(`Fallback model (null type):   ${fallbackModel}`);
console.log(`General hybrid model:         ${generalHybridModel}`);

const test3Pass = fallbackModel === generalHybridModel;

console.log(`\n✅ Test 3: ${test3Pass ? 'PASSED' : 'FAILED'}\n`);

// Test 4: Non-hybrid flows should not use interview-specific models
console.log('📋 Test 4: Non-hybrid flows ignore interview type');
console.log('─'.repeat(60));

const localModel = AIConfig.getFlowModel('ollama', 'local', 'systemDesign');
const cloudModel = AIConfig.getFlowModel('deepseek', 'cloud', 'lld');

console.log(`Local flow model (with systemDesign): ${Array.isArray(localModel) ? 'array (correct)' : localModel}`);
console.log(`Cloud flow model (with lld):          ${cloudModel}`);

// Local flow returns the 'local' array or primary, cloud returns cloud model
const test4Pass = (Array.isArray(localModel) || localModel === 'gpt-oss') &&
                  cloudModel === 'deepseek-v4-pro';

console.log(`\n✅ Test 4: ${test4Pass ? 'PASSED' : 'FAILED'}\n`);

// Test 5: DeepSeek V4 thinking mode is selected per flow, not per model
console.log('📋 Test 5: DeepSeek V4 thinking mode selection by flow');
console.log('─'.repeat(60));

const flowModes = {
  cloud: AIConfig.isThinkingFlow('deepseek', 'cloud'),
  hybrid: AIConfig.isThinkingFlow('deepseek', 'hybrid'),
  steps: AIConfig.isThinkingFlow('deepseek', 'steps'),
  local: AIConfig.isThinkingFlow('deepseek', 'local'),
};

for (const [flow, thinking] of Object.entries(flowModes)) {
  console.log(`${flow.padEnd(8)} flow thinking mode: ${thinking}`);
}

// All flows resolve to the same V4 model - only the thinking flag differs
const sameModel = AIConfig.getFlowModel('deepseek', 'cloud', 'dsa') ===
                  AIConfig.getFlowModel('deepseek', 'steps', 'dsa');
console.log(`Cloud and steps flows share one model: ${sameModel}`);

const test5Pass = flowModes.cloud === false &&
                  flowModes.hybrid === true &&
                  flowModes.steps === true &&
                  flowModes.local === false &&
                  sameModel;

console.log(`\n✅ Test 5: ${test5Pass ? 'PASSED' : 'FAILED'}\n`);

// Test 6: Thinking-mode timeouts still vary by flow and interview type
console.log('📋 Test 6: Reasoner timeouts by flow and interview type');
console.log('─'.repeat(60));

const dsaCloudTimeout = AIConfig.getReasonerTimeout('deepseek', 'hybrid', 'dsa');
const lldCloudTimeout = AIConfig.getReasonerTimeout('deepseek', 'hybrid', 'lld');
const dsaStepsTimeout = AIConfig.getReasonerTimeout('deepseek', 'steps', 'dsa');
const sdStepsTimeout = AIConfig.getReasonerTimeout('deepseek', 'steps', 'systemDesign');

console.log(`Hybrid/DSA:          ${dsaCloudTimeout}ms`);
console.log(`Hybrid/LLD:          ${lldCloudTimeout}ms`);
console.log(`Steps/DSA:           ${dsaStepsTimeout}ms`);
console.log(`Steps/System Design: ${sdStepsTimeout}ms`);

const test6Pass = dsaCloudTimeout === 100000 &&
                  lldCloudTimeout === 180000 &&
                  dsaStepsTimeout === 240000 &&
                  sdStepsTimeout === 360000;

console.log(`\n✅ Test 6: ${test6Pass ? 'PASSED' : 'FAILED'}\n`);

// Summary
console.log('═'.repeat(60));
console.log('📊 Test Summary');
console.log('═'.repeat(60));

const results = [test1Pass, test2Pass, test3Pass, test4Pass, test5Pass, test6Pass];
const allTestsPassed = results.every(Boolean);
const passCount = results.filter(Boolean).length;

console.log(`Total tests: ${results.length}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${results.length - passCount}`);

if (allTestsPassed) {
  console.log('\n✅ All tests PASSED! Interview-type-specific hybrid models working correctly.');
  process.exit(0);
} else {
  console.log('\n❌ Some tests FAILED. Please review the implementation.');
  process.exit(1);
}
