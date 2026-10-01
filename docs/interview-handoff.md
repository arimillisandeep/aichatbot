# Interview handoff — Pronix Inc. Kore.ai XO Chatbot

Everything you need to hand over in one place. Verified 1 October 2026.

---

## 1. Links

### Public (open these in the interview)

| What | Link | Status |
| --- | --- | --- |
| **Live chatbot (public)** | `https://aicharbot.vercel.app` | HTTP 200, production build |
| **Telegram bot** | `https://t.me/PronixAIChatbotSandeepBot` | Channel enabled — see caveat in §6 |

The public URL works on any device, any network, no login required. This is the
single best thing to show first.

### Kore.ai builder (requires your signed-in account)

| What | Link |
| --- | --- |
| Automation / dialog canvas | `https://platform.kore.ai/builder/app/automationdialoggpt/automationconversationorchestration` |
| Publish page | `https://platform.kore.ai/builder/app/publish` |

### Local (only if you must demo offline)

| What | Link | Command |
| --- | --- | --- |
| Dev server | `http://localhost:5173` | `npm run dev` |
| Production preview | `http://localhost:4173` | `npm run preview:host` |
| Same build on LAN | `http://192.168.0.111:4173` | Same server, same Wi-Fi |

---

## 2. Three-minute demo script

1. **Open `https://aicharbot.vercel.app`.** Greet it with the welcome line.
2. **Ask a knowledge question**, e.g. *"What is Agentic AI?"* or *"tell me about
   your CX services"*. Show it answers from the crawled corpus with a source
   link, not a canned string.
3. **Ask something it cannot answer.** Show the graceful fallback rather than a
   hallucination — this is the honest-answering behaviour, not a bug.
4. **Start the login flow.** Enter an email that is **not** registered. Show the
   "not registered, would you like to create a new account?" branch and the
   choice between register / retry / cancel.
5. **Register with a new email.** Show the live POST to MockAPI and the success
   confirmation. Then log in with it.
6. **Send a negative-sentiment message.** Show the in-session tone label and the
   escalation path.
7. **Open Telegram** (`https://t.me/PronixAIChatbotSandeepBot`) and repeat one
   exchange to show the channel works, not just the web app.

---

## 3. Documents

Share these as the written record. All live in the repo.

| File | Size | What it is |
| --- | --- | --- |
| `README.md` | 7.4 KB | Setup, scripts, architecture, how to run and deploy |
| `docs/assignment-status.md` | 28.8 KB | The full evidence log: every requirement, what passes, what does not |
| `docs/interview-handoff.md` | this file | Links, demo script, Q&A |
| `docs/kore-xo-build.md` | 8.3 KB | How the Kore.ai XO dialogs, intents and Search AI are structured |
| `docs/kore-xo-bot-spec.json` | 8.1 KB | Machine-readable spec — intents, dialogs, required copy, search config |
| `docs/completion-plan.md` | 7.0 KB | Remaining work, in priority order |

The Kore spec is the one to lead with if they ask "how do you know what you
built?" — it maps requirements to implementation rather than describing it in prose.

---

## 4. Architecture, for the "how does it work" question

```
crawler (scripts/crawl.mjs)
    └──> src/data/knowledge.json ......... 260 documents, 42 FAQs
              │
              ├──> hybrid ranker (src/lib/search.js)
              │      token overlap + stemming + concept sets
              │      field weighting on title / keywords / answer
              │      deterministic stand-in for an embedding model
              │
user message ──> sentiment (src/lib/dialog.js)
              └──> 8-intent classifier
                     │
                     ├──> knowledge answers (with source links)
                     ├──> login flow    ──> registered? ──> success | offer register
                     ├──> registration  ──> POST MockAPI ──> success | validation | error
                     └──> fallback / handoff
```

Design points worth saying out loud:

- **Local app is the source of truth, Kore.ai is the deployment target.** The
  React/Vite app is fully working and independently useful as a fallback. This is
  why the project still demonstrates something end-to-end despite the Kore write
  limitations in §6.
- **Hybrid retrieval, not keyword matching.** Stemming and concept sets let
  paraphrases match, which is what makes "what do you do for CX?" hit an
  "Agentic AI" document.
- **Unknown questions fall through instead of inventing an answer.** In an
  enterprise-support context this is the difference between useful and a
  liability.
- **Sentiment runs on every message**, not only inside the login flow, so the
  session carries a tone label the whole way through.

---

## 5. Deployment

| | |
| --- | --- |
| Host | Vercel (production) |
| Project | `aicharbot`, team `sandeeparimilli2001-4822s-projects` |
| Production URL | `https://aicharbot.vercel.app` |
| Deployment URL | `https://aicharbot-mk3xqzbg7-sandeeparimilli2001-4822s-projects.vercel.app` |
| Build | `vite build` → 1,892 modules, `dist/` ~490 KB JS (120 KB gzipped) |
| Redeploy | `npm run deploy:vercel` |

Redeploys build first, so the deployed bundle always matches the tested source.
Netlify is the fallback path (`npm run deploy:netlify`) but that CLI is not
authenticated.

---

## 6. Known gaps — be ready for these

State these plainly rather than being caught out.

1. **Kore.ai required copy is 2 of 7 verified.** Only
   `Hello! Welcome to our Virtual Assistant.` and
   `No problem! Have a great day.` are confirmed live in the builder.
   The other five strings are not yet applied.
2. **Search AI collection and intent training are not yet configured in Kore.**
   The retrieval and classification logic is fully built and working in the
   local app; it has been mapped to Kore but not yet trained there.
3. **The Kore builder's write APIs are unreliable** — dialog updates return 412,
   component edits silently discard text, and published dialogs cannot be
   unpublished due to a platform privilege limit. This is a platform constraint,
   not a code defect, and it is documented with reproduced evidence.
4. **WhatsApp is blocked** pending Meta Business verification.

The honest framing, if asked: *the chatbot is built and deployed and working;
the Kore.ai XO instance is partially configured because the builder's write
interfaces are restricted, and I have documented exactly where that stands.*

---

## 7. Likely questions

**"Walk me through your approach."** Crawl the client site to build a real
knowledge base rather than inventing FAQs, then mirror the Kore intent map in a
working app so the behaviour is demonstrable independent of the platform.

**"Why hybrid search instead of a vector DB?"** No embedding service was
available in the environment, so I used token overlap plus stemming plus concept
sets with field weighting. It handles paraphrase reasonably and is fully
deterministic, which makes it testable. The interface is shaped so a real
embedding model is a drop-in replacement.

**"How do you know it doesn't make things up?"** Unmatched queries hit an
explicit fallback instead of the generator. Answers carry source links back to
the crawled page.

**"What's your test coverage?"** 101 tests across 5 files, plus a smoke test that
exercises live registration and login against MockAPI.

**"What would you do next?"** Finish the five remaining strings in the builder,
create and train the Search AI collection, then retest end-to-end across all
channels. The plan is in `docs/completion-plan.md`.

---

## 8. If asked to run it locally

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production bundle
npm run preview:host # http://localhost:4173 (also on the LAN)
npm test             # 101 tests
npm run lint
```