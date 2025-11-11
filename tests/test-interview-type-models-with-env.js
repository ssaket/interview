#!/usr/bin/env node
/**
 * Test interview-type-specific hybrid model selection with environment variables
 *
 * This test demonstrates how environment variables override default models.
 * Run with: OLLAMA_HYBRID_MODEL_DSA=custom-model node tests/test-interview-type-models-with-env.js
 */

console.log('🧪 Testing Interview-Type-Specific Models with Environment Variables\n');

// Display current environment variables
console.log('📋 Current Environment Variables:');
console.log('─'.repeat(60));
console.log(`OLLAMA_HYBRID_MODEL:              ${process.env.OLLAMA_HYBRID_MODEL || '(not set)'}`);
console.log(`OLLAMA_HYBRID_MODEL_DSA:          ${process.env.OLLAMA_HYBRID_MODEL_DSA || '(not set)'}`);
console.log(`OLLAMA_HYBRID_MODEL_SYSTEM_DESIGN: ${process.env.OLLAMA_HYBRID_MODEL_SYSTEM_DESIGN || '(not set)'}`);
console.log(`OLLAMA_HYBRID_MODEL_LLD:          ${process.env.OLLAMA_HYBRID_MODEL_LLD || '(not set)'}`);
console.log();

// Load AIConfig AFTER environment is set
const AIConfig = require('../src/js/ai/ai-config');

console.log('📋 Resolved Models:');
console.log('─'.repeat(60));

const dsaModel = AIConfig.getHybridModelByType('ollama', 'dsa');
const systemDesignModel = AIConfig.getHybridModelByType('ollama', 'systemDesign');
const lldModel = AIConfig.getHybridModelByType('ollama', 'lld');
const fallbackModel = AIConfig.getHybridModel('ollama');

console.log(`DSA hybrid model:           ${dsaModel}`);
console.log(`System Design hybrid model: ${systemDesignModel}`);
console.log(`LLD hybrid model:           ${lldModel}`);
console.log(`General hybrid model:       ${fallbackModel}`);
console.log();

console.log('💡 Usage Examples:');
console.log('─'.repeat(60));
console.log('# Use Magistral for System Design, Qwen for DSA:');
console.log('OLLAMA_HYBRID_MODEL_SYSTEM_DESIGN=magistral node your-app.js');
console.log();
console.log('# Use custom models for all interview types:');
console.log('OLLAMA_HYBRID_MODEL_DSA=deepseek-coder-v2 \\');
console.log('OLLAMA_HYBRID_MODEL_SYSTEM_DESIGN=magistral \\');
console.log('OLLAMA_HYBRID_MODEL_LLD=magistral \\');
console.log('node your-app.js');
console.log();
console.log('# Override all with a single model:');
console.log('OLLAMA_HYBRID_MODEL=gpt-oss node your-app.js');
console.log();

console.log('✅ Test completed successfully!');
