// Sends questions from the page to the help desk and decides what the page shows.
// Only the answer to the latest question is ever shown: if someone asks again before an answer arrives,
// the older answer is dropped when it lands.

export function createAsker({ fetchFn, onStart, onShow, onDone }) {
  let latest = 0;

  return async function ask(question, simulateOutage) {
    const thisAsk = ++latest;
    onStart();
    let data;
    try {
      const response = await fetchFn('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, simulateOutage }),
      });
      const body = await response.json().catch(() => null);
      data = body && typeof body.answer === 'string'
        ? body
        : { status: 'error', answer: `The help desk server had a problem (HTTP ${response.status}). Please try again.` };
    } catch {
      data = { status: 'error', answer: 'Could not reach the help desk server. Check your internet connection and try again.' };
    }
    if (thisAsk !== latest) return; // a newer question was asked meanwhile
    onShow(data);
    onDone();
  };
}
