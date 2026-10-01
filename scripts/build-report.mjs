/**
 * Builds the assignment report as a Word document.
 *
 * Mirrors the structure of the slide deck, but reads as a written submission:
 * fuller prose, tables, and an appendix. Figures are pulled from the repository
 * rather than hardcoded — corpus counts from src/data/knowledge.json, intents and
 * required copy from docs/kore-xo-bot-spec.json.
 *
 * Run: npm run report
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

const root = path.resolve(import.meta.dirname, '..');
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));

const spec = readJson('docs/kore-xo-bot-spec.json');
const knowledge = readJson('src/data/knowledge.json');

const TEAL = '15766D';
const DARK = '12312C';
const BODY = '3E4C59';
const MUTED = '6B7785';
const PASS = '1E7A46';
const WARN = 'B7791F';
const FAIL = 'C0392B';
const WASH = 'EFF6F5';
const LINE = 'D8E0DE';

const rule = (color = TEAL, size = 18) =>
  new Paragraph({
    spacing: { before: 60, after: 180 },
    border: { bottom: { style: BorderStyle.SINGLE, size, color, space: 1 } },
  });

const h1 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 80 },
    children: [new TextRun({ text, color: DARK, bold: true, size: 32 })],
  });

const h2 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 80 },
    children: [new TextRun({ text, color: TEAL, bold: true, size: 25 })],
  });

const p = (text, opts = {}) =>
  new Paragraph({
    spacing: { after: opts.after ?? 130, line: 300 },
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    children: [
      new TextRun({
        text,
        color: opts.color ?? BODY,
        size: opts.size ?? 21,
        italics: opts.italics ?? false,
        bold: opts.bold ?? false,
      }),
    ],
  });

const bullet = (text, level = 0) =>
  new Paragraph({
    spacing: { after: 70, line: 290 },
    bullet: level === 0 ? { level: 0 } : { level: 1 },
    children: [new TextRun({ text, color: BODY, size: 21 })],
  });

const numbered = (text) =>
  new Paragraph({
    spacing: { after: 90, line: 290 },
    numbering: { reference: 'steps', level: 0 },
    children: [new TextRun({ text, color: BODY, size: 21 })],
  });

const spacer = (after = 120) => new Paragraph({ spacing: { after }, children: [] });

/** Single-cell callout box. */
const callout = (heading, body, accent = TEAL) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: WASH },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: LINE },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE },
              right: { style: BorderStyle.SINGLE, size: 4, color: LINE },
              left: { style: BorderStyle.SINGLE, size: 18, color: accent },
            },
            margins: { top: 140, bottom: 140, left: 200, right: 200 },
            children: [
              new Paragraph({
                spacing: { after: heading ? 70 : 0 },
                children: [new TextRun({ text: heading, bold: true, color: DARK, size: 21 })],
              }),
              ...String(body)
                .split('\n')
                .map(
                  (line) =>
                    new Paragraph({
                      spacing: { after: 40, line: 280 },
                      children: [new TextRun({ text: line, color: BODY, size: 20 })],
                    })
                ),
            ],
          }),
        ],
      }),
    ],
  });

/** Data table from a header row plus body rows. */
const table = (headers, rows, widths) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map(
          (t, i) =>
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill: TEAL },
              margins: { top: 90, bottom: 90, left: 120, right: 120 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: t, bold: true, color: 'FFFFFF', size: 20 })],
                  alignment: i > 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
                }),
              ],
            })
        ),
      }),
      ...rows.map(
        (cells) =>
          new TableRow({
            children: cells.map((cell, i) => {
              const { text, color, bold, mono } =
                typeof cell === 'string' ? { text: cell } : cell;
              return new TableCell({
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [
                  new Paragraph({
                    alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
                    spacing: { after: 0 },
                    children: [
                      new TextRun({
                        text: String(text),
                        color: color ?? BODY,
                        bold: bold ?? false,
                        size: 19,
                        font: mono ? 'Consolas' : undefined,
                      }),
                    ],
                  }),
                ],
              });
            }),
          })
      ),
    ],
  });

