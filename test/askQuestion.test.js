import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAskQuestion } from '../src/application/askQuestion.js';
import { ModelUnavailableError } from '../src/application/modelPort.js';
import { DOCUMENTS } from '../src/domain/documents.js';

// A stand-in for the outside AI service: records what it was sent and replies as told.
function fakeModel(reply) {
  const calls = [];
  return {
    calls,
    async generate(request) {
      calls.push(request);
      if (reply instanceof Error) throw reply;
      return reply;
    },
  };
}

test('an empty question is turned away without calling the AI', async () => {
  const model = fakeModel('unused');
  const ask = createAskQuestion({ model, documents: DOCUMENTS });

  const result = await ask('   ');

  assert.deepEqual(result, { status: 'invalid', answer: 'Please type a question.', sources: [] });
  assert.equal(model.calls.length, 0);
});

test('a question longer than 500 characters is turned away without calling the AI', async () => {
  const model = fakeModel('unused');
  const ask = createAskQuestion({ model, documents: DOCUMENTS });

  const atLimit = await ask('a'.repeat(500));
  const overLimit = await ask('a'.repeat(501));

  assert.notEqual(atLimit.status, 'invalid');
  assert.deepEqual(overLimit, {
    status: 'invalid',
    answer: 'Please keep your question under 500 characters.',
    sources: [],
  });
  assert.equal(model.calls.length, 1);
});

test('the AI is given all three documents, the question, and the reply format it must use', async () => {
  const model = fakeModel(JSON.stringify({ found: true, answer: 'Six.', source_ids: ['doc1'] }));
  const ask = createAskQuestion({ model, documents: DOCUMENTS });

  const result = await ask('How many lessons are in Foundations?');

  const sent = model.calls[0];
  assert.match(sent.input, /How many lessons are in Foundations\?/);
  for (const doc of DOCUMENTS) {
    assert.ok(sent.input.includes(`[${doc.id}] ${doc.title}`), `missing heading for ${doc.id}`);
    assert.ok(sent.input.includes(doc.text), `missing text of ${doc.id}`);
  }
  assert.match(sent.systemInstruction, /only/i);
  assert.deepEqual(sent.responseSchema.required, ['found', 'answer', 'source_ids']);
  assert.deepEqual(result.sources, [{ id: 'doc1', title: 'Document 1 — Getting started' }]);
});

test('when the AI cannot be reached, the person gets a clear "not available" message', async () => {
  const model = fakeModel(new ModelUnavailableError('AI service replied 503'));
  const ask = createAskQuestion({ model, documents: DOCUMENTS });

  const result = await ask('When is group coaching?');

  assert.deepEqual(result, {
    status: 'unavailable',
    answer:
      'The AI service is not available right now, so I cannot answer. Please try again in a minute.',
    sources: [],
  });
});

test('a fault that is not an AI outage is not hidden behind the outage message', async () => {
  const model = fakeModel(new TypeError('bug in our own code'));
  const ask = createAskQuestion({ model, documents: DOCUMENTS });

  await assert.rejects(() => ask('When is group coaching?'), TypeError);
});
