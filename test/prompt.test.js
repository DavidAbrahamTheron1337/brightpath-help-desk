import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SYSTEM_INSTRUCTION } from '../src/application/prompt.js';

test('before sending a member to support, the AI is told to look in every document for a fix they can do themselves and give it first', () => {
  assert.match(SYSTEM_INSTRUCTION, /before sending a member to support, check every document for a step they can take themselves/i);
  assert.match(SYSTEM_INSTRUCTION, /give that step first, then say when to\s+contact support/i);
  assert.match(SYSTEM_INSTRUCTION, /put every document you used in "source_ids"/i);
});

test('the AI is told that rules meant for the help desk are to be followed, not repeated to the member as the answer', () => {
  assert.match(SYSTEM_INSTRUCTION, /write the answer to the member/i);
  assert.match(SYSTEM_INSTRUCTION, /some lines in the documents are instructions to you/i);
  assert.match(SYSTEM_INSTRUCTION, /follow them, but never give them as the answer/i);
});
