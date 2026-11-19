/**
 * Test Suite: OpenAI Provider (official `openai` SDK)
 *
 * Runs the real SDK against a local mock of the Chat Completions API, so no API key or
 * network is needed:
 * 1. Streaming and non-streaming requests return the standard response shape
 * 2. The request body: max_completion_tokens, and no sampling parameters for reasoning models
 * 3. API errors, an empty answer at the token limit, and a cancel become clear messages
 * 4. The INTERVIEW flow streams an OpenAI answer end to end
 */

const http = require('http');
const simpleAI = require('../src/js/ai/simple-ai');
const aiConfig = require('../src/js/ai/ai-config');
const SimpleAIManager = require('../src/js/ai/simple-ai-manager');
const MODEL_PROMPTS = require('../src/js/model-prompts');

let failures = 0;
let lastRequest = null;
let respond = null; // (req, res, body) => void - set by each test

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

async function expectError(fn, includes) {
  try {
    await fn();
  } catch (error) {
    assert(error.message.includes(includes), `error "${error.message}" lacks "${includes}"`);
    return error;
  }
  throw new Error(`expected an error that includes "${includes}"`);
}

function chunk(content, finishReason = null) {
  return {
    id: 'chatcmpl-test',
    object: 'chat.completion.chunk',
    created: 0,
    model: 'test',
    choices: [
      {
        index: 0,
        delta: content === null ? {} : { content },
        finish_reason: finishReason,
      },
    ],
  };
}

function ssePayload(events) {
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('') + 'data: [DONE]\n\n';
}

function sendError(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: { message, type: 'invalid_request_error', code: null } }));
}

function chat(parameters = {}, options = {}) {
  return simpleAI.chatCompletion({
    provider: 'openai',
    messages: [{ role: 'user', content: 'candidate code' }],
    parameters,
    ...options,
  });
}

