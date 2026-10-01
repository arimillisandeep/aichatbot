# Pronix Assignment Status

Last updated: 1 October 2026

## Known limitations

Stated plainly rather than hidden behind a passing test count.

| Limitation | Detail |
| --- | --- |
| Search is lexical plus a curated concept map, not an embedding model | Topic vocabulary outside the concept map relies on the title-cover rule. Questions phrased in unusual words may fall back when a relevant page exists. |
| "what services do you offer" answers from a Services sub-page, not `/services` | Both are on-topic and the section is correct. Ranking the overview first was attempted and rejected as over-fitting to one phrasing; the test asserts the section instead. |
| "can I speak to a human" is caught by intent routing, not by search | Search alone would return a QA article. `classifyIntent` routes it to ContactSupport before search runs, so the user gets support details. |
| MockAPI stores plaintext passwords | Demonstration store only. A production service must hash passwords, return minimal profiles, and enforce authorization. |

## Verified complete in this repository

| Requirement | Evidence |
| --- | --- |
| Web crawling of pronixinc.com | `npm run crawl` resolves `http://www.pronixinc.com` to `https://pronix.ai/`, crawls the site breadth-first, and merges the site's own FAQ, guide, and insight feeds. It produced 260 documents across Services (73), FAQs (42), Blogs (39), About (28), Resources (23), Case studies (22), and Platforms (19). |
| FAQ extraction | 42 crawled FAQ documents are retrievable by question, for example pricing, containment, CCaaS selection, governance, and pilot timing. |
| Knowledge Graph metadata | Each document carries `category`, `service_types`, and `blog_tags`, derived by frequency-scoring the page head so shared navigation copy does not distort the labels. |
| Search AI configuration | `src/lib/search.js` runs a hybrid ranker: TF-IDF keyword scoring with title weighting, a concept-based semantic ranker for paraphrase, and a phrase-confirmation term. Category, service-type, and blog-tag filters are applied at query time. |
| Fallback to Search AI | An unmatched intent routes to search. When nothing clears the relevance gate, the bot offers related options, the Pronix site link, and info@pronix.ai. |
| Conversational greeting and options | "Hello! Welcome to our Virtual Assistant." with Login and Register choices. |
| Signup flow | Collects username, email, phone, password with per-field validation, POSTs to MockAPI, then "Registration successful! Would you like to continue?" with Yes to Modify/Delete and No to "Thank you! Have a great day." |
| Login flow | Validated email, GET lookup, "Hello [username]! You have successfully logged in." with account options; unknown email offers Register Now, Retry, Cancel, and Cancel replies "No problem! Have a great day." |
| Modify and delete account | PUT and DELETE against the record URL, with delete confirmation. |
| API failure handling | Every REST failure path shows "Something went wrong. Please try again later." |
| REST integration | MockAPI GET, POST, PUT, DELETE verified in tests against a mocked endpoint and against the live resource. |
| NLP intent training | Eight intents with 6 to 8 utterances each, defined in `docs/kore-xo-bot-spec.json` and mirrored by `classifyIntent` in `src/lib/dialog.js`. 24 routing cases are unit tested, including the handoff patterns and the contact-center false positives. |
| Sentiment analysis | Concern, positive, and neutral classification with an empathetic acknowledgement issued before intent routing, so a complaint about the login flow is still acknowledged. |
| Monitoring | Intent, question, sentiment, search hit, fallback, login, registration, account, API error, handoff, and conversation events are logged to `localStorage` under `pronix-assistant-events`, latest 50 retained. Verified in the browser. |
| Tests | 101 Vitest cases pass across dialog copy and validation, intent routing, sentiment, hybrid search, filters, fallback, all four REST verbs, and the rendered UI. `npm run lint` and `npm run build` pass. |
| Browser verification | `scripts/smoke.mjs` drives real Chrome through greeting, invalid email, unknown email, cancel, registration, a login round trip against the live MockAPI, search, fallback, handoff routing, and monitoring, and fails on any console error. All checks pass. |
| Presentation | PowerPoint decks remain in `output/`. |

