import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAsker } from '../public/app.js';

// Records what the page would show.
function fakePage() {
  const shown = [];
  return { shown, onStart() {}, onShow(data) { shown.push(data); }, onDone() {} };
}

const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });

test('when a second question is asked before the first answer arrives, only the second answer is shown', async () => {
  let releaseFirst;
  const firstArrives = new Promise((resolve) => { releaseFirst = resolve; });
  const fetchFn = async (url, init) => {
    const { question } = JSON.parse(init.body);
    if (question === 'first') {
      await firstArrives; // the first answer is slow and lands last
      return reply({ status: 'not_found', answer: 'answer to first', sources: [] });
    }
    return reply({ status: 'answered', answer: 'answer to second', sources: [] });
  };
  const page = fakePage();
  const ask = createAsker({ fetchFn, ...page });

  const first = ask('first', false);
  const second = ask('second', false);
  await second;
  releaseFirst();
  await first;

  assert.deepEqual(page.shown.map((d) => d.answer), ['answer to second']);
});

test('the question and the outage switch are sent to the help desk', async () => {
  const sent = [];
  const fetchFn = async (url, init) => {
    sent.push({ url, method: init.method, body: JSON.parse(init.body) });
    return reply({ status: 'answered', answer: 'ok', sources: [] });
  };
  const page = fakePage();

  await createAsker({ fetchFn, ...page })('When is group coaching?', true);

  assert.deepEqual(sent, [{ url: '/api/ask', method: 'POST', body: { question: 'When is group coaching?', simulateOutage: true } }]);
  assert.deepEqual(page.shown, [{ status: 'answered', answer: 'ok', sources: [] }]);
});

test('if the help desk cannot be reached, or sends back something unreadable, the page says so plainly', async () => {
  const page = fakePage();
  await createAsker({ fetchFn: async () => { throw new TypeError('offline'); }, ...page })('q', false);
  await createAsker({ fetchFn: async () => new Response('<html>Server error</html>', { status: 500 }), ...page })('q', false);

  assert.deepEqual(page.shown, [
    { status: 'error', answer: 'Could not reach the help desk server. Check your internet connection and try again.' },
    { status: 'error', answer: 'The help desk server had a problem (HTTP 500). Please try again.' },
  ]);
});
