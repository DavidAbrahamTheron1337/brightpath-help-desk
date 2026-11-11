import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAskHandler } from '../src/host/askHandler.js';

const REAL_KEY = 'real-key-not-real-456';

// A stand-in for Google: answers every call with the given status and AI text.
function fakeGoogle(status, aiText) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url: String(url), init });
    const body =
      status === 200
        ? { status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: aiText }] }] }
        : { error: { message: 'API key not valid' } };
    return new Response(JSON.stringify(body), { status });
  };
  fn.calls = calls;
  return fn;
}

const post = (body) =>
  new Request('http://localhost/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

test('a question gets the answer and the document it came from', async () => {
  const fetchFn = fakeGoogle(200, JSON.stringify({ found: true, answer: 'Every Tuesday at 16:00 UTC.', source_ids: ['doc2'] }));
  const handle = createAskHandler({ env: { GEMINI_API_KEY: REAL_KEY }, fetchFn });

  const response = await handle(post({ question: 'When is group coaching?' }));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: 'answered',
    answer: 'Every Tuesday at 16:00 UTC.',
    sources: [{ id: 'doc2', title: 'Document 2 — Coaching and feedback' }],
  });
});

test('"simulate outage" makes a real call with a wrong key, shows the clear message, and never uses the real key', async () => {
  const fetchFn = fakeGoogle(400);
  const handle = createAskHandler({ env: { GEMINI_API_KEY: REAL_KEY }, fetchFn });

  const response = await handle(post({ question: 'When is group coaching?', simulateOutage: true }));
  const text = await response.text();

  assert.equal(response.status, 503);
  assert.deepEqual(JSON.parse(text), {
    status: 'unavailable',
    answer: 'The AI service is not available right now, so I cannot answer. Please try again in a minute.',
    sources: [],
  });
  assert.equal(fetchFn.calls.length, 1, 'a real call is still made, so the failure is genuine');
  assert.equal(fetchFn.calls[0].init.headers['x-goog-api-key'], 'simulated-outage-wrong-key');
  assert.ok(!JSON.stringify(fetchFn.calls[0]).includes(REAL_KEY));
  assert.ok(!text.includes(REAL_KEY));
});

test('requests the help desk cannot use get a clear refusal, not a crash', async () => {
  const fetchFn = fakeGoogle(200, 'unused');
  const handle = createAskHandler({ env: { GEMINI_API_KEY: REAL_KEY }, fetchFn });

  const wrongMethod = await handle(new Request('http://localhost/api/ask', { method: 'GET' }));
  const brokenBody = await handle(post('{not json'));
  const emptyQuestion = await handle(post({ question: '' }));

  assert.equal(wrongMethod.status, 405);
  assert.deepEqual(await wrongMethod.json(), { status: 'invalid', answer: 'Send questions with POST.', sources: [] });
  assert.equal(brokenBody.status, 400);
  assert.deepEqual(await brokenBody.json(), { status: 'invalid', answer: 'Please type a question.', sources: [] });
  assert.equal(emptyQuestion.status, 400);
  assert.equal(fetchFn.calls.length, 0);
});

test('an AI reply that cannot be checked is reported as a bad reply from the AI service', async () => {
  const fetchFn = fakeGoogle(200, 'Sure! Tuesday.');
  const handle = createAskHandler({ env: { GEMINI_API_KEY: REAL_KEY }, fetchFn });

  const response = await handle(post({ question: 'When is group coaching?' }));

  assert.equal(response.status, 502);
  assert.equal((await response.json()).status, 'unreliable');
});
