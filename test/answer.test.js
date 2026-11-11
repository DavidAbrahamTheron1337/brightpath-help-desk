import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretModelReply } from '../src/domain/answer.js';
import { DOCUMENTS } from '../src/domain/documents.js';

const reply = (obj) => JSON.stringify(obj);

test('a reply that cites a known document is shown with that document as its source', () => {
  const result = interpretModelReply(
    reply({ found: true, answer: 'Every Tuesday at 16:00 UTC.', source_ids: ['doc2'] }),
    DOCUMENTS,
  );

  assert.deepEqual(result, {
    status: 'answered',
    answer: 'Every Tuesday at 16:00 UTC.',
    sources: [{ id: 'doc2', title: 'Document 2 — Coaching and feedback' }],
  });
});

const NOT_FOUND = {
  status: 'not_found',
  answer:
    'That information is not in the BrightPath help documents, so I cannot answer it. ' +
    'Please contact support at support@brightpath.example.',
  sources: [],
};

test('a reply saying the documents do not cover it gives the fixed "not in the documents" message', () => {
  const result = interpretModelReply(reply({ found: false, answer: '', source_ids: [] }), DOCUMENTS);

  assert.deepEqual(result, NOT_FOUND);
});

test('an answer that cites a document which does not exist is not shown', () => {
  const result = interpretModelReply(
    reply({ found: true, answer: 'Refunds take 5 days.', source_ids: ['doc9'] }),
    DOCUMENTS,
  );

  assert.deepEqual(result, NOT_FOUND);
});

test('an answer that cites no document at all is not shown', () => {
  const result = interpretModelReply(
    reply({ found: true, answer: 'The course costs $49.', source_ids: [] }),
    DOCUMENTS,
  );

  assert.deepEqual(result, NOT_FOUND);
});

test('a reply that is not the agreed format is reported as unreliable and not shown', () => {
  const UNRELIABLE = {
    status: 'unreliable',
    answer:
      "The AI's reply could not be checked against the documents, so it is not shown. Please try again.",
    sources: [],
  };

  assert.deepEqual(interpretModelReply('Sure! The session is on Tuesday.', DOCUMENTS), UNRELIABLE);
  assert.deepEqual(interpretModelReply(reply({ answer: 'Tuesday' }), DOCUMENTS), UNRELIABLE);
  assert.deepEqual(
    interpretModelReply(reply({ found: 'yes', answer: 'Tuesday', source_ids: ['doc2'] }), DOCUMENTS),
    UNRELIABLE,
  );
  assert.deepEqual(
    interpretModelReply(reply({ found: true, answer: 42, source_ids: ['doc2'] }), DOCUMENTS),
    UNRELIABLE,
  );
  assert.deepEqual(interpretModelReply('null', DOCUMENTS), UNRELIABLE);
});
