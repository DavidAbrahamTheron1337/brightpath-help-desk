// Local server: runs the same help desk on this computer at http://localhost:3000.
// Start it with `npm start`. It reads GEMINI_API_KEY from a .env file if one exists (never uploaded).

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createAskHandler } from './src/host/askHandler.js';

const PORT = Number(process.env.PORT) || 3000;
const PAGE = new URL('./public/index.html', import.meta.url);
const handle = createAskHandler({ env: process.env });

async function toWebRequest(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const hasBody = !['GET', 'HEAD'].includes(req.method);
  return new Request(`http://localhost${req.url}`, {
    method: req.method,
    headers: { 'Content-Type': req.headers['content-type'] ?? 'application/json' },
    body: hasBody ? Buffer.concat(chunks) : undefined,
  });
}

createServer(async (req, res) => {
  try {
    if (req.url === '/api/ask') {
      const response = await handle(await toWebRequest(req));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } else if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(await readFile(PAGE));
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  } catch (error) {
    console.error('Unexpected server error:', error?.name);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', answer: 'Something went wrong on the server.', sources: [] }));
  }
}).listen(PORT, () => {
  console.log(`Help desk running at http://localhost:${PORT}`);
  if (!process.env.GEMINI_API_KEY) {
    console.log('No GEMINI_API_KEY set: every question will get the "AI not available" message.');
  }
});