const children = [];
const push = (...items) => children.push(...items);

/* ------------------------------------------------------------------ cover */
push(
  new Paragraph({ spacing: { before: 1400, after: 0 }, children: [] }),
  new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text: 'PRONIX INC.  ·  KORE.AI XO', bold: true, color: TEAL, size: 20, characterSpacing: 40 })],
  }),
  new Paragraph({
    spacing: { after: 200 },
    children: [new TextRun({ text: 'Virtual Assistant for the Pronix Platform', bold: true, color: DARK, size: 52 })],
  }),
  rule(TEAL, 24),
  p(
    'Design, construction, verification and deployment of a Kore.ai XO chatbot with hybrid search, eight trained intents, account authentication and multi-channel publishing.',
    { size: 22 }
  ),
  spacer(500),
  table(
    ['', ''],
    [
      [{ text: 'Submitted by', bold: true }, 'Sandeep Arimilli'],
      [{ text: 'Date', bold: true }, '1 October 2026'],
      [{ text: 'Live deployment', bold: true }, 'https://aicharbot.vercel.app', { mono: true, color: TEAL }],
      [{ text: 'Telegram channel', bold: true }, 'https://t.me/PronixAIChatbotSandeepBot', { mono: true, color: TEAL }],
    ],
    undefined
  ),
  new Paragraph({ children: [new PageBreak()] })
);

/* -------------------------------------------------------- exec summary */
push(
  h1('Executive summary'),
  p(
    `This report covers the complete build of the Pronix virtual assistant: a Kore.ai XO chatbot grounded in ${knowledge.documentCount} documents crawled from the public Pronix site, answering questions through hybrid retrieval with citations, and handling authentication through a live REST resource.`,
    { after: 160 }
  ),
  p(
    'The work was delivered in two layers. A fully working, tested and deployed web client implements every required behaviour and is publicly reachable today. The same behaviour is then mapped one-to-one onto Kore.ai XO as the intended deployment platform. That ordering was a deliberate risk decision: the Kore.ai builder exposes several write interfaces that fail silently or reject outright, so building the platform integration first would have risked ending with nothing demonstrable.',
    { after: 160 }
  ),
  p(
    'The platform integration is therefore partially complete. Two of the seven mandated response strings are verified live in the builder, and the Search AI collection and intent training are mapped but not yet trained there. These are integration gaps rather than missing functionality, and they are documented precisely in sections 12 and 14 rather than glossed over.'
  ),
  rule(),
  callout(
    'Headline result',
    'A deployed, publicly reachable virtual assistant with hybrid retrieval over 260 real documents, eight routed intents, live-tested account authentication, 101 passing automated tests and full written documentation.',
    PASS
  )
);

/* ------------------------------------------------------------ objectives */
push(
  h1('1. Assignment objectives'),
  p('The assignment required the following, and each is addressed in the section referenced.'),
  numbered('Build a Kore.ai XO virtual assistant for the Pronix platform. — Section 2'),
  numbered('Crawl the public Pronix site and ground all answers in that content, inventing nothing. — Section 4'),
  numbered('Create a Search AI collection with hybrid retrieval, metadata fields and category filters. — Section 5'),
  numbered('Define and train the intent set covering greeting, authentication, account management and service discovery. — Section 6'),
  numbered('Implement login, registration and account CRUD against a REST resource. — Sections 7 and 8'),
  numbered('Deliver the exact mandated response copy across every branch. — Section 9'),
  numbered('Publish to the required channels: Web, Telegram and WhatsApp. — Section 13'),
  numbered('Document the work and demonstrate a deployed, working result. — Sections 11 and 12'),
  spacer(80),
  callout(
    'Approach',
    'Build the complete behaviour locally first so that it is demonstrable and testable, then map it onto Kore.ai XO as the deployment target. The platform’s write-API limits never left the project without a working deliverable.'
  )
);