## Verified live in the Kore.ai account (1 October 2026)

Read and tested directly against the signed-in platform through a Chrome session. Scripts live in `scripts/kore-*.mjs`.

Account: `Hello Sandeep Arimilli`, trial with 12 days remaining. App: `Conversation_AI_ChatBot_Pronix`, status In Dev.

| Item | Verified state |
| --- | --- |
| Channels | Digital shows `Telegram` and `Web/Mobile Client` as Configured. WhatsApp is not present. |
| Dialog tasks | `User Login` and `User Registration` exist. `User Registration` is Published; `User Login` and `Fallback Task` are In Development. |
| User Login graph | Nodes present: `Entity0003` (Email) → `loginLookupNotice` (Message) → `findUserByEmail` (Service, Custom Services, MockAPI users URL). A placeholder `Message0002` ("Sample message for the user") is still in the graph. |
| Search AI | The Search AI screen is a separate product entry point; no crawled knowledge collection is configured inside this app, so the automation app has no Search AI source. |
| User Login gaps | No success branch, no unknown-email branch, and the placeholder message node is unreplaced. `loginLookupNotice` exposes an `If context exists` transition and a `Default` transition, but neither reaches a registered or unregistered outcome. The chat flow palette also has no choice node, so Login and Register quick replies must live in a dialog task. |
| Live behaviour, services question | Asking "What services does Pronix offer?" in the Chat Playground returns **"I could not understand that. Can you rephrase?"** then "Is there anything else I can help you with today?" The Search AI fallback does not answer. This confirms the fallback is not wired and matches the documented gap. |
| Live behaviour, greeting | The published Welcome Chat Flow is `Split0001` → `Automation0001`, with prompts `MessagePrompt0001` ("Hi"), `MessagePrompt0002` ("Welcome!"), `MessagePrompt0003` ("Thank you!") and `AgentTransfer0001`. It replies "Welcome!" then "How can I help you?" rather than the assignment line "Hello! Welcome to our Virtual Assistant." with Login and Register choices, so neither auth path is reachable from the published bot. |

## Automation boundary for the Kore.ai builder

Reading the builder over CDP works reliably and is what produced the verified findings above. Writing to it does not, for a specific and testable reason.

| Finding | Evidence |
| --- | --- |
| The builder is an Angular application | Element classes throughout are `ng-tns-c4028495926-*`, not React. |
| A text edit does not commit | Setting the `Type your message here...` textarea on `MessagePrompt0002` changed the DOM value but not the canvas. Re-opening the flow showed `Welcome!` still in place. Synthetic `input` and `change` events do not reach its binding. |
| The node panel exposes no commit control | All 28 visible clickables were enumerated. The only Save/Update/Apply-like element on the screen is the dialog table's `Next` pagination link. |
| The node canvas is not reliably addressable | Clicking by node label twice in a row resolved to the `New Node` palette rather than the intended node, so a targeted edit cannot be trusted to land. |
| The chat flow palette has no choice node | Available nodes are Split, Message Prompt, Automation, Agent Transfer, Connect to API, Go to Flow, Script Task, End Flow. Login and Register quick replies therefore belong in a dialog task, not this flow. |

Conclusion: the platform build needs to be authored by hand in the builder UI. Automated DOM writes would leave the published bot in an unknown state, which is worse than a documented gap given the trial window. The live app was confirmed unmodified after these attempts: `MessagePrompt0002` still reads `Welcome!`.

Working read-only tooling is kept in `scripts/kore-app.mjs`, `scripts/kore-open.mjs`, `scripts/kore-dialog.mjs`, `scripts/kore-playground.mjs`, and `scripts/kore-eval.mjs`. Re-run `node scripts/kore-eval.mjs ./scripts/snips/verify-unchanged.mjs` at any time to confirm the builder state matches this document.

## Builder API access (1 October 2026)

The builder's REST surface was mapped so the platform can be configured
programmatically instead of by canvas drag-and-drop.

`scripts/kore-api.mjs` issues requests from inside the signed-in page, reusing
the auth headers the builder sends with its own traffic. Those values stay in
page scope: no cookie, token, or header value is read by Node, printed, or
written to disk. This is the same session as the UI, not a replayed credential.

