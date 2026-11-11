// The one thing the help desk does: take a question and return an answer it is allowed to show.

import { interpretModelReply } from '../domain/answer.js';
import { SYSTEM_INSTRUCTION, RESPONSE_SCHEMA, buildInput } from './prompt.js';
import { ModelUnavailableError } from './modelPort.js';

export const MAX_QUESTION_LENGTH = 500;

export const UNAVAILABLE_MESSAGE =
  'The AI service is not available right now, so I cannot answer. Please try again in a minute.';

const invalid = (answer) => ({ status: 'invalid', answer, sources: [] });

export function createAskQuestion({ model, documents }) {
  return async function askQuestion(question) {
    const text = typeof question === 'string' ? question.trim() : '';
    if (text === '') {
      return invalid('Please type a question.');
    }
    if (text.length > MAX_QUESTION_LENGTH) {
      return invalid(`Please keep your question under ${MAX_QUESTION_LENGTH} characters.`);
    }
    let reply;
    try {
      reply = await model.generate({
        systemInstruction: SYSTEM_INSTRUCTION,
        input: buildInput(text, documents),
        responseSchema: RESPONSE_SCHEMA,
      });
    } catch (error) {
      if (error instanceof ModelUnavailableError) {
        console.warn(`AI unavailable: ${error.message}`); // reason only; the adapter never puts a key in it
        return { status: 'unavailable', answer: UNAVAILABLE_MESSAGE, sources: [] };
      }
      throw error;
    }
    return interpretModelReply(reply, documents);
  };
}
