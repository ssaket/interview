/**
 * Test Suite: Interview Flow
 *
 * Verifies the INTERVIEW flow (I am the interviewer) without calling any AI provider:
 * 1. Interview prompts exist for every interview type and reference the shortcut phrase
 * 2. ask({ flow: 'interview' }) runs one OpenAI phase in its own session
 * 3. The flow uses OPENAI_INTERVIEW_MODEL, then OPENAI_MODEL, then the default model
 * 4. The flow skips the local-model OCR pass and shows up in getSession()
 * 5. Provider failures are returned as an inline error, not thrown
 */

const MODEL_PROMPTS = require('../src/js/model-prompts');
const SimpleAIManager = require('../src/js/ai/simple-ai-manager');
const simpleAI = require('../src/js/ai/simple-ai');
const aiConfig = require('../src/js/ai/ai-config');

const { INTERVIEW_TYPES, INTERVIEW_REQUESTS, PRACTICE_REQUESTS } = MODEL_PROMPTS;

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

/** Run fn with the given OpenAI env vars, then restore the env and the config */
async function withOpenAIEnv(env, fn) {
  const keys = ['OPENAI_INTERVIEW_MODEL', 'OPENAI_MODEL'];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const key of keys) {
      if (env[key] === undefined) delete process.env[key];
      else process.env[key] = env[key];
    }
    aiConfig.reset();
    await fn();
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    aiConfig.reset();
  }
}