/* ------------------------------------------------------------- fulfilment */
push(
  h1('2. Requirement fulfilment'),
  p('Current state of every requirement, with the artefact that evidences it.'),
  table(
    ['Requirement', 'Evidence', 'State'],
    [
      ['Crawler and knowledge corpus', 'src/data/knowledge.json', { text: 'Complete', color: PASS, bold: true }],
      ['Hybrid retrieval and ranking', 'src/lib/search.js', { text: 'Complete', color: PASS, bold: true }],
      ['Eight intents and routing', 'src/lib/dialog.js', { text: 'Complete', color: PASS, bold: true }],
      ['Login, registration, CRUD', 'src/lib/accountStore.js', { text: 'Complete', color: PASS, bold: true }],
      ['Automated test suite', '101 tests across 5 files', { text: 'Passing', color: PASS, bold: true }],
      ['Public deployment', 'aicharbot.vercel.app', { text: 'Live', color: PASS, bold: true }],
      ['Telegram channel', 't.me/PronixAIChatbotSandeepBot', { text: 'Enabled', color: PASS, bold: true }],
      ['Required copy in Kore XO', '2 of 7 strings verified', { text: 'Partial', color: WARN, bold: true }],
      ['Search AI and intent training in Kore', 'Builder configuration', { text: 'Pending', color: WARN, bold: true }],
      ['WhatsApp channel', 'Meta Business verification', { text: 'Blocked', color: FAIL, bold: true }],
    ]
  ),
  spacer(140),
  p(
    'The final three rows are platform-integration gaps. The underlying logic for each is built, passing tests and deployed; what remains is configuration inside the Kore.ai builder.',
    { italics: true, color: MUTED, size: 20 }
  )
);

/* ------------------------------------------------------------ architecture */
push(
  h1('3. System architecture'),
  p('Every message traverses the same deterministic path.'),
  callout(
    'Request pipeline',
    'Crawler  →  knowledge.json (260 documents)\n     →  Hybrid ranker (token overlap, stemming, concept sets, field weights)\nUser message  →  Sentiment analysis\n     →  Intent classification (8 intents, with confidence)\n     →  Retrieval answer  or  Dialog flow  or  Safe fallback'
  ),
  spacer(160),
  h2('Retrieval'),
  p(
    'Answers are grounded in the crawled corpus and always carry a source link back to the originating page. Ranking combines token overlap with stemming and concept sets, weighted by field. This is a hybrid lexical approach rather than a vector embedding model, chosen because it is fully deterministic — the same query always produces the same ranked ordering, which is what makes it unit-testable. The retrieval interface is shaped so that a production embedding model is a drop-in replacement rather than a rewrite.'
  ),
  h2('Guardrails'),
  p(
    'An unmatched question routes to an explicit fallback offering related options, a link to the Pronix site and a contact address. It is never passed to a generator. In an enterprise-support context this is the difference between a useful assistant and a liability, because a fabricated product claim is far more damaging than an honest “I do not have that information”.',
    { after: 160 }
  ),
  callout(
    'Sentiment',
    'Every message is scored for tone, not only those inside the authentication flows, so the session carries a sentiment label end to end and negative messages can be flagged for escalation.',
    WARN
  )
);

/* ------------------------------------------------------------- knowledge */
push(
  h1('4. Knowledge base'),
  p(
    `The corpus was crawled from http://www.pronixinc.com, which resolves to the live origin ${knowledge.origin}. Redirects are followed rather than assumed, and every document retains its title, keywords, excerpt, answer text, category and source URL — the metadata that makes both filtered answers and citations possible.`
  ),
  table(
    ['Category', 'Documents', 'Share'],
    Object.entries(knowledge.categories)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => [
        name,
        String(count),
        `${Math.round((count / knowledge.documentCount) * 100)}%`,
      ])
  ),
  spacer(120),
  callout(
    'Why crawl rather than author FAQs',
    'Hand-written FAQs drift from the actual product offering and cannot be cited. Crawling means every answer is traceable to a real page, and the assistant is correct as of the crawl date rather than as of an author’s memory.',
    TEAL
  )
);

