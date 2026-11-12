// Routes web requests for the whole site: the page and the question service.
// Used by server.js, which is what runs both on this computer and on Vercel.

import { readFile } from 'node:fs/promises';

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

export function createRequestListener({ handle, pagePath }) {
  return async function listener(req, res) {
    try {
      // Only the address matters; anything after "?" (tracking codes and the like) is ignored.
      const { pathname } = new URL(req.url, 'http://localhost');
      if (pathname === '/api/ask') {
        const response = await handle(await toWebRequest(req));
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
      } else if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(await readFile(pagePath));
      } else if (req.method === 'GET' && pathname === '/app.js') {
        res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
        res.end(await readFile(new URL('./app.js', pagePath)));
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      }
    } catch (error) {
      console.error('Unexpected server error:', error?.name);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', answer: 'Something went wrong on the server.', sources: [] }));
    }
  };
}