async function run() {
  console.log('🧪 TESTING: Interview Flow');
  console.log('==========================\n');

  await test('interview prompt exists for every interview type', () => {
    for (const type of Object.values(INTERVIEW_TYPES)) {
      const prompt = MODEL_PROMPTS.getInterviewPrompt(type);
      assert(typeof prompt === 'string' && prompt.length > 200, `missing prompt for ${type}`);
      assert(prompt.includes('### Follow-ups'), `${type} prompt has no Follow-ups heading`);
      assert(prompt.includes('### Problem Brief'), `${type} prompt has no Problem Brief heading`);
    }
  });

  await test('interview prompts differ per interview type', () => {
    const prompts = Object.values(INTERVIEW_TYPES).map((t) => MODEL_PROMPTS.getInterviewPrompt(t));
    assert(new Set(prompts).size === prompts.length, 'interview types share a prompt');
  });

  await test('interview prompts give each question a reason and a strong answer', () => {
    for (const type of Object.values(INTERVIEW_TYPES)) {
      const prompt = MODEL_PROMPTS.getInterviewPrompt(type);
      for (const field of ['**Ask:**', '**Why:**', '**Strong answer:**']) {
        assert(prompt.includes(field), `${type} prompt lacks ${field}`);
      }
      assert(prompt.includes('I am the INTERVIEWER'), `${type} prompt does not set the role`);
      assert(prompt.includes('Do NOT'), `${type} prompt does not forbid solving for the candidate`);
    }
  });

  await test('interview prompts reference the exact shortcut phrase', () => {
    for (const type of Object.values(INTERVIEW_TYPES)) {
      const prompt = MODEL_PROMPTS.getInterviewPrompt(type);
      assert(prompt.includes(`"${INTERVIEW_REQUESTS.more}"`), `${type} prompt lacks the phrase`);
    }
  });

  await test('interview phrase differs from the practice phrases', () => {
    assert(
      !Object.values(PRACTICE_REQUESTS).includes(INTERVIEW_REQUESTS.more),
      'interview and practice share a shortcut phrase'
    );
  });

  await test('unknown interview type falls back to DSA interview prompt', () => {
    assert(
      MODEL_PROMPTS.getInterviewPrompt('unknown') ===
        MODEL_PROMPTS.getInterviewPrompt(INTERVIEW_TYPES.DSA),
      'fallback is not the DSA prompt'
    );
  });

  await test('interview flow runs a single OpenAI phase in its own session', async () => {
    const manager = createManager();
    const response = await manager.ask('func twoSum(nums []int, target int) []int {', {
      flow: 'interview',
    });

    assert(manager.calls.length === 1, `expected 1 phase, got ${manager.calls.length}`);
    const { phaseConfig } = manager.calls[0];
    assert(phaseConfig.provider === 'openai', `provider was ${phaseConfig.provider}`);
    assert(phaseConfig.flowType === 'interview', `flowType was ${phaseConfig.flowType}`);
    assert(phaseConfig.sessionKey.includes('-interview-'), 'session key not interview-scoped');
    assert(response.startsWith('stub answer'), 'response not returned from phase');
  });

  await test('interview phase uses the prompt for the current interview type', async () => {
    const manager = createManager();
    manager.cycleInterviewType(); // DSA -> System Design
    await manager.ask('Load balancer -> app servers -> Postgres', { flow: 'interview' });

    const { phaseConfig } = manager.calls[0];
    assert(
      phaseConfig.promptGetter(manager.getCurrentInterviewType()) ===
        MODEL_PROMPTS.getInterviewPrompt(INTERVIEW_TYPES.SYSTEM_DESIGN),
      'prompt getter does not return the system design interview prompt'
    );
  });

  await test('MORE FOLLOW-UPS goes to the same phase with the same token cap', async () => {
    const manager = createManager();
    await manager.ask('candidate code', { flow: 'interview' });
    await manager.ask(INTERVIEW_REQUESTS.more, { flow: 'interview' });

    const [first, more] = manager.calls;
    assert(more.phaseConfig === first.phaseConfig, 'follow-up request used a different phase');
    const maxTokens = { ...more.phaseConfig.parameters, ...more.options.parameters }.max_tokens;
    assert(maxTokens === 4096, `max_tokens was ${maxTokens}`);
  });

  await test('interview model: OPENAI_INTERVIEW_MODEL, then OPENAI_MODEL, then default', async () => {
    await withOpenAIEnv({ OPENAI_INTERVIEW_MODEL: 'office-model', OPENAI_MODEL: 'other' }, () => {
      const model = aiConfig.getFlowModel('openai', 'interview');
      assert(model === 'office-model', `expected office-model, got ${model}`);
    });
    await withOpenAIEnv({ OPENAI_MODEL: 'office-default' }, () => {
      const model = aiConfig.getFlowModel('openai', 'interview');
      assert(model === 'office-default', `expected office-default, got ${model}`);
    });
    await withOpenAIEnv({}, () => {
      const model = aiConfig.getFlowModel('openai', 'interview');
      assert(model === 'gpt-6.1-terra', `expected gpt-6.1-terra, got ${model}`);
    });
  });

  await test('interview flow skips the local-model OCR pass', () => {
    const manager = createManager();
    assert(manager.flowUsesLocalModel('interview') === false, 'interview flow uses Ollama');
  });

  await test('real phase sends the interview prompt and model to OpenAI, then restores state', async () => {
    const manager = new SimpleAIManager({ windowManager: { send: () => {} } });
    const before = manager.getProviderInfo();
    const originalChatCompletion = simpleAI.chatCompletion;
    let request = null;
    simpleAI.chatCompletion = async (options) => {
      request = { ...options, model: aiConfig.getProviderConfig(options.provider).model };
      return { choices: [{ message: { role: 'assistant', content: '### Follow-ups' } }] };
    };

    try {
      const response = await manager.ask('candidate code', { flow: 'interview' });
      assert(response === '### Follow-ups', `response was ${response}`);
    } finally {
      simpleAI.chatCompletion = originalChatCompletion;
    }

    assert(request.provider === 'openai', `provider was ${request.provider}`);
    assert(
      request.model === aiConfig.getFlowModel('openai', 'interview'),
      `model was ${request.model}`
    );
    assert(request.messages[0].role === 'system', 'first message is not the system prompt');
    assert(
      request.messages[0].content === MODEL_PROMPTS.getInterviewPrompt(INTERVIEW_TYPES.DSA),
      'system prompt is not the DSA interview prompt'
    );
    assert(request.stream === true, 'request does not stream');
    const after = manager.getProviderInfo();
    assert(after.name === before.name, `provider not restored: ${after.name}`);
  });

  await test('interview session appears in getSession() history', () => {
    const manager = createManager();
    const session = manager._getOrCreateSession('openai-interview-followups:gpt-6.1-terra');
    session.messages.push(
      { role: 'system', content: 'interview prompt' },
      { role: 'user', content: 'candidate code' },
      { role: 'assistant', content: '### Follow-ups' }
    );

    const { history, active } = manager.getSession();
    assert(active, 'session not active');
    assert(history.length === 2, `expected 2 non-system messages, got ${history.length}`);
  });

  await test('provider failure is returned inline, not thrown', async () => {
    const manager = createManager();
    manager._executePhase = async () => {
      throw new Error('OpenAI API key is required. Set OPENAI_API_KEY in .env');
    };
    const chunks = [];
    const response = await manager.ask('candidate code', {
      flow: 'interview',
      onChunk: (chunk) => chunks.push(chunk),
    });

    assert(response.includes('Interview Flow Error'), 'error prefix missing from response');
    assert(chunks.join('').includes('OPENAI_API_KEY'), 'error not streamed to UI');
  });

  console.log('');
  if (failures > 0) {
    console.error(`❌ ${failures} interview flow test(s) failed`);
    process.exit(1);
  }
  console.log('🎉 All interview flow tests passed');
}

run();