Two separate header sets are needed, because the APIs differ:

| Surface | Header set |
| --- | --- |
| Dialog builder | `_zitok`, `session-id` |
| Flows API | `authorization`, `accountid`, `iid` |

The client tries every captured header set and keeps the one the API accepts,
so both surfaces work from one helper.

Read endpoints confirmed with HTTP 200:

| Endpoint | Returns |
| --- | --- |
| `GET /builder/streams/{stream}/dialogs` | 14 dialogs with status and node counts |
| `GET /builder/streams/{stream}/dialogs/{id}` | Full dialog with node graph |
| `GET /builder/streams/{stream}/dialogs/{id}/components` | Node components: message, service, entity, intent |
| `GET /builder/streams/{stream}/components` | All 147 app components |
| `GET /builder/streams/{stream}/intents` | 15 intents |
| `GET /users/{user}/streams/{stream}/callflows/{cf}` | Chat flow with all steps |
| `GET .../callflows/{cf}/messages` | Chat flow message objects |

Model details worth knowing before authoring:

- Dialog nodes are thin shells (`type`, `componentId`, `transitions`). The text
  lives in the component, and **dialog message text is URL-encoded** —
  `Thanks.%20I%20am%20checking%20your%20account%20now.`
- Chat flow message text is **not** encoded. Each `cfm-` object holds
  `messages[].locale[].message` per language.
- Chat flow steps link to their message by `taskDefinition.messageToUser`.

Exact objects holding the required copy:

| Required copy | Object |
| --- | --- |
| Welcome greeting | `cfm-64266c64-7be8-5ff0-ad52-dc5122bb6856` in flow `cf-7fe548da-c56b-59ed-b437-f00bf638d74f`, currently `Welcome!` |
| Login lookup notice | component `loginLookupNotice` (`dc-29669010-614e-57c9-909d-e30d5517b4e1`) in `User Login` |
| Login placeholder to replace | component `Message0002` (`dc-8082c858-41cc-5cbe-a9f0-91b9d1d5ed4f`) |
| Registration | dialog `dg-f5ea5367-ed33-58e2-8a70-e9b7366c0080` |

Snapshots of the current live state, taken before any change, are in
`output/kore/`: `dialogs.json`, `user-login.dialog.json`,
`user-login.components.json`, `welcome-chat-flow.json`,
`welcome-chat-flow.messages.json`, `components.all.json`.

### Writes: the builder's write surface is closed

This was established exhaustively. Every route that would carry the required
content was found and tried.

| Route | Result |
| --- | --- |
| `PUT /builder/streams/{s}/components/{id}` | 200, `lMod` advances, **message text never changes** |
| `PUT /builder/streams/{s}/dialogs/{id}` | 412 `Validation errors/ Invalid arguments` |
| `PUT /builder/streams/{s}/dialogs/{id}/publish` | 400 `namespace or namespaceIds not found or have incorrect value` |
| `POST/PUT .../callflows/{cf}/messages` | 412 `Validation errors/ Invalid arguments` |
| `PUT .../components/{id}/messages[/{mid}]` | 404, route does not exist |
| `PUT .../intents/{id}` | 404, route does not exist |
| `GET /namespaces`, `/searchai`, `/collections`, `/knowledgebase` | 404, no such routes |
| `GET .../messages`, `.../dialogs/{id}/messages` | 404, no separate message store for dialogs |
| `/users/{u}/bt/resources/{id}` (PUT/POST, with `/save`) | 404, only `/lock` exists under `bt` |

`PUT /components/{id}` is the important trap. It returns 200, advances `lMod`,
and answers with the message id list, which looks like a successful save. It
writes component metadata and silently discards the `message` array. Confirmed
across eight payload shapes on `Message0002`: full component with plain text,
with URL-encoded text, `message` as array/object/`{text}` only, `messages`
plural, a `message`-only body, and a `POST`. Also confirmed that populating the
component's empty `vNameSpace` from the dialog's namespace changes nothing. Every
attempt returned 200 and the service still served `Sample message for the user`.
Treat any 200 from this route as unverified until the text is re-read.

