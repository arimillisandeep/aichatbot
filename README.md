# Pronix Conversational AI Assistant

Website prototype for the Pronix Inc. AI Chatbot assignment. It implements the required visitor experience end to end: greeting with login and registration, account modification and deletion, hybrid FAQ and website search over crawled Pronix content, sentiment analysis, failure handling, and interaction monitoring backed by a MockAPI user store.

## Run locally

```bash
npm install
npm run dev
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Production build |
| `npm run test` | Run the Vitest suite |
| `npm run smoke` | Drive the running app in real Chrome and check end-to-end behaviour |
| `npm run lint` | Run oxlint |
| `npm run crawl` | Re-crawl pronixinc.com into `src/data/knowledge.json` |
| `npm run spec` | Regenerate `docs/kore-xo-bot-spec.json` from the running code |

## Web crawling

`scripts/crawl.mjs` resolves the assignment URL `http://www.pronixinc.com` (which redirects to `https://pronix.ai/`), crawls the public site breadth-first, and additionally reads the site's own JSON feeds, which carry the curated FAQ, guide, and insight copy.

The crawl produces `src/data/knowledge.json` with 260 documents across Services, FAQs, Case studies, Blogs, Platforms, About, and Resources. Each document gets `category`, `service_types`, and `blog_tags` metadata derived by frequency-scoring the page head, so the shared navigation and footer copy cannot collapse every document onto a single label.

Re-run it any time with `npm run crawl`. The committed output means the app works offline and does not depend on the live site at runtime.

## Search AI

`src/lib/search.js` indexes the crawled corpus and scores with a hybrid ranker:

- a keyword ranker using TF-IDF with a BM25-style saturation term and title weighting
- a semantic ranker built on a concept map, so paraphrase such as "how fast can you go live" reaches delivery content that shares no keywords with the question
- a phrase-confirmation term for near-exact question matches

Results honour the assignment's filters for category, service type, and blog tag. The relevance gate requires both query-term coverage and semantic grounding, because term frequency alone cannot separate on-domain from off-domain questions here: `time` and `connect` have identical inverse-document frequency in this corpus, and `agentic` appears in 241 of 260 documents. A page whose title covers every word the visitor used is also accepted, so a question about a topic with no mapped concept still answers.

When nothing qualifies, the search returns nothing and the bot shows the required fallback: related options, the Pronix site link, and the support email.

## Authentication

`src/lib/accountStore.js` calls the MockAPI users resource for GET, POST, PUT, and DELETE, with browser-local demo data as the fallback when no endpoint is configured. Emails are matched case-insensitively.

### MockAPI setup

1. Create a MockAPI project and a `users` resource.
2. Add fields: `username`, `email`, `phone`, `password`.
3. Copy the resource URL into `.env.local`:

   ```
   VITE_MOCKAPI_USERS_URL=https://YOUR_PROJECT.mockapi.io/api/v1/users
   ```

4. Restart the development server. See `.env.example` for the template.

With no endpoint configured the app uses local demo data persisted under `pronix-demo-users`, seeded with `maya@pronix.demo`, so the assignment stays reviewable before the live resource exists.

MockAPI is a demonstration store. A production service must hash passwords, authenticate through a backend, return a minimal profile shape, enforce authorization, and never return passwords in a GET response.

## Dialog flow

`src/lib/dialog.js` holds the copy, validations, sentiment rules, and intent routing so the web prototype and the Kore.ai assistant stay in agreement. The assignment script is implemented exactly:

- Greeting "Hello! Welcome to our Virtual Assistant." with Login and Register choices
- Register collects username, email, phone number, and password with per-field validation, then POSTs. Success shows "Registration successful! Would you like to continue?"; Yes reveals Modify Account and Delete Account, No replies "Thank you! Have a great day."
- Login asks for the registered email, GETs the resource, and on a match replies "Hello [username]! You have successfully logged in." before showing the account options
- An unknown email shows "This email is not registered. Would you like to create a new account?" with Register Now, Retry, and Cancel; Cancel replies "No problem! Have a great day."
- Every API failure path shows "Something went wrong. Please try again later."

## Acceptance checks

```bash
npm run test        # 101 unit and component tests
npm run smoke       # drives the running app in real Chrome
```

The unit suite covers dialog copy, validation, intent routing, sentiment, search ranking and filtering, the no-answer fallback, and all four REST verbs. `scripts/smoke.mjs` starts nothing itself, so run `npm run dev` first; it drives a real browser through the greeting, invalid email, unknown email, cancel, registration, login round trip, search, fallback, handoff routing, and monitoring, then fails on any console error.

Browser coverage matters: it caught a real POST/GET round trip through the live MockAPI, and a favicon 404 that the jsdom tests could not see.

In the browser you can also check manually:

1. Select Register, submit a valid profile, then choose Yes or No.
2. Select Login and use an address that exists in your store; try Modify and Delete.
3. Enter an unregistered but valid email to see Register now, Retry, and Cancel.
4. Ask about services, pricing, a case study, governance, or delivery timing.
5. Ask something unrelated, such as a recipe question, to see the related-options fallback.
6. Apply a category, service-type, or blog-tag filter and confirm results narrow.
7. Point `VITE_MOCKAPI_USERS_URL` at an unreachable host to confirm the API failure message.

## Monitoring

Every intent, question, sentiment label, search hit, fallback, login attempt, registration, account change, API error, handoff, and conversation end is written to `localStorage` under `pronix-assistant-events`, capped at the latest 50. This is a browser-side prototype of the monitoring requirement; production should ship these events to real logging and analytics.

## Kore.ai XO

- `docs/kore-xo-build.md` is the step-by-step platform build guide.
- `docs/kore-xo-bot-spec.json` is generated from the running code by `npm run spec`. It carries the intent list with 5 to 10 utterances each, the dialog-task node structure and branches, entity validations, the REST mapping table, the Search AI collection configuration with rankers, metadata fields, and filters, the monitoring event list, and channel status.
- `docs/assignment-status.md` records what is verified and what still requires platform or owner action.

## Deliverables

- `src/App.jsx`: responsive visitor assistant and authentication flows
- `src/lib/dialog.js`: copy, validations, sentiment, intent routing
- `src/lib/search.js`: hybrid keyword and semantic retrieval with filters
- `src/lib/accountStore.js`: MockAPI GET, POST, PUT, DELETE with local fallback
- `src/data/knowledge.json`: crawled corpus
- `scripts/crawl.mjs`, `scripts/export-kore-spec.mjs`: corpus and spec generation
- `scripts/smoke.mjs`: end-to-end browser check
- `scripts/kore-*.mjs`: read and drive the live Kore.ai XO session over CDP
- `tests/`: Vitest suite for dialog, search, account store, and the UI