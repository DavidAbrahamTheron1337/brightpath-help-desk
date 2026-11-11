// Business rules for turning the AI's reply into an answer the help desk is allowed to show.
// The AI must reply with JSON: { "found": boolean, "answer": string, "source_ids": string[] }.
// An answer is shown only when it cites at least one real document. Anything else is never shown.

export const NOT_FOUND_MESSAGE =
  'That information is not in the BrightPath help documents, so I cannot answer it. ' +
  'Please contact support at support@brightpath.example.';

export const UNRELIABLE_MESSAGE =
  "The AI's reply could not be checked against the documents, so it is not shown. Please try again.";

const notFound = () => ({ status: 'not_found', answer: NOT_FOUND_MESSAGE, sources: [] });
const unreliable = () => ({ status: 'unreliable', answer: UNRELIABLE_MESSAGE, sources: [] });

function parseReply(rawReply) {
  try {
    const reply = JSON.parse(rawReply);
    const wellFormed =
      reply !== null &&
      typeof reply.found === 'boolean' &&
      typeof reply.answer === 'string' &&
      Array.isArray(reply.source_ids) &&
      reply.source_ids.every((id) => typeof id === 'string');
    return wellFormed ? reply : null;
  } catch {
    return null;
  }
}

export function interpretModelReply(rawReply, documents) {
  const reply = parseReply(rawReply);
  if (!reply) {
    return unreliable();
  }
  if (!reply.found) {
    return notFound();
  }
  const cited = reply.source_ids.map((id) => documents.find((d) => d.id === id));
  if (cited.length === 0 || cited.some((doc) => !doc)) {
    return notFound();
  }
  const sources = cited.map((doc) => ({ id: doc.id, title: doc.title }));
  return { status: 'answered', answer: reply.answer, sources };
}