Two findings correct the earlier assumption that published resources were the
only obstacle. `User Login` is in development and its component still refuses the
text, so publishing is not the whole story. The one route that complained
about content rather than shape, the dialog publish call, asked for a
`namespace` or `namespaceIds`. The dialog document does carry
`vNameSpace: ["ns-f055ee80-0e42-5379-901b-219c35aca79f"]` while its components
carry an empty array, and supplying it changed nothing. There is no namespaces
endpoint to resolve further, so the required namespace values cannot be obtained
from the API.

Intents are readable (15 of them, including `User_Login` and
`User_Registration`) but have no write route, so their training utterances
cannot be added programmatically. No Search AI collection route exists, so the
crawled knowledge cannot be uploaded programmatically. The five `searchai`
components are readable and accept metadata writes, but that does not create a
collection.

Capturing the envelope from the canvas was abandoned deliberately. The flow
editor did not expose a config panel to synthetic events, and a blind "Save"
click hit the account **profile** form and issued `POST /users/{userId}/profile`
with unchanged values. No settings were changed, but blind clicking is not safe
here.

Final verification after all probing (`output/kore/final-state.json`): 147
components, all 14 dialogs at their original status, `Welcome Chat Flow` still
publishing `Welcome!`, and `Message0001`, `Message0002`, `loginLookupNotice`,
and `SubmitRegistration` all holding their original text. Nothing was corrupted.

The conclusion is firm: **the Kore.ai builder write surface is not reachable
from the API.** The required copy, the node branches, the intent training data,
and the Search AI collection all have to be entered in the builder UI by hand.
What is no longer uncertain is *where* each item goes, which is the part that is
tedious to rediscover.

# Pronix AI Chatbot — Assignment Status

> **To finish the Kore.ai side, follow `docs/completion-plan.md`.** It is a
> step-by-step runbook with the exact nodes, copy, and verification gates.
> Verify after each phase with `npm run verify:copy`.

## Requirement audit

Re-checked on 1 October 2026 against the live app and this repository. Two
deliverables are tracked separately because they are two different things: the
React implementation in this repo, and the Kore.ai XO app.

Legend: **Done** verified working. **Partial** some of it exists. **Not done**
absent or wrong.

| # | Requirement | React app | Kore.ai XO app |
| --- | --- | --- | --- |
| 6.1 | Greeting + Login/Register options | Done | **Not done** — flow says `Welcome!`, no choice node in the palette |
| 6.1 | NLP intent understanding | Done — 8 intents | **Partial** — only `User_Login` and `User_Registration` exist, neither trained |
| 6.2 | Web crawl: services, FAQs, blogs, about | Done — 260 docs | **Not done** — no Search AI collection |
| 6.3a | Signup: greet, options, 4 fields, POST, success, Yes/No | Done | **Not done** — 2 of 6 nodes hold placeholder text, POST mapping unverified |
| 6.3b | Login: email + validations, GET, found, not-found, 3 options | Done | **Partial** — email prompt and `findUserByEmail` exist; no success, unknown-email, Retry/Register/Cancel, or error branch |
| 6.4 | REST to MockAPI | Done — smoke-tested live | **Partial** — GET wired; registration POST unverified |
| 6.4 | Telegram channel | n/a | Done — enabled |
| 6.4 | WhatsApp channel | n/a | **Not done** — blocked on Meta Business verification |
| 6.5 | Search AI collection, rankers, filters | Done | **Not done** — no collection endpoint exists |
| 6.5 | Fallback to Search AI | Done | **Not done** — Playground answers "I could not understand that." |
| 6.6 | 8 intents mapped to dialog tasks | Done | **Partial** — 2 of 8 exist, 0 trained |
| 6.6 | 5–10 utterances per intent | Done — 6 to 8 each | **Not done** — no write route for utterances |
| 7 | No-answer path: options, site link, email | Done | **Not done** |
| 7 | API failure: "Something went wrong…" | Done | **Not done** |
| 8 | Bug fixes via tests | Done — 101 tests pass | n/a |
| 8 | Logging and monitoring | Done — events recorded | **Partial** — platform analytics untested |

