// Online entry point on Vercel: every request to /api/ask comes here.
// The key is read from Vercel's secret setting (GEMINI_API_KEY) on the server only.

import { createAskHandler } from '../src/host/askHandler.js';

const handle = createAskHandler({ env: process.env });

export default {
  fetch(request) {
    return handle(request);
  },
};