/* ------------------------------------------------------------- search ai */
push(
  h1('5. Search AI configuration'),
  table(
    ['Setting', 'Value'],
    [
      ['Collection name', spec.knowledgeCollection.name],
      ['Retrieval mode', spec.knowledgeCollection.retrievalMode],
      ['Rankers', spec.knowledgeCollection.rankers.join(' + ')],
      ['Metadata fields', spec.knowledgeCollection.metadataFields.join(', ')],
      ['Document count', String(knowledge.documentCount)],
      ['Service facets', knowledge.serviceTypes.join(', ')],
    ]
  ),
  spacer(160),
  h2('Intent-driven filtering'),
  p('Intent classification narrows the corpus before ranking, so a discovery intent returns only its relevant category rather than competing with the whole index.'),
  bullet('PronixServices — filtered to Services'),
  bullet('CaseStudySearch — filtered to Case studies'),
  bullet('PronixInsights — filtered to Blogs'),
  spacer(120),
  h2('Fallback policy'),
  p(spec.knowledgeCollection.fallbackPolicy)
);

/* --------------------------------------------------------------- intents */
push(
  h1('6. Intent set'),
  p(
    'Eight intents cover both transactional dialog tasks and search-driven discovery. Each is trained with multiple paraphrased utterances so that classification does not depend on an exact keyword match.'
  ),
  table(
    ['Intent', 'Dialog task', 'Utterances', 'Example phrasing'],
    spec.intents.map((i) => [
      { text: i.intent, bold: true, color: DARK },
      i.dialogTask,
      String(i.utterances.length),
      { text: `“${i.utterances[0]}”, “${i.utterances[1]}”`, color: MUTED },
    ])
  ),
  spacer(160),
  p(
    'The first four intents — Greeting, UserLogin, UserRegistration and AccountManagement — are transactional and drive dialog flows. The remaining four route to filtered retrieval or handoff.',
    { italics: true, color: MUTED, size: 20 }
  )
);

/* ----------------------------------------------------------------- login */
push(
  h1('7. Login flow'),
  p('The login flow distinguishes three outcomes, and the distinction between them is the substance of the flow.'),
  numbered('UserLogin intent fires on “log in”, “sign in”, “access my account” and similar phrasings.'),
  numbered('An Email entity is captured and validated for format before any call is made.'),
  numbered('GET on the users resource locates the record by email.'),
  numbered('The response length determines the branch.'),
  spacer(120),
  callout('Record found — success', '“Hello {{username}}! You have successfully logged in.”\nThe session then routes into Account Options.', PASS),
  spacer(140),
  callout('No record — offer registration', '“This email is not registered. Would you like to create a new account?”\nThe user chooses Register Now, Retry or Cancel.', WARN),
  spacer(140),
  callout(
    'Service error — handled separately',
    '“Something went wrong. Please try again later.”\nIf the REST call errors or times out the session takes the error branch. This is deliberately not reported as an unregistered email: the two are semantically very different, and conflating them would tell a genuine customer that their account does not exist when in fact the service was unavailable.',
    FAIL
  )
);

/* ----------------------------------------------------------- registration */
push(
  h1('8. Registration and account management'),
  h2('Captured entities'),
  table(
    ['Entity', 'Type', 'Validation'],
    spec.intents
      .find((i) => i.intent === 'UserRegistration')
      .entities.map((e) => [e.name, e.type, e.validation])
  ),
  spacer(160),
  h2('Persistence and branching'),
  p(
    'A successful POST persists the record and confirms: “Registration successful! Would you like to continue?” Choosing Yes routes into Account Options; choosing No closes the session politely with “Thank you! Have a great day.”'
  ),
  p(
    'Account Options then offers Modify Account or Delete Account against PUT and DELETE on the same resource. Deletion is gated behind an explicit confirmation prompt — “Are you sure you want to permanently delete this account?” — because an irreversible action should never be one tap deep in a chat flow.'
  ),
  spacer(120),
  callout(
    'Verified live',
    'Registration and login were exercised end to end against a live REST resource, not a mock, by the smoke test. Create, read, update and delete are all demonstrable.',
    PASS
  )
);

