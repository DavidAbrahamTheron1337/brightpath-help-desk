import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGeminiModel } from '../src/infrastructure/geminiModel.js';
import { ModelUnavailableError } from '../src/application/modelPort.js';

const TEST_KEY = 'test-key-not-real-123';
const REQUEST = { systemInstruction: 'Be brief.', input: 'Question?', responseSchema: { type: 'object' } };

// A stand-in for the internet: records each call and answers as told.
function fakeFetch(respond) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url: String(url), init });
    return respond(url, init);
  };
  fn.calls = calls;
  return fn;
}

const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('with no key set, the AI counts as unavailable and nothing is sent', async () => {
  const fetchFn = fakeFetch(() => jsonResponse(200, {}));
  const model = createGeminiModel({ apiKey: '', fetchFn });

  await assert.rejects(() => model.generate(REQUEST), ModelUnavailableError);
  assert.equal(fetchFn.calls.length, 0);
});

test('the key travels in a private header, never in the web address, with the documented request format', async () => {
  const fetchFn = fakeFetch(() =>
    jsonResponse(200, {
      status: 'completed',
      steps: [{ type: 'model_output', content: [{ type: 'text', text: '{"found":false}' }] }],
    }),
  );
  const model = createGeminiModel({ apiKey: TEST_KEY, model: 'gemini-test', fetchFn });

  await model.generate(REQUEST);

  const { url, init } = fetchFn.calls[0];
  assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
  assert.ok(!url.includes(TEST_KEY));
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['x-goog-api-key'], TEST_KEY);
  assert.equal(init.headers['Api-Revision'], '2026-05-20');
  assert.deepEqual(JSON.parse(init.body), {
    model: 'gemini-test',
    system_instruction: 'Be brief.',
    input: 'Question?',
    response_format: { type: 'text', mime_type: 'application/json', schema: { type: 'object' } },
    store: false,
  });
});

test('a refused call counts as unavailable, and the error never contains the key', async () => {
  for (const status of [400, 403, 429, 500, 503]) {
    const fetchFn = fakeFetch(() => jsonResponse(status, { error: { message: `echo ${TEST_KEY}` } }));
    const model = createGeminiModel({ apiKey: TEST_KEY, fetchFn });

    const error = await model.generate(REQUEST).then(
      () => assert.fail(`status ${status} should have failed`),
      (e) => e,
    );

    assert.ok(error instanceof ModelUnavailableError, `status ${status} gave ${error}`);
    assert.equal(error.message, `AI service refused the call (HTTP ${status})`);
    assert.ok(!String(error.stack).includes(TEST_KEY));
  }
});

test('a dropped connection or a slow AI counts as unavailable', async () => {
  const dropped = fakeFetch(() => {
    throw new TypeError('fetch failed');
  });
  const slow = fakeFetch((url, init) => {
    assert.ok(init.signal, 'every call must have a time limit');
    throw new DOMException('The operation timed out.', 'TimeoutError');
  });

  await assert.rejects(() => createGeminiModel({ apiKey: TEST_KEY, fetchFn: dropped }).generate(REQUEST), {
    name: 'ModelUnavailableError',
    message: 'Could not reach the AI service',
  });
  await assert.rejects(() => createGeminiModel({ apiKey: TEST_KEY, fetchFn: slow }).generate(REQUEST), {
    name: 'ModelUnavailableError',
    message: 'The AI service took too long to reply',
  });
});

test('a reply with no text in it counts as unavailable', async () => {
  const fetchFn = fakeFetch(() => jsonResponse(200, { status: 'failed', steps: [] }));

  await assert.rejects(() => createGeminiModel({ apiKey: TEST_KEY, fetchFn }).generate(REQUEST), {
    name: 'ModelUnavailableError',
    message: 'The AI service sent back an empty reply',
  });
});

test('the text of a completed reply is returned, skipping the AI\'s private thinking steps', async () => {
  const fetchFn = fakeFetch(() =>
    jsonResponse(200, {
      status: 'completed',
      steps: [
        { type: 'thought', content: [{ type: 'text', text: 'thinking...' }] },
        { type: 'model_output', content: [{ type: 'text', text: '{"found":true,' }, { type: 'text', text: '"x":1}' }] },
      ],
    }),
  );

  const text = await createGeminiModel({ apiKey: TEST_KEY, fetchFn }).generate(REQUEST);

  assert.equal(text, '{"found":true,"x":1}');
});
