// Runs the help desk: the page and the question service. Vercel runs this file for the live site, and
// `npm start` runs it on this computer at http://localhost:3000. It reads GEMINI_API_KEY from the environment
// (locally from a .env file if one exists; that file is never uploaded).

import { createServer } from 'node:http';
import { createAskHandler } from './src/host/askHandler.js';
import { createRequestListener } from './src/host/webServer.js';

const PORT = Number(process.env.PORT) || 3000;
const listener = createRequestListener({
  handle: createAskHandler({ env: process.env }),
  pagePath: new URL('./public/index.html', import.meta.url),
});

createServer(listener).listen(PORT, () => {
  console.log(`Help desk running at http://localhost:${PORT}`);
  if (!process.env.GEMINI_API_KEY) {
    console.log('No GEMINI_API_KEY set: every question will get the "AI not available" message.');
  }
});
