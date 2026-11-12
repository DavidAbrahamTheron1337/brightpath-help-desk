import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequestListener } from '../src/host/webServer.js';

// A stand-in for the question service: echoes back what it was asked.
const handle = async (request) =>
  Response.json({ status: 'answered', answer: `asked: ${(await request.json()).question}`, sources: [] });

let server;
let base;
before(async () => {
  server = createServer(createRequestListener({ handle, pagePath: new URL('../public/index.html', import.meta.url) }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const ask = (path) => fetch(`${base}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ question: 'When is group coaching?' }),
});

test('the page is served at the site address', async () => {
  const response = await fetch(`${base}/`);

  assert.equal(response.status, 200);
  assert.match(await response.text(), /<title>BrightPath Help Desk<\/title>/);
});

test('questions sent to the question service reach it and come back', async () => {
  const response = await ask('/api/ask');

  assert.equal(response.status, 200);
  assert.equal((await response.json()).answer, 'asked: When is group coaching?');
});

test('extras after a "?" in the link, like tracking codes, do not break the page or the question service', async () => {
  const page = await fetch(`${base}/?utm_source=email&fbclid=abc123`);
  const answer = await ask('/api/ask?v=2');

  assert.equal(page.status, 200);
  assert.match(await page.text(), /<title>BrightPath Help Desk<\/title>/);
  assert.equal(answer.status, 200);
  assert.equal((await answer.json()).answer, 'asked: When is group coaching?');
});

test('the page\'s question code is served as a script', async () => {
  const response = await fetch(`${base}/app.js`);

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /javascript/);
  assert.match(await response.text(), /export function createAsker/);
});

test('an address the site does not have gets "Not found"', async () => {
  const response = await fetch(`${base}/server.js`);

  assert.equal(response.status, 404);
});