async function run() {
  console.log('🧪 TESTING: OpenAI Provider (SDK)');
  console.log('=================================\n');

  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (data) => (raw += data));
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : null;
      lastRequest = { url: req.url, headers: req.headers, body };
      respond(req, res, body);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/v1`;

  const useModel = (model) =>
    aiConfig.updateProviderConfig('openai', {
      apiKey: 'test-key',
      baseUrl,
      model,
      reasoningEffort: 'low',
    });

  await test('streaming request streams chunks in order and returns the full answer', async () => {
    useModel('gpt-6.1-terra');
    respond = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const payload = ssePayload([chunk('### Follow'), chunk('-ups\n1. '), chunk(null, 'stop')]);
      // Split mid-line: the SDK must join the halves of one event
      const middle = Math.floor(payload.length / 2);
      res.write(payload.slice(0, middle));
      setTimeout(() => res.end(payload.slice(middle)), 10);
    };

    const chunks = [];
    const response = await chat({}, { stream: true, onChunk: (text) => chunks.push(text) });

    assert(chunks.join('') === '### Follow-ups\n1. ', `chunks were ${JSON.stringify(chunks)}`);
    assert(
      response.choices[0].message.content === '### Follow-ups\n1. ',
      'content does not match the chunks'
    );
    assert(response.provider === 'openai', `provider was ${response.provider}`);
    assert(lastRequest.url === '/v1/chat/completions', `path was ${lastRequest.url}`);
    assert(lastRequest.headers.authorization === 'Bearer test-key', 'API key not sent');
    assert(lastRequest.body.stream === true, 'stream flag not sent');
  });

  await test('reasoning models: no sampling parameters, max_completion_tokens, reasoning_effort', async () => {
    respond = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.end(ssePayload([chunk('ok', 'stop')]));
    };

    for (const model of ['gpt-6.1-terra', 'gpt-5-mini', 'o4-mini']) {
      useModel(model);
      await chat(
        { temperature: 0.4, top_p: 0.9, presence_penalty: 0.1, max_tokens: 4096 },
        { stream: true, onChunk: () => {} }
      );

      const { body } = lastRequest;
      for (const field of ['temperature', 'top_p', 'presence_penalty', 'max_tokens']) {
        assert(!(field in body), `${model}: ${field} sent to a reasoning model`);
      }
      assert(body.model === model, `model was ${body.model}`);
      assert(
        body.reasoning_effort === 'low',
        `${model}: reasoning_effort was ${body.reasoning_effort}`
      );
    }
    const { body } = lastRequest;
    assert(
      body.max_completion_tokens === 4096,
      `max_completion_tokens was ${body.max_completion_tokens}`
    );
  });

  await test('non-reasoning models keep temperature and get no reasoning_effort', async () => {
    respond = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.end(ssePayload([chunk('ok', 'stop')]));
    };

    for (const model of ['gpt-4.1', 'gpt-5-chat-latest']) {
      useModel(model);
      await chat({ temperature: 0.4, max_tokens: 2048 }, { stream: true, onChunk: () => {} });
      const { body } = lastRequest;
      assert(body.temperature === 0.4, `${model}: temperature was ${body.temperature}`);
      assert(!('reasoning_effort' in body), `${model}: reasoning_effort sent`);
      assert(!('max_tokens' in body), `${model}: deprecated max_tokens sent`);
      assert(
        body.max_completion_tokens === 2048,
        `${model}: cap was ${body.max_completion_tokens}`
      );
    }
  });

  await test('non-streaming request returns the standard response shape', async () => {
    useModel('gpt-4.1');
    respond = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          id: 'chatcmpl-test',
          object: 'chat.completion',
          created: 0,
          model: 'gpt-4.1',
          choices: [
            { index: 0, message: { role: 'assistant', content: 'pong' }, finish_reason: 'stop' },
          ],
        })
      );
    };

    const response = await chat({ max_tokens: 1 });
    assert(response.choices[0].message.content === 'pong', 'content missing');
    assert(response.provider === 'openai', `provider was ${response.provider}`);
    assert(lastRequest.body.stream === false, 'non-streaming request sent stream: true');
  });

  await test('API errors become clear messages', async () => {
    useModel('gpt-6.1-terra');
    respond = (req, res) => sendError(res, 401, 'Incorrect API key provided');
    await expectError(() => chat(), 'Invalid openai API key');

    respond = (req, res) => sendError(res, 404, 'The model does not exist');
    const notFound = await expectError(() => chat(), 'gpt-6.1-terra');
    assert(notFound.message.includes('OPENAI_INTERVIEW_MODEL'), '404 does not name the env var');

    respond = (req, res) => sendError(res, 400, 'Unsupported parameter: foo');
    await expectError(() => chat(), 'bad request: Unsupported parameter: foo');
  });

  await test('an empty answer at the token limit is an error, not a blank response', async () => {
    useModel('gpt-6.1-terra');
    respond = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.end(ssePayload([chunk(null), chunk(null, 'length')]));
    };
    await expectError(() => chat({}, { stream: true, onChunk: () => {} }), 'token limit');
  });

  await test('a cancel during the stream is an error, not a partial answer', async () => {
    useModel('gpt-6.1-terra');
    let timer = null;
    respond = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write(`data: ${JSON.stringify(chunk('partial'))}\n\n`);
      timer = setTimeout(() => res.end(ssePayload([chunk(' rest', 'stop')])), 2000);
      res.on('close', () => clearTimeout(timer));
    };

    const controller = new AbortController();
    await expectError(
      () =>
        chat(
          {},
          {
            stream: true,
            signal: controller.signal,
            onChunk: () => controller.abort(),
          }
        ),
      'canceled'
    );
    clearTimeout(timer);
  });

  await test('a missing API key names OPENAI_API_KEY', async () => {
    aiConfig.updateProviderConfig('openai', { apiKey: undefined });
    await expectError(() => chat(), 'OPENAI_API_KEY');
  });

  await test('INTERVIEW flow streams an OpenAI answer end to end', async () => {
    useModel('gpt-6.1-terra');
    respond = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.end(ssePayload([chunk('### Follow-ups\n'), chunk('1. **Ask:** ...', 'stop')]));
    };

    const manager = new SimpleAIManager({ windowManager: { send: () => {} } });
    const chunks = [];
    const response = await manager.ask('func twoSum(nums []int) {}', {
      flow: 'interview',
      onChunk: (text) => chunks.push(text),
    });

    assert(response === '### Follow-ups\n1. **Ask:** ...', `response was ${response}`);
    assert(chunks.join('') === response, 'streamed text differs from the response');
    const { body } = lastRequest;
    assert(body.model === aiConfig.getFlowModel('openai', 'interview'), `model was ${body.model}`);
    assert(
      body.messages[0].content === MODEL_PROMPTS.getInterviewPrompt('dsa'),
      'system prompt is not the DSA interview prompt'
    );
    assert(body.max_completion_tokens === 4096, `cap was ${body.max_completion_tokens}`);
  });

  server.closeAllConnections();
  server.close();

  console.log('');
  if (failures > 0) {
    console.error(`❌ ${failures} OpenAI provider test(s) failed`);
    process.exit(1);
  }
  console.log('🎉 All OpenAI provider tests passed');
  process.exit(0);
}

run();