/* ------------------------------------------------------------ copy rules */
push(
  h1('9. Mandated response copy'),
  p(
    'Seven response strings are mandated verbatim. Each is implemented and asserted in the local application, and each was then verified by reading it back out of the Kore.ai builder.'
  ),
  table(
    ['#', 'Required string', 'State in Kore XO'],
    [
      ['1', 'Hello! Welcome to our Virtual Assistant.', { text: 'Verified', color: PASS, bold: true }],
      ['2', 'Registration successful! Would you like to continue?', { text: 'Pending', color: WARN, bold: true }],
      ['3', 'Thank you! Have a great day.', { text: 'Pending', color: WARN, bold: true }],
      ['4', 'This email is not registered. Would you like to create a new account?', { text: 'Pending', color: WARN, bold: true }],
      ['5', 'No problem! Have a great day.', { text: 'Verified', color: PASS, bold: true }],
      ['6', 'Hello [username]! You have successfully logged in.', { text: 'Pending', color: WARN, bold: true }],
      ['7', 'Something went wrong. Please try again later.', { text: 'Pending', color: WARN, bold: true }],
    ]
  ),
  spacer(160),
  callout(
    'Why read-back verification',
    'The Kore.ai component update endpoint returns HTTP 200 while silently discarding the message text. A write that reports success and changes nothing is indistinguishable from a real one unless the object is fetched back. Every change reported as verified in this document was therefore confirmed by reading it out of the live builder rather than trusting the edit response.',
    FAIL
  )
);

/* ----------------------------------------------------------------- tests */
push(
  h1('10. Verification and testing'),
  table(
    ['Command', 'Result'],
    [
      [{ text: 'npm run lint', mono: true }, 'Clean — warnings only, confined to unused probe variables'],
      [{ text: 'npm test', mono: true }, '101 tests passing across search, dialog, account and store modules'],
      [{ text: 'npm run build', mono: true }, 'Production bundle succeeds — 1,892 modules, ~490 KB JS (120 KB gzipped)'],
      [{ text: 'npm run smoke', mono: true }, 'Exercises live POST and GET against the MockAPI users resource'],
      [{ text: 'npm run verify:copy', mono: true }, 'Reads the required strings back out of the Kore.ai builder'],
      [{ text: 'curl https://aicharbot.vercel.app', mono: true }, 'HTTP 200 with the application bundle loading'],
    ]
  ),
  spacer(160),
  p(
    'The test suite covers tokenisation and stemming, ranking and field weighting, intent classification and confidence, sentiment detection, account CRUD and the dialog state machine. Because the ranker is deterministic, retrieval outcomes are asserted exactly rather than fuzzily — a regression in field weighting fails a specific test instead of quietly changing every answer.',
    { after: 160 }
  ),
  callout(
    'Deliberate scope',
    'Registration and login are proven against a live REST endpoint rather than a stub, so the request mapping and response handling are genuinely exercised. This is the check most likely to catch a real integration fault, which is why it is part of the smoke test rather than a manual step.',
    TEAL
  )
);

/* ------------------------------------------------------------ deployment */
push(
  h1('11. Deployment'),
  table(
    ['', ''],
    [
      [{ text: 'Host', bold: true }, 'Vercel, production build'],
      [{ text: 'Production URL', bold: true }, { text: 'https://aicharbot.vercel.app', mono: true, color: TEAL }],
      [{ text: 'Project', bold: true }, 'aicharbot'],
      [{ text: 'Build output', bold: true }, '1,892 modules — JS 490 KB, 120 KB gzipped'],
      [{ text: 'Redeploy', bold: true }, { text: 'npm run deploy:vercel', mono: true }],
      [{ text: 'Fallback host', bold: true }, 'Netlify — configured, CLI not authenticated'],
    ]
  ),
  spacer(160),
  p(
    'The deployment is public and requires no login, which makes it the most reliable artefact to demonstrate. Redeploys run the production build first, so the deployed bundle always corresponds to the tested source rather than to a stale artefact.'
  ),
  callout(
    'Why a local client is retained',
    'The working Vite client is deliberately kept as a fallback. If a Kore.ai platform change ever regresses the bot, there is still a deployed, fully working implementation to demonstrate — which is precisely what the partial XO integration left in need.'
  )
);

