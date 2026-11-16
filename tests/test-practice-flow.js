/**
 * Test Suite: Practice Flow
 *
 * Verifies the guided-practice flow without calling any AI provider:
 * 1. Practice prompts exist for every interview type and reference the shortcut phrases
 * 2. ask({ flow: 'practice' }) runs one non-thinking DeepSeek phase in its own session
 * 3. NEXT HINT and REVEAL SOLUTION get the solution token cap; a new problem keeps the tighter cap
 * 4. Practice sessions show up in getSession() for the history viewer
 * 5. Provider failures are returned as an inline error, not thrown
 */

const MODEL_PROMPTS = require('../src/js/model-prompts');
const SimpleAIManager = require('../src/js/ai/simple-ai-manager');
const aiConfig = require('../src/js/ai/ai-config');

const { INTERVIEW_TYPES, PRACTICE_REQUESTS } = MODEL_PROMPTS;

let failures = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    failures++;
    console.error(`❌ ${name}\n   ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** Manager with _executePhase stubbed to record calls instead of hitting the network */
function createManager() {
  const manager = new SimpleAIManager({ windowManager: { send: () => {} } });
  manager.calls = [];
  manager._executePhase = async (question, phaseConfig, options) => {
    manager.calls.push({ question, phaseConfig, options });
    return `stub answer for: ${question}`;
  };
  // Keep the test offline - provider switches only matter for real requests
  manager._restoreState = async () => {};
  return manager;
}

async function run() {
  console.log('🧪 TESTING: Practice Flow');
  console.log('=========================\n');

  await test('practice prompt exists for every interview type', () => {
    for (const type of Object.values(INTERVIEW_TYPES)) {
      const prompt = MODEL_PROMPTS.getPracticePrompt(type);
      assert(typeof prompt === 'string' && prompt.length > 200, `missing prompt for ${type}`);
      assert(prompt.includes('Hint 1'), `${type} prompt has no hint ladder`);
    }
  });

  await test('practice prompts differ per interview type', () => {
    const prompts = Object.values(INTERVIEW_TYPES).map((t) => MODEL_PROMPTS.getPracticePrompt(t));
    assert(new Set(prompts).size === prompts.length, 'interview types share a prompt');
  });

  await test('practice prompts reference the exact shortcut phrases', () => {
    for (const type of Object.values(INTERVIEW_TYPES)) {
      const prompt = MODEL_PROMPTS.getPracticePrompt(type);
      assert(prompt.includes(`"${PRACTICE_REQUESTS.hint}"`), `${type} prompt lacks hint phrase`);
      assert(prompt.includes(`"${PRACTICE_REQUESTS.reveal}"`), `${type} prompt lacks reveal phrase`);
    }
  });

  await test('unknown interview type falls back to DSA practice prompt', () => {
    assert(
      MODEL_PROMPTS.getPracticePrompt('unknown') ===
        MODEL_PROMPTS.getPracticePrompt(INTERVIEW_TYPES.DSA),
      'fallback is not the DSA prompt'
    );
  });

  await test('practice flow runs a single non-thinking DeepSeek phase', async () => {
    const manager = createManager();
    const response = await manager.ask('Two Sum: find indices adding to target', {
      flow: 'practice',
    });

    assert(manager.calls.length === 1, `expected 1 phase, got ${manager.calls.length}`);
    const { phaseConfig } = manager.calls[0];
    assert(phaseConfig.provider === 'deepseek', `provider was ${phaseConfig.provider}`);
    assert(!aiConfig.isThinkingFlow('deepseek', phaseConfig.flowType), 'phase uses thinking mode');
    assert(phaseConfig.sessionKey.includes('-practice-'), 'session key not practice-scoped');
    assert(response.startsWith('stub answer'), 'response not returned from phase');
  });

  await test('practice phase uses the practice prompt for the current interview type', async () => {
    const manager = createManager();
    manager.cycleInterviewType(); // DSA -> System Design
    await manager.ask('Design a URL shortener', { flow: 'practice' });

    const { phaseConfig } = manager.calls[0];
    assert(
      phaseConfig.promptGetter(manager.getCurrentInterviewType()) ===
        MODEL_PROMPTS.getPracticePrompt(INTERVIEW_TYPES.SYSTEM_DESIGN),
      'prompt getter does not return the system design practice prompt'
    );
  });

  await test('practice prompts cap the ladder at 3 hints, then the solution', () => {
    for (const type of Object.values(INTERVIEW_TYPES)) {
      const prompt = MODEL_PROMPTS.getPracticePrompt(type);
      assert(prompt.includes('Hint 3 (last hint)'), `${type} prompt has no last hint`);
      assert(prompt.includes('There is no Hint 4'), `${type} prompt does not cap the ladder`);
      assert(!/^Hint 4/m.test(prompt), `${type} prompt has a Hint 4 step`);
      // Counting responses breaks when a review or a new problem comes between hints
      assert(!/\d(st|nd|rd|th) response/.test(prompt), `${type} prompt counts responses`);
      assert(prompt.includes('a review is not a hint'), `${type} prompt counts reviews as hints`);
    }
  });

  await test('practice prompts ask for Go, not Python', () => {
    for (const type of [INTERVIEW_TYPES.DSA, INTERVIEW_TYPES.LLD]) {
      const prompt = MODEL_PROMPTS.getPracticePrompt(type);
      assert(prompt.includes('Go'), `${type} prompt does not ask for Go`);
      assert(!/python|# TODO/i.test(prompt), `${type} prompt still asks for Python`);
    }
  });

  await test('a new problem (Hint 1) keeps the tighter token cap', async () => {
    const manager = createManager();
    await manager.ask('Two Sum: find indices adding to target', { flow: 'practice' });

    const { phaseConfig, options } = manager.calls[0];
    const maxTokens = { ...phaseConfig.parameters, ...options.parameters }.max_tokens;
    assert(maxTokens === 2048, `Hint 1 max_tokens was ${maxTokens}`);
  });

  await test('NEXT HINT gets the solution cap (the 4th response is the solution)', async () => {
    const manager = createManager();
    await manager.ask(PRACTICE_REQUESTS.hint, { flow: 'practice' });

    const { phaseConfig, options } = manager.calls[0];
    const maxTokens = { ...phaseConfig.parameters, ...options.parameters }.max_tokens;
    assert(maxTokens === 4096, `hint max_tokens was ${maxTokens}`);
  });

  await test('REVEAL SOLUTION raises the token cap', async () => {
    const manager = createManager();
    await manager.ask(PRACTICE_REQUESTS.reveal, { flow: 'practice' });

    const { phaseConfig, options } = manager.calls[0];
    const maxTokens = { ...phaseConfig.parameters, ...options.parameters }.max_tokens;
    assert(maxTokens === 4096, `reveal max_tokens was ${maxTokens}`);
  });

  await test('practice session appears in getSession() history', () => {
    const manager = createManager();
    const session = manager._getOrCreateSession('deepseek-practice-coach:deepseek-v4-pro');
    session.messages.push(
      { role: 'system', content: 'practice prompt' },
      { role: 'user', content: 'problem' },
      { role: 'assistant', content: '### Hint 1' }
    );

    const { history, active } = manager.getSession();
    assert(active, 'session not active');
    assert(history.length === 2, `expected 2 non-system messages, got ${history.length}`);
  });

  await test('provider failure is returned inline, not thrown', async () => {
    const manager = createManager();
    manager._executePhase = async () => {
      throw new Error('DeepSeek API key missing');
    };
    const chunks = [];
    const response = await manager.ask('problem', {
      flow: 'practice',
      onChunk: (chunk) => chunks.push(chunk),
    });

    assert(response.includes('Practice Flow Error'), 'error prefix missing from response');
    assert(chunks.join('').includes('DeepSeek API key missing'), 'error not streamed to UI');
  });

  console.log('');
  if (failures > 0) {
    console.error(`❌ ${failures} practice flow test(s) failed`);
    process.exit(1);
  }
  console.log('🎉 All practice flow tests passed');
}

run();
