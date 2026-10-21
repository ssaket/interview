/**
 * Test Suite: Streaming Performance & Integrity
 *
 * Runs the real provider handlers against a mocked HTTP stream (no network):
 * 1. SSE / NDJSON lines split across network chunks are reassembled, not dropped
 * 2. Multi-byte characters split across chunks are not garbled
 * 3. A flow sends only its real requests - no availability pings when switching provider
 * 4. The local-model OCR cleanup pass is skipped for DeepSeek-only flows
 */

const { PassThrough } = require('stream');
const axios = require('axios');
const simpleAI = require('../src/js/ai/simple-ai');
const aiConfig = require('../src/js/ai/ai-config');
const SimpleAIManager = require('../src/js/ai/simple-ai-manager');

let failures = 0;
let requests = [];

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

/** Split a payload into byte chunks at the given offsets */
function splitAt(payload, offsets) {
  const bytes = Buffer.from(payload, 'utf8');
  const chunks = [];
  let start = 0;
  for (const offset of offsets) {
    chunks.push(bytes.subarray(start, offset));
    start = offset;
  }
  chunks.push(bytes.subarray(start));
  return chunks;
}

/** Offset that lands inside the multi-byte encoding of `char` */
function insideChar(payload, char) {
  return Buffer.from(payload.slice(0, payload.indexOf(char)), 'utf8').length + 1;
}

/** Make every axios.post return a stream that emits the given chunks */
function mockStream(chunksForRequest) {
  requests = [];
  axios.post = async (url, body) => {
    requests.push({ url, body });
    const stream = new PassThrough();
    const chunks = chunksForRequest(body);
    setImmediate(() => {
      for (const chunk of chunks) stream.write(chunk);
      stream.end();
    });
    return { data: stream };
  };
}

function sse(...contents) {
  return (
    contents
      .map((c) => `data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`)
      .join('') + 'data: [DONE]\n\n'
  );
}

async function run() {
  console.log('🧪 TESTING: Streaming Performance & Integrity');
  console.log('=============================================\n');

  aiConfig.updateProviderConfig('deepseek', { apiKey: 'test-key' });

  await test('DeepSeek: lines and characters split across chunks are reassembled', async () => {
    const payload = sse('Two pointers → O(n)', ' with the map', ' — done');
    // Split mid-JSON on the first line and inside the "→" and "—" byte sequences
    mockStream(() => splitAt(payload, [20, insideChar(payload, '→'), insideChar(payload, '—')]));

    const streamed = [];
    const response = await simpleAI.chatCompletion({
      provider: 'deepseek',
      messages: [{ role: 'user', content: 'q' }],
      stream: true,
      onChunk: (c) => streamed.push(c),
      flowType: 'cloud',
    });

    const expected = 'Two pointers → O(n) with the map — done';
    assert(response.choices[0].message.content === expected, `content was "${response.choices[0].message.content}"`);
    assert(streamed.join('') === expected, `streamed text was "${streamed.join('')}"`);
  });

  await test('Ollama: NDJSON lines and characters split across chunks are reassembled', async () => {
    const payload = [
      { message: { content: 'Use a heap → ' }, done: false },
      { message: { content: 'k log n' }, done: false },
      { message: { content: '' }, done: true },
    ]
      .map((line) => JSON.stringify(line) + '\n')
      .join('');
    mockStream(() => splitAt(payload, [15, insideChar(payload, '→'), payload.length - 5]));

    const streamed = [];
    const response = await simpleAI.chatCompletion({
      provider: 'ollama',
      messages: [{ role: 'user', content: 'q' }],
      stream: true,
      onChunk: (c) => streamed.push(c),
    });

    const expected = 'Use a heap → k log n';
    assert(response.choices[0].message.content === expected, `content was "${response.choices[0].message.content}"`);
    assert(streamed.join('') === expected, `streamed text was "${streamed.join('')}"`);
  });

  await test('PRACTICE flow from Ollama sends exactly one request (no pings)', async () => {
    mockStream(() => [sse('### Hint 1')]);
    const manager = new SimpleAIManager({ windowManager: { send: () => {} } });
    manager._useProvider('ollama');

    await manager.ask('problem', { flow: 'practice', onChunk: () => {} });

    assert(requests.length === 1, `expected 1 request, got ${requests.length}`);
    assert(requests[0].url.includes('/chat/completions'), 'request was not the DeepSeek call');
    assert(manager.getCurrentProvider() === 'ollama', 'provider not restored after the flow');
  });

  await test('CLOUD flow from Ollama sends exactly its three phase requests', async () => {
    mockStream(() => [sse('answer')]);
    const manager = new SimpleAIManager({ windowManager: { send: () => {} } });
    manager._useProvider('ollama');

    await manager.ask('problem', { flow: 'cloud', onChunk: () => {} });

    assert(requests.length === 3, `expected 3 requests, got ${requests.length}`);
    assert(
      requests.every((r) => r.body.messages.at(-1).content !== 'ping'),
      'a ping request was sent'
    );
  });

  await test('AI OCR cleanup runs only for flows that use a local model', () => {
    const manager = new SimpleAIManager({ windowManager: { send: () => {} } });
    const expected = { local: true, hybrid: true, cloud: false, steps: false, practice: false };
    for (const [flow, usesLocal] of Object.entries(expected)) {
      assert(manager.flowUsesLocalModel(flow) === usesLocal, `${flow} returned ${!usesLocal}`);
    }
    assert(manager.flowUsesLocalModel(undefined) === true, 'unknown flow should keep the cleanup');
  });

  console.log('');
  if (failures > 0) {
    console.error(`❌ ${failures} streaming test(s) failed`);
    process.exit(1);
  }
  console.log('🎉 All streaming tests passed');
}

run();