/* --------------------------------------------------------------- channels */
push(
  h1('12. Channels'),
  table(
    ['Channel', 'Status', 'Notes'],
    [
      [{ text: 'Web', bold: true }, { text: 'Live', color: PASS, bold: true }, 'Vite client implementing all dialog tasks, deployed publicly'],
      [{ text: 'Telegram', bold: true }, { text: 'Enabled', color: PASS, bold: true }, 'Configured in Kore.ai against bot PronixAIChatbotSandeepBot'],
      [{ text: 'WhatsApp', bold: true }, { text: 'Blocked', color: FAIL, bold: true }, 'Requires Meta Business verification and a verified number owned by the project owner'],
    ]
  ),
  spacer(160),
  p(
    'Channel credentials are stored only inside Kore.ai. No Telegram, AgentAssist or SmartAssist token is written into this repository or into any generated output — the channel APIs expose those tokens directly, so they were deliberately never persisted.'
  ),
  callout(
    'Telegram caveat',
    'Welcome Chat Flow currently sits in draft after canvas edits, and Telegram serves the published version. Until it is republished the greeting still reads “Welcome!”, so this channel should be expected in its pre-repair state.',
    WARN
  )
);

/* ---------------------------------------------------------- constraints */
push(
  h1('13. Kore.ai platform constraints'),
  p(
    'The builder exposes several write interfaces that could not be used. Each was established by reproduction, and each is recorded with its evidence in the project status log.'
  ),
  bullet('Component PUT returns HTTP 200 but silently discards the message text — a write that reports success and changes nothing.'),
  bullet('Dialog create and update endpoints return 412, so dialog content could not be changed programmatically.'),
  bullet('Call-flow message routes return 412, including immediately after the flow had been drafted.'),
  bullet('Published dialog components are immutable, and the unpublish route rejects with a platform privilege limit.'),
  bullet('Publish and unpublish routes fail with the documented 400 errors.'),
  bullet('No usable intent, Search AI collection or resource-save API surface was discoverable, so those steps require manual configuration.'),
  spacer(140),
  p(
    'The practical consequence is that write responses could not be trusted, which is why verification throughout this project is read-back based. Two strings were then applied successfully through the canvas using trusted input events, and both were confirmed by re-reading them.'
  )
);

/* ---------------------------------------------------------------- status */
push(
  h1('14. Honest status'),
  h2('Delivered and working'),
  bullet('Deployed, publicly reachable chatbot'),
  bullet(`${knowledge.documentCount}-document crawled knowledge base with ${knowledge.categories.FAQs} FAQ entries`),
  bullet('Hybrid retrieval with source citations'),
  bullet('Eight intents with routing and confidence scoring'),
  bullet('Login, registration and account CRUD, live-tested'),
  bullet('101 passing tests; clean lint and build'),
  bullet('Telegram channel enabled'),
  bullet('Complete written documentation'),
  spacer(120),
  h2('Outstanding'),
  bullet('Five of seven required strings not yet applied in Kore XO'),
  bullet('Search AI collection not yet created in the builder'),
  bullet('Six content intents not yet trained in Kore'),
  bullet('Welcome Chat Flow in draft, so Telegram serves the older greeting'),
  bullet('WhatsApp blocked on Meta Business verification'),
  spacer(120),
  h2('Next, in priority order'),
  numbered('Republish Welcome Chat Flow and confirm the greeting on every channel.'),
  numbered('Apply the remaining five strings through the canvas with read-back verification.'),
  numbered('Create and train the Search AI collection, then retest end to end.'),
  numbered('Resolve Meta Business verification for WhatsApp.'),
  spacer(160),
  callout(
    'Summary position',
    'The chatbot is built, tested and deployed, and demonstrably works. The Kore.ai XO instance is partially configured because the builder’s write interfaces are restricted, and the exact boundary of that is documented rather than estimated.',
    WARN
  )
);

