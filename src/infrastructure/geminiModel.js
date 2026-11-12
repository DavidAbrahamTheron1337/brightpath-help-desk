// Talks to Google's Gemini AI over the internet. The only file that knows Google's request format.
// Request format checked against Google's Interactions API documentation on 2026-11-11.

import { ModelUnavailableError } from '../application/modelPort.js';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const API_REVISION = '2026-05-20';
export const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

// Most answers arrive in 1 to 8 seconds; now and then a call stalls for longer, while the next one is quick.
export const DEFAULT_TIMEOUT_MS = 12_000;
// Google sometimes turns a call away for a moment ("service unavailable") or stalls. Those calls are tried
// again after these pauses. A refused key or a reached limit is never retried.
const DEFAULT_RETRY_DELAYS_MS = [500, 1500];
const TEMPORARY_STATUSES = new Set([500, 502, 503, 504]);

class TemporaryFailure extends ModelUnavailableError {}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createGeminiModel({
  apiKey,
  model = DEFAULT_MODEL,
  fetchFn = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
}) {
  async function callOnce({ systemInstruction, input, responseSchema }) {
    let response;
    try {
      response = await fetchFn(ENDPOINT, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
          'Api-Revision': API_REVISION,
        },
        body: JSON.stringify({
          model,
          system_instruction: systemInstruction,
          input,
          response_format: { type: 'text', mime_type: 'application/json', schema: responseSchema },
          store: false,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw error?.name === 'TimeoutError'
        ? new TemporaryFailure('The AI service took too long to reply')
        : new ModelUnavailableError('Could not reach the AI service');
    }
    // Google's error text is never passed on: only the status number leaves this file.
    if (!response.ok) {
      const Failure = TEMPORARY_STATUSES.has(response.status) ? TemporaryFailure : ModelUnavailableError;
      throw new Failure(`AI service refused the call (HTTP ${response.status})`);
    }
    const text = extractText(await response.json().catch(() => null));
    if (!text) {
      throw new ModelUnavailableError('The AI service sent back an empty reply');
    }
    return text;
  }

  return {
    async generate(request) {
      if (!apiKey) {
        throw new ModelUnavailableError('No AI key is set on the server');
      }
      for (let attempt = 0; ; attempt += 1) {
        try {
          return await callOnce(request);
        } catch (error) {
          if (!(error instanceof TemporaryFailure) || attempt >= retryDelaysMs.length) {
            throw error;
          }
          await pause(retryDelaysMs[attempt]);
        }
      }
    },
  };
}

function extractText(body) {
  const steps = Array.isArray(body?.steps) ? body.steps : [];
  return steps
    .filter((step) => step?.type === 'model_output' && Array.isArray(step.content))
    .flatMap((step) => step.content)
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('');
}
