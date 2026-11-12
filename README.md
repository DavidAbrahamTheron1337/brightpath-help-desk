# BrightPath help desk

A small AI help desk for **BrightPath Learn**, a made-up learning platform. Type a question and it answers
using only the three supplied help documents, naming the document each answer comes from. If the documents
don't cover the question, it says so and points the member to support instead of making something up.

- **Live demo:** https://brightpath-help-desk.vercel.app
- **Walkthrough and test results:** [WALKTHROUGH.md](WALKTHROUGH.md) and the [`results`](results) folder
- **AI model:** Google Gemini (`gemini-3.5-flash-lite`, free tier), called from the server only
- **No dependencies:** plain Node.js, a single HTML page, and Node's built-in test runner

## Run it on your computer

You need [Node.js](https://nodejs.org) 22.9 or newer.

1. Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).
2. In this folder, create a file called `.env` containing one line:

   ```
   GEMINI_API_KEY=your-key-here
   ```

   `.env` is listed in `.gitignore`, so it is never uploaded.
3. Start the server and open <http://localhost:3000>:

   ```bash
   npm start
   ```

Without a key the app still runs: every question gets the "AI not available" message, which is itself one of
the failure cases.

## Run the tests

```bash
npm test
```

The tests use stand-ins for Google, so they need no key and no internet connection.

## Check the answers on a running site

```bash
node scripts/live-check.mjs https://brightpath-help-desk.vercel.app results/live-check.json
```

This asks the real AI 23 questions, five seconds apart, and compares each reply with the answer the documents
call for: the right documents cited, the key facts present, "not in the documents" where they don't cover it,
and the outage and bad-question replies. It prints pass or fail for each and saves every reply.

## Test the failure handling

Tick **Simulate an AI outage (for testing)** on the page and ask anything. The server then calls Google with a
deliberately wrong key, Google refuses the call, and the page shows a clear "AI not available" message. It is a
real failed call, not a faked reply. The same works from the command line:

```bash
curl -X POST http://localhost:3000/api/ask -H "Content-Type: application/json" -d "{\"question\":\"When is group coaching?\",\"simulateOutage\":true}"
```

## How it works

1. The page sends the question to `/api/ask`.
2. The server sends Gemini the question, all three documents, and strict rules: use only the documents, and
   reply in a fixed JSON format (`found`, `answer`, `source_ids`).
3. The server checks the reply before showing anything:
   - an answer is shown only if it cites at least one real document;
   - "not found", an unknown document, or no document at all gives the fixed "not in the documents" message;
   - a reply in the wrong format is not shown at all;
   - a refused call, a dropped connection, a call that keeps stalling or a missing key gives the
     "AI not available" message;
   - a call that stalls for more than 12 seconds is tried again, up to three tries in total;
   - if Google says it is briefly unavailable (HTTP 500, 502, 503 or 504), the call is tried again,
     up to three tries in total.

| Folder | What it holds |
| --- | --- |
| `src/domain` | The three documents and the rules for what may be shown |
| `src/application` | Asking a question: checks the question, builds the prompt, handles an outage |
| `src/infrastructure` | The connection to Google Gemini |
| `src/host` | Turns web requests into questions and answers into web replies |
| `server.js` | Runs the site, both on Vercel and on your computer |
| `scripts/live-check.mjs` | The live answer check |
| `public/index.html` | The page |
| `test/` | The tests, including one that keeps the layers pointing inward |

## Keeping the key safe

- The key is never in the code or in this repository. The server reads it from `GEMINI_API_KEY`.
- Online, it lives in Vercel's secret settings, which cannot be read back after saving.
- It is sent to Google in a request header, never in a web address, and never sent to the browser.
- Error messages from Google are not passed on; only the status number is kept.

## Deploy your own copy on Vercel

Import this repository into [Vercel](https://vercel.com), add `GEMINI_API_KEY` as a **Secret** environment
variable, and deploy. Vercel detects `server.js` and runs it as the site's single function, serving both the
page and the question service. Optionally set `GEMINI_MODEL` to use a different Gemini model.