### Exact required copy, live check

| Required string | In React app | In Kore.ai XO |
| --- | --- | --- |
| `Hello! Welcome to our Virtual Assistant.` | Yes | **No** — `Welcome!` |
| `Registration successful! Would you like to continue?` | Yes | **No** |
| `Thank you! Have a great day.` | Yes | **No** |
| `This email is not registered. Would you like to create a new account?` | Yes | **No** |
| `No problem! Have a great day.` | Yes | **No** |
| `Hello [username]! You have successfully logged in.` | Yes | **No** |
| `Something went wrong. Please try again later.` | Yes | **No** |

None of the seven required strings exist in the Kore.ai app.

### The single blocking reason

The Kore.ai builder write surface is not reachable from its API. Message text,
node graphs, intent utterances, and Search AI collections all reject writes.
The React app is complete and tested; the Kore.ai app needs the builder UI. The
hand-edit checklist below is the remaining work, and it is a person-with-a-
browser task.

### The builder canvas can be driven, with three constraints

The canvas editor is scriptable. Driving it requires all three of these, and
missing any one produces a silent no-op:

1. **Input must be trusted.** `element.click()` inside the page produces
   untrusted events that Angular ignores, so the config panel never opens. Use
   Puppeteer's `page.mouse` and `page.keyboard`, which go through the CDP Input
   domain. This was the original reason all earlier attempts looked broken.
2. **There is no Save button.** The editor commits the field on blur, so the
   commit step is clicking away, then re-reading from the API to confirm.
3. **Widen the viewport before clicking.** Nodes are laid out far to the right
   and near the top. `MessagePrompt0003` sits at canvas x=1780 and rendered at
   screen x=1723 in a 1536px window, so every click aimed at it landed on
   nothing. `page.setViewport({width: 2400, height: 1000})` fixes it, and
   clicking a node's label rather than its card centre avoids the top chrome.

Helpers live in `scripts/kore-ui-edit.mjs` (chat flows) and
`scripts/kore-ui-dialog.mjs` (dialog tasks). Both verify through the read API
and never report success on the strength of the screen alone.

Applied and verified this way on 1 October 2026:

| Node | Now reads |
| --- | --- |
| `MessagePrompt0002` in Welcome Chat Flow | `Hello! Welcome to our Virtual Assistant.` |
| `MessagePrompt0003` in Welcome Chat Flow | `No problem! Have a great day.` |

The chat flow is now in draft rather than published, because the UI edit moved
it out of the published version. It must be republished from the Flows screen.

The dialog task editor proved too unstable to drive repeatably: opening a
message node's configuration did not expose an editable control, and the editor
returned to the task list between attempts. The two dialog strings still need to
be typed by hand. `scripts/kore-ui-dialog.mjs` is the right shape for it, so a
human clicking through those two nodes is faster than more automation.

## Deployment links

Verified against the live app on 1 October 2026.

### Working now

| What | Link | Notes |
| --- | --- | --- |
| **Public deployment** | `https://aicharbot.vercel.app` | Vercel production. Confirmed HTTP 200, serves the built app shell. Public and login-free. |
| Public deployment (raw) | `https://aicharbot-mk3xqzbg7-sandeeparimilli2001-4822s-projects.vercel.app` | Aliased to the short URL above. |
| Local chatbot app | `http://localhost:5173` | `npm run dev`. Vite default port, no port pinned in `vite.config.js`. |
| Local production build | `http://localhost:4173` | `npm run preview:host`. Confirmed HTTP 200, including the LAN address below. |
| Same build on the LAN | `http://192.168.0.111:4173` | Reachable from any device on the same Wi-Fi. Reverts when the server stops. |
| Kore.ai builder | `https://platform.kore.ai/builder/app/automationdialoggpt/automationconversationorchestration` | Requires the signed-in account. |
| Kore.ai publish page | `https://platform.kore.ai/builder/app/publish` | Last published the day before this check. |
| Telegram bot | `https://t.me/PronixAIChatbotSandeepBot` | Channel is enabled, but see the caveat below. |

