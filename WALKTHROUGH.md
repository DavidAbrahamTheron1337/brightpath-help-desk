# Walkthrough

- **Live demo:** https://brightpath-help-desk.vercel.app
- **Code:** https://github.com/DavidAbrahamTheron1337/brightpath-help-desk

## What works

- You type a question on a simple web page and get an answer, usually in one to six seconds.
- Answers come only from the three BrightPath documents, and each answer names the document it came from.
- If the documents don't cover the question, the page says so and points the member to support. The server
  never takes the AI's word for it: an answer is shown only if it cites a real document. An answer citing no
  document, or a document that doesn't exist, is replaced by the "not in the documents" message.
- A reply from the AI in the wrong format is never shown.
- If the AI can't be reached, refuses the call, takes more than 20 seconds, or no key is set, the page shows a
  clear "AI not available" message instead of an error.
- If Google is only briefly unavailable, the server quietly tries again, up to three tries in total.
- **Testing the failure:** tick "Simulate an AI outage (for testing)" and ask anything. The server then calls
  Google with a deliberately wrong key. Google really refuses it, so the failure tested is a genuine failed call.
- 26 automated tests cover the rules, the AI's instructions, the outage handling, the retries and the Google
  connection. They use stand-ins for Google, so they run with no key and no internet. One test also checks the
  code layers only depend inward.
- A live answer check (`scripts/live-check.mjs`) asks a running site 23 questions and compares each reply with
  the answer the documents call for, written down before the check was run.
- The AI key is never in the code. On the live site it sits in Vercel's secret settings, only the server uses
  it, and it is sent to Google in a request header, never in a web address. I checked in the browser that the
  page only ever talks to its own server and never receives anything key-like.

## My three test results

Run by hand on the live site on 11 November 2026. The exact replies are saved in
[`results/three-tests.json`](results/three-tests.json) and the screenshots in
[`results/three-tests.png`](results/three-tests.png).

| Test | Question | Result |
| --- | --- | --- |
| 1. Answered by the documents | When is group coaching? | "A group coaching session takes place every Tuesday at 16:00 UTC." Source: Document 2, Coaching and feedback. |
| 2. Not in the documents | How much does the course cost? | "That information is not in the BrightPath help documents, so I cannot answer it. Please contact support at support@brightpath.example." No source, nothing made up. |
| 3. AI failure | When is group coaching? (with "Simulate an AI outage" ticked) | "The AI service is not available right now, so I cannot answer. Please try again in a minute." |

**A problem I found and fixed (11 Nov):** on the first run of extra questions, 3 of 15 came back "AI not
available". The live site's log showed Google had replied "service unavailable" (HTTP 503) to those calls. I
added the retry for that reply, tested it first, and on the rerun no question hit that error again.

**A correction, and a second fix (12 Nov):** on 11 Nov I reported that all 16 extra questions were right. One
was not as good as it should have been: "My lesson progress is wrong" got only "contact support", although
Document 1 gives a quicker fix (select Mark complete). I had checked each answer against the document it cited,
not against all three. You found the same gap with "I watched Lesson 1 but it still says incomplete".

- **The fix:** the AI is now told to look in every document for a step the member can take themselves and give
  it first, then say when to contact support, and that lines written for the help desk are rules to follow,
  not answers.
- **How it was tested:** two new automated tests first, then a private copy of the site before going live,
  then the live site. The expected answer for each question is now written down in `scripts/live-check.mjs`.
- **Result:** your Lesson 1 question now gets "select Mark complete ... if it's still wrong, contact support"
  with Documents 1 and 3, every time I asked it (3 of 3 on the private copy, then live, by hand and in the
  check). Live check after the fix: 22 of 23 ([`results/live-check-after-fix.json`](results/live-check-after-fix.json)).
- **Still not perfect:** "My lesson progress is wrong" still gets only Document 3's "contact support" answer.
  That matches Document 3's own wording, but it skips the quicker fix. Three different instructions did not
  change it with this small free model.

## What I built myself, and the tools I used

I built this with **Claude Code** (Anthropic's AI coding tool), which wrote the code, tests and README from my
instructions and ran the checks on the live site. The decisions I made:

- Host it online so the reviewer only needs a link, instead of a local model the reviewer would have to install.
- Use Google's free Gemini plan with no billing attached, so the public demo can never run up a bill.
- Keep the key only in the hosting site's secret settings, and check every file for keys before uploading.
- Test everything by hand on the live site before submitting.

Everything else is plain Node.js with no libraries: one HTML page, one server function and Node's built-in
test runner. Hosting is Vercel's free plan. The AI model is Google `gemini-3.5-flash-lite`.

## What I would improve

Get the last answer right: when a member says their progress is wrong, always offer "select Mark complete"
before support. The free model ignores the instruction for that phrasing, so the next step would be a larger
model or a second pass that adds any self-help step the first answer missed, checked by the live answer check.

Also check that each answer is actually supported by the document it cites. Today the server checks that the cited
document exists, but it trusts the AI that the answer matches that document. A second check, comparing the
answer against the cited document's text, would catch an answer that names the right document but adds
something that isn't in it.

## What is unfinished or limited

- Google's free plan for this model allows 15 questions a minute and 500 a day. Past that, the page shows the
  "AI not available" message until the limit resets. I hit the per-minute limit once while testing quickly.
- The demo is public and has no limit per visitor, so one person could use up the day's allowance.
