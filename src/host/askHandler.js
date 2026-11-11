// Turns a web request into a question for the help desk, and the answer back into a web reply.
// Used by both the online version (api/ask.js) and the local server (server.js).
// This is the only place the pieces are wired together; the key is read here and passed straight to the
// Google connection. It is never put into a reply.

import { createAskQuestion } from '../application/askQuestion.js';
import { DOCUMENTS } from '../domain/documents.js';
import { createGeminiModel } from '../infrastructure/geminiModel.js';

const STATUS_CODES = { answered: 200, not_found: 200, invalid: 400, unreliable: 502, unavailable: 503 };

// "Simulate outage" swaps in a key Google will refuse, so the failure tested is a real failed call.
export const SIMULATED_OUTAGE_KEY = 'simulated-outage-wrong-key';

const reply = (result) => Response.json(result, { status: STATUS_CODES[result.status] });

export function createAskHandler({ env, fetchFn = globalThis.fetch }) {
  return async function handle(request) {
    if (request.method !== 'POST') {
      return Response.json(
        { status: 'invalid', answer: 'Send questions with POST.', sources: [] },
        { status: 405, headers: { Allow: 'POST' } },
      );
    }
    const body = await request.json().catch(() => ({}));
    const apiKey = body?.simulateOutage === true ? SIMULATED_OUTAGE_KEY : env.GEMINI_API_KEY;
    const model = createGeminiModel({ apiKey, model: env.GEMINI_MODEL || undefined, fetchFn });
    const askQuestion = createAskQuestion({ model, documents: DOCUMENTS });
    return reply(await askQuestion(body?.question));
  };
}