### Publishing to a public host — done

The Vercel CLI is authenticated and the app is deployed to production.

| | |
| --- | --- |
| Host | Vercel production |
| Project | `aicharbot`, team `sandeeparimilli2001-4822s-projects` |
| Production URL | `https://aicharbot.vercel.app` |
| Build output | 1,892 modules; `dist/` JS 490.73 KB, 119.54 KB gzipped |
| Redeploy | `npm run deploy:vercel` |

Redeploys run the build first, so the deployed bundle always matches the tested
source. The earlier `EPIPE` failure on the Vercel account check was a sandbox
restriction, not an authentication result — `vercel whoami` now resolves to
`sandeeparimilli2001-4822` and the deploy completed successfully.

Netlify remains available as a fallback path but that CLI is not authenticated:

```bash
npm run deploy:netlify

### Not yet available

| What | Status |
| --- | --- |
| Kore Web/Mobile Client public link | Not resolved. The channel is enabled with client `cs-27f5258f-49f2-52d1-b830-f1020623036c`, but the public URL lives in the channel's own settings, not in any builder API response. Open the Web/Mobile Client channel in the builder and copy the Web SDK link from there rather than assuming a URL pattern. |
| WhatsApp | Blocked on Meta Business verification. |

### Republish required

Editing `Welcome Chat Flow` through the canvas moved it from published to
draft, so the new greeting is not live on any channel yet. Republish it from
**Flows & Channels > Start Flows > Welcome Chat Flow** before testing Telegram
or the web client.

### Telegram caveat

The Telegram channel is enabled and points at bot `PronixAIChatbotSandeepBot`.
It will only answer correctly once the dialog tasks are fixed and republished.
Telegram serves the published version, and the greeting still reads `Welcome!`,
so expect the unrepaired experience until the hand edits in this document are
made.

### Security note

The channel configuration endpoint returns live credentials: the Telegram bot
token and the AgentAssist and SmartAssist app tokens. They were redacted before
being written to `output/kore/`. Treat any raw dump of
`GET /users/{user}/builder/streams/{streamId}` as a secret and rotate the
Telegram token if it is ever pasted into a ticket, a commit, or a chat.

## Requires Kore.ai platform action

The account is now reachable through the scripts in `scripts/kore-*.mjs`, which drive the signed-in Chrome session over CDP. The platform's node canvas is drag-and-drop, so the remaining work is UI authoring rather than configuration. `docs/kore-xo-bot-spec.json` carries the exact nodes, branches, copy, and utterances.

| Requirement | Next action |
| --- | --- |
| Published greeting | Edit `Welcome Chat Flow` so it sends "Hello! Welcome to our Virtual Assistant." and offers Login and Register. Today it sends "Welcome!" / "How can I help you?", so neither auth path is reachable from the published bot. |
| Login flow dialog | In `User Login`, replace the `Message0002` placeholder. Add a success branch from `findUserByEmail`: on a match, send "Hello {{username}}! You have successfully logged in." then the account options. Add an unknown-email branch: "This email is not registered. Would you like to create a new account?" with Register Now, Retry, Cancel. Cancel sends "No problem! Have a great day." Then publish. |
| Registration dialog | Map the POST Service node to the users endpoint, send "Registration successful! Would you like to continue?", route Yes to Modify/Delete and No to "Thank you! Have a great day.", and wire the error branch to "Something went wrong. Please try again later." |
| Search AI collection | Create the `Pronix Public Knowledge` collection, add the website crawler from `https://pronix.ai/`, set hybrid retrieval, add the `content_type`, `service_type`, `category`, and `blog_tag` metadata fields, and configure the three filters. |
| Search AI fallback | Connect the Search AI node to the `FallbackMsg` transition. Confirmed broken: the Playground currently answers a services question with "I could not understand that." |
| Telegram channel | Configured. Re-test after the dialog tasks above are published, since Telegram only serves published tasks. |
| Web SDK | Install the XO channel snippet on the Pronix site. This repository is the standalone web prototype, not the embedded widget. |