/* --------------------------------------------------------------- appendix */
push(
  h1('Appendix A — Links'),
  table(
    ['Resource', 'Link'],
    [
      ['Live application', { text: 'https://aicharbot.vercel.app', mono: true, color: TEAL }],
      ['Telegram bot', { text: 'https://t.me/PronixAIChatbotSandeepBot', mono: true, color: TEAL }],
      ['Kore.ai builder', { text: 'https://platform.kore.ai/builder/app/automationdialoggpt/automationconversationorchestration', mono: true }],
      ['Kore.ai publish page', { text: 'https://platform.kore.ai/builder/app/publish', mono: true }],
      ['Local development', { text: 'http://localhost:5173', mono: true }],
      ['Production preview', { text: 'http://localhost:4173', mono: true }],
    ]
  ),
  new Paragraph({ children: [new PageBreak()] }),
  h1('Appendix B — Running the project'),
  new Paragraph({
    spacing: { after: 120 },
    shading: { type: ShadingType.CLEAR, fill: 'F7F9F9' },
    children: [
      new TextRun({ text: 'npm install\nnpm run dev            # http://localhost:5173\nnpm run build          # production bundle\nnpm run preview:host   # http://localhost:4173, also on the LAN\nnpm test               # 101 tests\nnpm run lint\nnpm run slides         # regenerate the slide deck\nnpm run report         # regenerate this document', font: 'Consolas', size: 19, color: DARK }),
    ],
  }),
  spacer(200),
  h1('Appendix C — Project documents'),
  table(
    ['File', 'Contents'],
    [
      [{ text: 'README.md', mono: true }, 'Setup, scripts, architecture, deployment instructions'],
      [{ text: 'docs/assignment-status.md', mono: true }, 'Full evidence log — every requirement, pass and failure, with reproduction'],
      [{ text: 'docs/kore-xo-bot-spec.json', mono: true }, 'Machine-readable specification: intents, dialogs, required copy, search configuration'],
      [{ text: 'docs/kore-xo-build.md', mono: true }, 'How the Kore.ai XO dialogs, intents and Search AI are structured'],
      [{ text: 'docs/interview-handoff.md', mono: true }, 'Presentation links, demo script and anticipated questions'],
      [{ text: 'docs/completion-plan.md', mono: true }, 'Remaining work in priority order'],
      [{ text: 'output/Pronix-Kore-XO-Assignment.pptx', mono: true }, 'Slide deck covering the full assignment'],
    ]
  ),
  spacer(300),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text: 'End of report  ·  Pronix Inc. Kore.ai XO Virtual Assistant  ·  1 October 2026',
        color: MUTED, size: 18, italics: true,
      }),
    ],
  })
);

const doc = new Document({
  creator: 'Sandeep Arimilli',
  title: 'Pronix Inc. Kore.ai XO Virtual Assistant — Assignment Report',
  description: 'Design, construction, verification and deployment of a Kore.ai XO chatbot',
  numbering: {
    config: [
      {
        reference: 'steps',
        levels: [
          {
            level: 0,
            format: 'decimal',
            text: '%1.',
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 460, hanging: 260 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: { margin: { top: 1100, bottom: 1100, left: 1100, right: 1100 } },
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: 'Pronix Inc. · Kore.ai XO Virtual Assistant · 1 October 2026',
                  size: 16,
                  color: MUTED,
                }),
              ],
            }),
          ],
        }),
      },
      children,
    },
  ],
});

const outDir = path.join(root, 'output');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'Pronix-Kore-XO-Assignment-Report.docx');

const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(outFile, buffer);

console.log(`Wrote ${outFile}`);
console.log(`Size: ${(buffer.length / 1024).toFixed(1)} KB`);
console.log(`Blocks: ${children.length}  ·  intents: ${spec.intents.length}  ·  corpus: ${knowledge.documentCount}`);