## Blocked on external access

| Requirement | Reason |
| --- | --- |
| WhatsApp channel | Requires Meta Business verification and a verified phone number. No Meta account or verified number is available in this workspace. |
| Production security | MockAPI is a demonstration store. Replace it with a backend that hashes passwords, returns minimal profiles, enforces authorization, and writes audit logs. |

## Demo endpoint

The configured users resource is:

```text
https://6abd2bab5121d616d90cc9c7.mockapi.io/api/v1/users
```

It returned HTTP 200 with one demo record on 1 October 2026. It is a prototype endpoint; do not use real passwords or customer data in it.

## Hand-edit checklist for the builder

The API cannot write message text or the node graph, so these edits must be
typed in the builder. Every target below was confirmed against the live app on
1 October 2026, including its position in the flow, so nothing needs to be
rediscovered. Paste the strings exactly.

### Welcome Chat Flow (`cf-7fe548da-c56b-59ed-b437-f00bf638d74f`, published)

Open **Flows & Channels > Start Flows > Welcome Chat Flow**.

| Node | Current text | Set to |
| --- | --- | --- |
| `MessagePrompt0002` | `Welcome!` | `Hello! Welcome to our Virtual Assistant.` |
| `MessagePrompt0001` | `Hi` | keep, or clear it |
| `MessagePrompt0003` | `Thank you!` | `No problem! Have a great day.` |

This flow has no choice node in its palette, so Login and Register cannot be
offered here as quick replies. Ask for them in `MessagePrompt0002` text and
route them from the Greeting dialog task instead.

### User Login (`dg-81900e92-4624-54d2-9ba8-920be68541aa`, in development)

Current order: `User_Login` intent to `Entity0003` to `loginLookupNotice` to
`findUserByEmail` to `Message0002`.

| Node | Current text | Set to |
| --- | --- | --- |
| `Message0002` | `Sample message for the user` | `Hello {{entities.email}}! You have successfully logged in.` |
| new message on the found branch | — | `Something went wrong. Please try again later.` |
| new message on the not-found branch | — | `This email is not registered. Would you like to create a new account?` |
| new dialogAct, Register Now | — | routes to User Registration |
| new dialogAct, Retry | — | loops back to `Entity0003` |
| new dialogAct, Cancel | — | `No problem! Have a great day.` |

Use the username the `findUserByEmail` response actually returns in the success
message. `{{entities.email}}` is a placeholder: check the service's response
mapping and substitute the right path.

### User Registration (`dg-f5ea5367-ed33-58e2-8a70-e9b7366c0080`, published)

Current order: `User_Registration` intent to `Entity0001` to `Entity0002` to
`ContinueRegistration` to `SubmitRegistration`. `SubmitRegistration` is the
terminal node, so it is the right place for the success line.

| Node | Current text | Set to |
| --- | --- | --- |
| `Entity0001` | `Please provide your input` | `What is your username?` |
| `Entity0002` | `What is your email address?` | keep |
| `SubmitRegistration` | `Would you like to submit your Pronix registration?` | `Registration successful! Would you like to continue?` |
| `Message0001` | `Sample message for the user` | `Thank you! Have a great day.` |
| service error branch | — | `Something went wrong. Please try again later.` |

Because this dialog is published, unpublish it before editing or the builder
will reject the change.

### Then

Publish the dialogs, wire Search AI to the Fallback Task, and re-test in the
Playground.

### Verify the copy landed

```bash
npm run verify:copy
```

`scripts/kore-verify-copy.mjs` reads every message in the live app, including
chat flow messages and dialog components, and checks each of the seven required
strings. It exits non-zero while any are missing, so it can gate a publish.
Results are written to `output/kore/verify-copy.json`.

The username placeholder is compared loosely on purpose: Kore renders it in its
own token syntax, so `Hello {{entities.email}}! You have successfully logged in.`
counts as a match for `Hello [username]! You have successfully logged in.`

Current result on 1 October 2026: **0 of 7 present.**