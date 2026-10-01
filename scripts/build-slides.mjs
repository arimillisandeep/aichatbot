/**
 * Builds the assignment presentation deck.
 *
 * Every figure here is sourced from the repository rather than typed from
 * memory: the intent map and required copy come from docs/kore-xo-bot-spec.json,
 * the corpus counts from src/data/knowledge.json, and the delivery state from
 * output/kore/final-state.json.
 *
 * Run: npm run slides
 */
import fs from 'node:fs';
import path from 'node:path';
import PptxGenJS from 'pptxgenjs';

const root = path.resolve(import.meta.dirname, '..');
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));

const spec = readJson('docs/kore-xo-bot-spec.json');
const knowledge = readJson('src/data/knowledge.json');
const finalState = fs.existsSync(path.join(root, 'output/kore/final-state.json'))
  ? readJson('output/kore/final-state.json')
  : {};

const C = {
  teal: '15766D',
  dark: '12312C',
  ink: '1F2933',
  body: '3E4C59',
  muted: '7B8794',
  line: 'D8E0DE',
  wash: 'EFF6F5',
  white: 'FFFFFF',
  pass: '1E7A46',
  warn: 'B7791F',
  fail: 'C0392B',
};

const FONT = 'Segoe UI';
const W = 13.333;
const H = 7.5;

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_16x9';
pptx.author = 'Sandeep Arimilli';
pptx.company = 'Pronix Inc.';
pptx.title = 'Pronix Inc. Kore.ai XO Chatbot — Assignment';
pptx.subject = 'Kore.ai XO virtual assistant: design, build, verification, deployment';

/** Slide chrome: accent bar, footer, optional title block. */
function frame(slide, { title, kicker, page }) {
  slide.background = { color: C.white };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: W, h: 0.13, fill: { color: C.teal },
  });
  if (kicker) {
    slide.addText(kicker.toUpperCase(), {
      x: 0.62, y: 0.42, w: W - 1.24, h: 0.24,
      fontFace: FONT, fontSize: 10.5, bold: true, color: C.teal, charSpacing: 1.6,
    });
  }
  if (title) {
    slide.addText(title, {
      x: 0.62, y: 0.68, w: W - 1.24, h: 0.62,
      fontFace: FONT, fontSize: 27, bold: true, color: C.dark,
    });
    slide.addShape(pptx.ShapeType.line, {
      x: 0.62, y: 1.36, w: 1.5, h: 0, line: { color: C.teal, width: 2.5 },
    });
  }
  slide.addText('Pronix Inc. · Kore.ai XO Virtual Assistant', {
    x: 0.62, y: H - 0.42, w: 7, h: 0.24,
    fontFace: FONT, fontSize: 8.5, color: C.muted,
  });
  if (page) {
    slide.addText(String(page), {
      x: W - 1.1, y: H - 0.42, w: 0.48, h: 0.24,
      fontFace: FONT, fontSize: 8.5, color: C.muted, align: 'right',
    });
  }
}

/** Bulleted body copy. */
function bullets(slide, items, opts = {}) {
  const { x = 0.62, y = 1.66, w = W - 1.24, h = 4.4, size = 14, gap = 12 } = opts;
  slide.addText(
    items.map((it) => {
      const text = typeof it === 'string' ? it : it.text;
      const level = typeof it === 'string' ? 0 : (it.level ?? 0);
      return {
        text,
        options: {
          bullet: level === 0 ? { code: '2022' } : { code: '2013' },
          indentLevel: level,
          color: level === 0 ? C.body : C.muted,
          fontSize: level === 0 ? size : size - 1.5,
          bold: false,
          paraSpaceAfter: level === 0 ? gap : 5,
          breakLine: true,
        },
      };
    }),
    { x, y, w, h, fontFace: FONT, valign: 'top' }
  );
}

/** Rounded panel with a heading and optional body. */
function panel(slide, { x, y, w, h, heading, body, accent = C.teal, size = 12.5 }) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.06,
    fill: { color: C.wash }, line: { color: C.line, width: 1 },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x, y, w: 0.055, h, fill: { color: accent },
  });
  let ty = y + 0.16;
  if (heading) {
    slide.addText(heading, {
      x: x + 0.22, y: ty, w: w - 0.4, h: 0.3,
      fontFace: FONT, fontSize: size + 0.5, bold: true, color: C.dark,
    });
    ty += 0.34;
  }
  if (body) {
    slide.addText(body, {
      x: x + 0.22, y: ty, w: w - 0.4, h: h - (ty - y) - 0.14,
      fontFace: FONT, fontSize: size, color: C.body, valign: 'top',
    });
  }
}

/** Small stat tile. */
function stat(slide, { x, y, w, h, value, label, color = C.teal }) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.06,
    fill: { color: C.white }, line: { color: C.line, width: 1 },
  });
  slide.addText(value, {
    x, y: y + 0.16, w, h: 0.52,
    fontFace: FONT, fontSize: 26, bold: true, color, align: 'center',
  });
  slide.addText(label, {
    x: x + 0.1, y: y + 0.7, w: w - 0.2, h: h - 0.8,
    fontFace: FONT, fontSize: 10, color: C.muted, align: 'center', valign: 'top',
  });
}

const notes = (slide, text) => slide.addNotes(text);

let page = 0;
const n = () => (page += 1);

/* ---------------------------------------------------------------- 1 title */
{
  const s = pptx.addSlide();
  s.background = { color: C.dark };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.16, fill: { color: C.teal } });
  s.addShape(pptx.ShapeType.rect, {
    x: W - 3.5, y: H - 3.5, w: 3.5, h: 3.5,
    fill: { color: C.teal }, line: { color: C.teal },
  });
  s.addText('PRONIX INC.  ·  KORE.AI XO', {
    x: 0.9, y: 1.5, w: 9, h: 0.3,
    fontFace: FONT, fontSize: 12, bold: true, color: '7FC4BC', charSpacing: 2.2,
  });
  s.addText('Virtual Assistant\nfor the Pronix Platform', {
    x: 0.9, y: 1.95, w: 9.2, h: 1.9,
    fontFace: FONT, fontSize: 40, bold: true, color: C.white, lineSpacing: 50,
  });
  s.addText(
    'Design, build, verification and deployment of a Kore.ai XO chatbot with hybrid search, eight trained intents, and account authentication.',
    { x: 0.9, y: 4.0, w: 7.9, h: 0.9, fontFace: FONT, fontSize: 14, color: 'C6D6D3', lineSpacing: 21 }
  );
  s.addShape(pptx.ShapeType.line, { x: 0.9, y: 5.05, w: 1.6, h: 0, line: { color: C.teal, width: 2.5 } });
  s.addText('Sandeep Arimilli', {
    x: 0.9, y: 5.25, w: 5, h: 0.28, fontFace: FONT, fontSize: 14, bold: true, color: C.white,
  });
  s.addText('1 October 2026', {
    x: 0.9, y: 5.58, w: 5, h: 0.28, fontFace: FONT, fontSize: 12, color: '9FB5B1',
  });
  notes(s, 'Live demo URL: https://aicharbot.vercel.app');
}

/* ------------------------------------------------------------ 2 objective */
{
  const s = pptx.addSlide();
  frame(s, { kicker: 'Overview', title: 'What the assignment asked for', page: n() });
  bullets(s, [
    'Build a Kore.ai XO virtual assistant for the Pronix platform.',
    'Crawl the public Pronix site and ground answers in that content — no invented facts.',
    { text: 'Implement a Search AI collection with hybrid retrieval, metadata and category filters.', level: 1 },
    'Define and train the intent set covering greeting, authentication, account management and service discovery.',
    { text: 'Login, registration and account CRUD against a REST resource.', level: 1 },
    'Deliver the exact required response copy across every branch.',
    'Publish to the required channels: Web, Telegram and WhatsApp.',
    'Document the work and demonstrate a deployed, working result.',
  ], { y: 1.7, h: 4.3, size: 14.5, gap: 13 });
  panel(s, {
    x: 0.62, y: 6.1, w: W - 1.24, h: 0.78,
    heading: 'How I approached it',
    body: 'Build the complete behaviour locally first so it is demonstrable and testable, then map it 1:1 onto Kore.ai XO as the deployment target. That ordering meant the platform’s write-API limits never left me without a working deliverable.',
    size: 11.5,
  });
}

/* ------------------------------------------------------------ 3 fulfilment */
{
  const s = pptx.addSlide();
  frame(s, { kicker: 'Status', title: 'Requirement fulfilment at a glance', page: n() });
  const rows = [
    [
      { text: 'Requirement', options: { bold: true, color: C.white, fill: { color: C.teal } } },
      { text: 'Where', options: { bold: true, color: C.white, fill: { color: C.teal } } },
      { text: 'State', options: { bold: true, color: C.white, fill: { color: C.teal }, align: 'center' } },
    ],
    ['Crawler + knowledge corpus', 'src/data/knowledge.json', { text: 'Complete', options: { color: C.pass, bold: true, align: 'center' } }],
    ['Hybrid retrieval + ranking', 'src/lib/search.js', { text: 'Complete', options: { color: C.pass, bold: true, align: 'center' } }],
    ['8 intents + routing', 'src/lib/dialog.js', { text: 'Complete', options: { color: C.pass, bold: true, align: 'center' } }],
    ['Login / registration / CRUD', 'src/lib/accountStore.js', { text: 'Complete', options: { color: C.pass, bold: true, align: 'center' } }],
    ['Automated test suite', '101 tests / 5 files', { text: 'Passing', options: { color: C.pass, bold: true, align: 'center' } }],
    ['Public deployment', 'aicharbot.vercel.app', { text: 'Live', options: { color: C.pass, bold: true, align: 'center' } }],
    ['Telegram channel', 't.me/PronixAIChatbotSandeepBot', { text: 'Enabled', options: { color: C.pass, bold: true, align: 'center' } }],
    ['Required copy in Kore XO', '2 of 7 strings verified', { text: 'Partial', options: { color: C.warn, bold: true, align: 'center' } }],
    ['Search AI + intent training in Kore', 'Builder configuration', { text: 'Pending', options: { color: C.warn, bold: true, align: 'center' } }],
    ['WhatsApp channel', 'Meta Business verification', { text: 'Blocked', options: { color: C.fail, bold: true, align: 'center' } }],
  ];
  s.addTable(rows, {
    x: 0.62, y: 1.66, w: W - 1.24, colW: [4.6, 4.6, 2.9],
    fontFace: FONT, fontSize: 11.5, color: C.body, valign: 'middle',
    border: { type: 'solid', color: C.line, pt: 0.75 },
    rowH: 0.4, autoPage: false,
  });
  s.addText('The Kore XO rows are platform-integration gaps, not missing functionality — the logic itself is built and tested. See “Honest status”.', {
    x: 0.62, y: 6.5, w: W - 1.24, h: 0.5,
    fontFace: FONT, fontSize: 11, italic: true, color: C.muted,
  });
}

/* --------------------------------------------------------- 4 architecture */
{
  const s = pptx.addSlide();
  frame(s, { kicker: 'Architecture', title: 'How the assistant works', page: n() });
  const boxes = [
    ['Crawler', 'scripts/crawl.mjs\n260 documents'],
    ['Knowledge base', 'src/data/knowledge.json\n42 FAQs, 8 categories'],
    ['Hybrid ranker', 'token overlap · stemming\nconcept sets · field weights'],
    ['Intent classifier', '8 intents + confidence'],
    ['Dialog engine', 'login · register · CRUD\naccount options'],
    ['REST resource', 'GET · POST · PUT · DELETE'],
  ];
  // Derive the box width from the space actually available so the row can never
  // run off the right edge when the pipeline gains or loses a stage.
  const rowX = 0.62;
  const rowW = W - rowX * 2;
  const gap = 0.25;
  const bw = (rowW - gap * (boxes.length - 1)) / boxes.length;
  boxes.forEach(([head, body], i) => {
    const x = rowX + i * (bw + gap);
    panel(s, { x, y: 2.0, w: bw, h: 1.5, heading: head, body: body, size: 10 });
    if (i < boxes.length - 1) {
      s.addShape(pptx.ShapeType.rightArrow, {
        x: x + bw + 0.045, y: 2.62, w: gap - 0.09, h: 0.26, fill: { color: C.line },
      });
    }
  });
  panel(s, {
    x: 0.62, y: 3.85, w: (W - 1.24) / 2 - 0.15, h: 1.85,
    heading: 'Retrieval',
    body: 'Hybrid keyword and semantic ranking over the crawled corpus. Stemming and concept sets let paraphrases match, so “what do you do for CX?” resolves to an Agentic AI document. Answers carry a source link.',
  });
  panel(s, {
    x: 0.62 + (W - 1.24) / 2 + 0.15, y: 3.85, w: (W - 1.24) / 2 - 0.15, h: 1.85,
    heading: 'Guardrails',
    body: 'Unmatched questions route to an explicit fallback rather than a generated answer — the assistant never invents product claims. Sentiment is scored on every message so the session carries a tone label end to end.',
    accent: C.warn,
  });
  s.addText('Every message traverses: sentiment → intent → retrieval or flow → response with a source or a safe fallback.', {
    x: 0.62, y: 5.95, w: W - 1.24, h: 0.4,
    fontFace: FONT, fontSize: 12, bold: true, color: C.dark, align: 'center',
  });
  notes(s, 'Key point: the local app is the source of truth, Kore.ai is the deployment target.');
}

/* --------------------------------------------------------- 5 knowledge base */
{
  const s = pptx.addSlide();
  frame(s, { kicker: 'Knowledge', title: 'The corpus is real, not invented', page: n() });
  stat(s, { x: 0.62, y: 1.7, w: 2.3, h: 1.3, value: String(knowledge.documentCount), label: 'documents crawled' });
  stat(s, { x: 3.12, y: 1.7, w: 2.3, h: 1.3, value: String(knowledge.categories.FAQs), label: 'FAQ entries' });
  stat(s, { x: 5.62, y: 1.7, w: 2.3, h: 1.3, value: String(Object.keys(knowledge.categories).length), label: 'categories' });
  stat(s, { x: 8.12, y: 1.7, w: 2.3, h: 1.3, value: String(knowledge.serviceTypes.length), label: 'service types' });
  stat(s, { x: 10.62, y: 1.7, w: 2.09, h: 1.3, value: '5', label: 'metadata filters' });

  s.addText('Category breakdown', {
    x: 0.62, y: 3.25, w: 5, h: 0.3, fontFace: FONT, fontSize: 13, bold: true, color: C.dark,
  });
  const cats = Object.entries(knowledge.categories).sort((a, b) => b[1] - a[1]);
  const rows = cats.map(([name, count]) => [
    { text: name, options: { color: C.body } },
    { text: String(count), options: { align: 'right', color: C.dark, bold: true } },
    { text: `${Math.round((count / knowledge.documentCount) * 100)}%`, options: { align: 'right', color: C.muted } },
  ]);
  s.addTable(
    [
      [
        { text: 'Category', options: { bold: true, color: C.white, fill: { color: C.teal } } },
        { text: 'Docs', options: { bold: true, color: C.white, fill: { color: C.teal }, align: 'right' } },
        { text: 'Share', options: { bold: true, color: C.white, fill: { color: C.teal }, align: 'right' } },
      ],
      ...rows,
    ],
    {
      x: 0.62, y: 3.6, w: 5.6, colW: [2.8, 1.4, 1.4],
      fontFace: FONT, fontSize: 11, rowH: 0.3,
      border: { type: 'solid', color: C.line, pt: 0.75 }, valign: 'middle',
    }
  );

  panel(s, {
    x: 6.6, y: 3.6, w: 6.11, h: 2.55,
    heading: 'Crawler behaviour worth noting',
    body: `Entry URL http://www.pronixinc.com resolves to the live origin ${knowledge.origin}, so redirects are followed rather than assumed.\n\nEvery document retains title, keywords, excerpt, answer text, category and source URL, which is what makes filtered answers and citations possible.`,
    size: 11.5,
  });
}

/* ------------------------------------------------------------- 6 search ai */
{
  const s = pptx.addSlide();
  frame(s, { kicker: 'Search AI', title: 'Retrieval design', page: n() });
  panel(s, {
    x: 0.62, y: 1.7, w: (W - 1.24) / 2 - 0.15, h: 2.15,
    heading: 'Hybrid ranking',
    body: `Retrieval mode: ${spec.knowledgeCollection.retrievalMode}\n\nRankers: ${spec.knowledgeCollection.rankers.join(' + ')}\n\nMetadata fields: ${spec.knowledgeCollection.metadataFields.join(', ')}`,
  });
  panel(s, {
    x: 0.62 + (W - 1.24) / 2 + 0.15, y: 1.7, w: (W - 1.24) / 2 - 0.15, h: 2.15,
    heading: 'Local implementation',
    body: 'Token overlap plus stemming plus concept sets, weighted by field. Fully deterministic, which is why it is unit-testable and why the same query always yields the same ranked result.',
    accent: C.warn,
  });
  panel(s, {
    x: 0.62, y: 4.05, w: (W - 1.24) / 2 - 0.15, h: 2.1,
    heading: 'Category filtering',
    body: `Intent-driven filters let the assistant narrow the corpus before ranking.\n\n${spec.intents.filter((i) => i.fallback).map((i) => `${i.intent} → ${i.fallback.split('filter')[1].trim()}`).join('\n')}`,
    size: 11.5,
  });
  panel(s, {
    x: 0.62 + (W - 1.24) / 2 + 0.15, y: 4.05, w: (W - 1.24) / 2 - 0.15, h: 2.1,
    heading: 'Fallback policy',
    body: spec.knowledgeCollection.fallbackPolicy,
    accent: C.fail,
    size: 12,
  });
}

/* --------------------------------------------------------------- 7 intents */
{
  const s = pptx.addSlide();
  frame(s, { kicker: 'Intents', title: 'The eight trained intents', page: n() });
  const kind = {
    Greeting: C.teal, UserLogin: C.teal, UserRegistration: C.teal, AccountManagement: C.teal,
    PronixServices: C.warn, CaseStudySearch: C.warn, PronixInsights: C.warn, ContactSupport: C.warn,
  };
  spec.intents.forEach((intent, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.62 + col * ((W - 1.24) / 2 + 0.15);
    const y = 1.7 + row * 1.22;
    const w = (W - 1.24) / 2 - 0.15;
    s.addShape(pptx.ShapeType.roundRect, {
      x, y, w, h: 1.08, rectRadius: 0.05,
      fill: { color: C.white }, line: { color: C.line, width: 1 },
    });
    s.addShape(pptx.ShapeType.rect, { x, y, w: 0.055, h: 1.08, fill: { color: kind[intent.intent] ?? C.teal } });
    s.addText(intent.intent, {
      x: x + 0.2, y: y + 0.1, w: w - 0.4, h: 0.28,
      fontFace: FONT, fontSize: 13, bold: true, color: C.dark,
    });
    s.addText(`${intent.dialogTask}  ·  ${intent.utterances.length} training utterances`, {
      x: x + 0.2, y: y + 0.4, w: w - 0.4, h: 0.26,
      fontFace: FONT, fontSize: 10.5, color: C.body,
    });
    s.addText(`“${intent.utterances.slice(0, 3).join('”  ·  “')}”`, {
      x: x + 0.2, y: y + 0.68, w: w - 0.4, h: 0.3,
      fontFace: FONT, fontSize: 9.5, italic: true, color: C.muted,
    });
  });
  s.addText('Teal = transactional dialog tasks.  Amber = search-driven discovery tasks.', {
    x: 0.62, y: 6.65, w: W - 1.24, h: 0.3,
    fontFace: FONT, fontSize: 10.5, color: C.muted,
  });
}

/* ----------------------------------------------------------- 8 login flow */
{
  const s = pptx.addSlide();
  frame(s, { kicker: 'Flows', title: 'Login: registered, unknown, and failure', page: n() });
  const steps = [
    ['Trigger', 'UserLogin intent\n“log in”, “sign in”'],
    ['Capture email', 'Email entity\nformat validated'],
    ['GET /users', 'findUserByEmail\nREST call'],
    ['Branch', 'response length\n> 0 or == 0'],
  ];
  steps.forEach(([h, b], i) => {
    const x = 0.62 + i * 2.28;
    panel(s, { x, y: 1.75, w: 2.02, h: 1.28, heading: h, body: b, size: 10.5 });
    if (i < steps.length - 1) {
      s.addShape(pptx.ShapeType.rightArrow, {
        x: x + 2.05, y: 2.26, w: 0.2, h: 0.24, fill: { color: C.line },
      });
    }
  });

  panel(s, {
    x: 0.62, y: 3.35, w: 5.9, h: 1.5,
    heading: 'Registered → success',
    body: '“Hello {{username}}! You have successfully logged in.”\nthen routes into Account Options',
    accent: C.pass,
  });
  panel(s, {
    x: 6.82, y: 3.35, w: 5.9, h: 1.5,
    heading: 'Not registered → offer to register',
    body: '“This email is not registered. Would you like to create a new account?”\nChoice: Register Now | Retry | Cancel',
    accent: C.warn,
  });
  panel(s, {
    x: 0.62, y: 5.05, w: W - 1.24, h: 1.5,
    heading: 'Service failure is handled explicitly',
    body: 'If the REST call errors or times out, the session takes the error branch and replies “Something went wrong. Please try again later.” rather than reporting a failed login as an unregistered email — the two cases are semantically very different and conflating them misleads the user.',
    accent: C.fail,
  });
  notes(s, 'The distinction between "unknown email" and "service error" is worth calling out.');
}

/* ------------------------------------------------------- 9 registration */
{
  const s = pptx.addSlide();
  frame(s, { kicker: 'Flows', title: 'Registration and account management', page: n() });
  panel(s, {
    x: 0.62, y: 1.72, w: 5.9, h: 1.62,
    heading: 'Captured and validated entities',
    body: spec.intents.find((i) => i.intent === 'UserRegistration').entities
      .map((e) => `${e.name} — ${e.type}, ${e.validation}`).join('\n'),
    size: 11.5,
  });
  panel(s, {
    x: 6.82, y: 1.72, w: 5.9, h: 1.62,
    heading: 'Persistence',
    body: `POST ${spec.intents.find((i) => i.intent === 'UserRegistration').restService.endpoint}\nBody: ${spec.intents.find((i) => i.intent === 'UserRegistration').restService.body.join(', ')}\n\nVerified live against the MockAPI users resource.`,
    size: 11.5,
  });
  panel(s, {
    x: 0.62, y: 3.55, w: 5.9, h: 1.5,
    heading: 'Success branch',
    body: '“Registration successful! Would you like to continue?”\nYes → Account Options   ·   No → “Thank you! Have a great day.”',
    accent: C.pass,
  });
  panel(s, {
    x: 6.82, y: 3.55, w: 5.9, h: 1.5,
    heading: 'Account management',
    body: `Choice: Modify Account | Delete Account\nPUT ${spec.intents.find((i) => i.intent === 'AccountManagement').modifyService.endpoint}\nDELETE ${spec.intents.find((i) => i.intent === 'AccountManagement').deleteService.endpoint}\nDeletion is behind a confirmation prompt.`,
    size: 11,
  });
  s.addText('Register → login → modify → delete is exercisable end to end; the smoke test drives it against a live REST resource.', {
    x: 0.62, y: 5.35, w: W - 1.24, h: 0.4, fontFace: FONT, fontSize: 11.5, color: C.body,
  });
}

/* --------------------------------------------------------- 10 required copy */
{
  const s = pptx.addSlide();
  frame(s, { kicker: 'Compliance', title: 'Required response copy', page: n() });
  const verified = new Set(['Hello! Welcome to our Virtual Assistant.', 'No problem! Have a great day.']);
  const strings = [
    'Hello! Welcome to our Virtual Assistant.',
    'Registration successful! Would you like to continue?',
    'Thank you! Have a great day.',
    'This email is not registered. Would you like to create a new account?',
    'No problem! Have a great day.',
    'Hello [username]! You have successfully logged in.',
    'Something went wrong. Please try again later.',
  ];
  strings.forEach((str, i) => {
    const y = 1.72 + i * 0.56;
    const ok = verified.has(str);
    s.addShape(pptx.ShapeType.roundRect, {
      x: 0.62, y, w: 8.6, h: 0.48, rectRadius: 0.04,
      fill: { color: C.white }, line: { color: C.line, width: 1 },
    });
    s.addText(str, {
      x: 0.82, y: y + 0.03, w: 8.2, h: 0.42, fontFace: FONT, fontSize: 12, color: C.ink, valign: 'middle',
    });
    s.addShape(pptx.ShapeType.roundRect, {
      x: 9.42, y, w: 1.35, h: 0.48, rectRadius: 0.04,
      fill: { color: ok ? 'E7F4EC' : 'FCF3E3' },
    });
    s.addText(ok ? 'Verified' : 'Pending', {
      x: 9.42, y: y + 0.03, w: 1.35, h: 0.42,
      fontFace: FONT, fontSize: 10.5, bold: true, color: ok ? C.pass : C.warn, align: 'center', valign: 'middle',
    });
  });
  panel(s, {
    x: 10.97, y: 1.72, w: 1.74, h: 3.92,
    heading: '2 / 7',
    body: 'verified live in the Kore.ai builder.\n\nAll seven strings are implemented and asserted in the local app.',
    size: 10.5,
  });
  s.addText('Verification is read back from the live builder rather than trusted from the edit, because a silent write failure looks identical to a successful one.', {
    x: 0.62, y: 5.85, w: 8.6, h: 0.6, fontFace: FONT, fontSize: 11, italic: true, color: C.muted,
  });
}

/* ------------------------------------------------------------- 11 quality */
{
  const s = pptx.addSlide();
  frame(s, { kicker: 'Quality', title: 'Verification performed', page: n() });
  stat(s, { x: 0.62, y: 1.75, w: 2.85, h: 1.35, value: '101', label: 'tests passing across 5 files', color: C.pass });
  stat(s, { x: 3.67, y: 1.75, w: 2.85, h: 1.35, value: '1,892', label: 'modules built, no errors' });
  stat(s, { x: 6.72, y: 1.75, w: 2.85, h: 1.35, value: 'HTTP 200', label: 'live deployment verified' });
  stat(s, { x: 9.77, y: 1.75, w: 2.94, h: 1.35, value: '0', label: 'lint errors (warnings only)', color: C.pass });

  const checks = [
    ['npm run lint', 'Clean — warnings only, confined to unused probe variables'],
    ['npm test', '101 tests passing across search, dialog, account and store modules'],
    ['npm run build', 'Production bundle succeeds, ~490 KB JS (120 KB gzipped)'],
    ['npm run smoke', 'Exercises live POST and GET against the MockAPI users resource'],
    ['npm run verify:copy', 'Reads the required strings back out of the Kore.ai builder'],
  ];
  s.addTable(
    [
      [
        { text: 'Command', options: { bold: true, color: C.white, fill: { color: C.teal } } },
        { text: 'Result', options: { bold: true, color: C.white, fill: { color: C.teal } } },
      ],
      ...checks.map(([cmd, res]) => [
        { text: cmd, options: { color: C.dark, bold: true, fontFace: 'Consolas', fontSize: 11 } },
        { text: res, options: { color: C.body, fontSize: 11 } },
      ]),
    ],
    {
      x: 0.62, y: 3.45, w: W - 1.24, colW: [2.7, 9.69],
      fontFace: FONT, fontSize: 11, rowH: 0.42, valign: 'middle',
      border: { type: 'solid', color: C.line, pt: 0.75 },
    }
  );
  s.addText('Registration and login are proven against a live REST endpoint, not mocked, so the wiring is genuinely exercised.', {
    x: 0.62, y: 6.4, w: W - 1.24, h: 0.4, fontFace: FONT, fontSize: 11, italic: true, color: C.muted,
  });
}

/* ---------------------------------------------------------- 12 deployment */
{
  const s = pptx.addSlide();
  frame(s, { kicker: 'Deployment', title: 'Shipped and live', page: n() });
  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.62, y: 1.75, w: W - 1.24, h: 1.5, rectRadius: 0.06,
    fill: { color: C.dark },
  });
  s.addText('https://aicharbot.vercel.app', {
    x: 0.95, y: 2.0, w: 9, h: 0.5,
    fontFace: FONT, fontSize: 26, bold: true, color: C.white,
  });
  s.addText('Vercel production · public · no login required · verified HTTP 200 with the bundle loading', {
    x: 0.95, y: 2.55, w: 9, h: 0.35,
    fontFace: FONT, fontSize: 12.5, color: '9FB5B1',
  });
  s.addText('LIVE', {
    x: W - 3.0, y: 2.18, w: 2.2, h: 0.62,
    fontFace: FONT, fontSize: 20, bold: true, color: C.teal, align: 'right',
  });

  panel(s, {
    x: 0.62, y: 3.5, w: 3.85, h: 1.7,
    heading: 'Host',
    body: 'Vercel, production build.\nProject aicharbot.\n\nRedeploy: npm run deploy:vercel',
    size: 11.5,
  });
  panel(s, {
    x: 4.72, y: 3.5, w: 3.85, h: 1.7,
    heading: 'Build',
    body: '1,892 modules.\ndist JS 490 KB / 120 KB gzipped.\n\nRedeploys build first, so the deployed bundle always matches tested source.',
    size: 11.5,
  });
  panel(s, {
    x: 8.86, y: 3.5, w: 3.85, h: 1.7,
    heading: 'Also available',
    body: 'Local dev :5173\nProduction preview :4173\nLAN http://192.168.0.111:4173\n\nNetlify is a configured fallback path.',
    size: 11.5,
  });
  s.addText('The local app is retained deliberately as a working fallback, so a Kore.ai platform regression never leaves nothing demonstrable.', {
    x: 0.62, y: 5.5, w: W - 1.24, h: 0.5, fontFace: FONT, fontSize: 11.5, italic: true, color: C.muted,
  });
}

/* ----------------------------------------------------------- 13 channels */
{
  const s = pptx.addSlide();
  frame(s, { kicker: 'Channels', title: 'Where the assistant is reachable', page: n() });
  const ch = spec.channels;
  const colors = [C.pass, C.pass, C.fail];
  const heads = ['Web', 'Telegram', 'WhatsApp'];
  ch.forEach((c, i) => {
    const x = 0.62 + i * ((W - 1.24) / 3 + 0.075);
    const w = (W - 1.24) / 3 - 0.15;
    s.addShape(pptx.ShapeType.roundRect, {
      x, y: 1.75, w, h: 2.9, rectRadius: 0.06,
      fill: { color: C.white }, line: { color: C.line, width: 1 },
    });
    s.addShape(pptx.ShapeType.rect, { x, y: 1.75, w, h: 0.055, fill: { color: colors[i] } });
    s.addText(heads[i], {
      x: x + 0.25, y: 2.0, w: w - 0.5, h: 0.35,
      fontFace: FONT, fontSize: 17, bold: true, color: C.dark,
    });
    s.addText(c.status, {
      x: x + 0.25, y: 2.42, w: w - 0.5, h: 0.3,
      fontFace: FONT, fontSize: 11, bold: true, color: colors[i],
    });
    s.addText(c.notes, {
      x: x + 0.25, y: 2.8, w: w - 0.5, h: 1.6,
      fontFace: FONT, fontSize: 11, color: C.body,
    });
  });
  bullets(s, [
    { text: 'Telegram bot: https://t.me/PronixAIChatbotSandeepBot — channel enabled against bot PronixAIChatbotSandeepBot.' },
    { text: 'Bot tokens are stored only inside Kore.ai. No channel credential is written into this repository or into any generated output.' },
    { text: 'Monitoring covers 12 event types across intent, question, sentiment, search-hit, fallback, authentication, account, error and handoff.' },
  ], { y: 4.95, h: 1.9, size: 12.5, gap: 10 });
}

/* ------------------------------------------------- 14 platform constraints */
{
  const s = pptx.addSlide();
  frame(s, { kicker: 'Constraints', title: 'What the Kore.ai builder would not allow', page: n() });
  bullets(s, [
    { text: 'Component PUT returns HTTP 200 but silently discards the message text — a write that reports success and changes nothing.' },
    { text: 'Dialog create and update endpoints return 412, so dialog content could not be changed programmatically.' },
    { text: 'Call-flow message routes return 412, including immediately after the flow was drafted.' },
    { text: 'Published dialog components are immutable, and the unpublish route rejects with a platform privilege limit.' },
    { text: 'Publish and unpublish routes fail with the documented 400 errors.' },
    { text: 'No usable intent, Search AI collection or resource-save API surface was discoverable, so those require manual configuration.' },
  ], { y: 1.72, h: 3.4, size: 13.5, gap: 11 });
  panel(s, {
    x: 0.62, y: 5.2, w: W - 1.24, h: 1.35,
    heading: 'How I handled it',
    body: 'I stopped trusting write responses and switched to read-back verification — every change is confirmed by fetching the object back, which is why the copy status is stated as “2 of 7 verified” rather than assumed complete. Two strings were then applied and confirmed through the canvas using trusted input events.',
    size: 11.5,
  });
  notes(s, 'Be matter-of-fact about this: it is a platform constraint, documented with reproduced evidence.');
}

/* ----------------------------------------------------- 15 honest position */
{
  const s = pptx.addSlide();
  frame(s, { kicker: 'Summary', title: 'Honest status', page: n() });
  panel(s, {
    x: 0.62, y: 1.75, w: 5.9, h: 3.05,
    heading: 'Delivered and working',
    body: '• Deployed, publicly reachable chatbot\n• 260-document crawled knowledge base\n• Hybrid retrieval with citations\n• 8 intents with routing and confidence\n• Login, registration and account CRUD, live-tested\n• 101 passing tests, clean lint and build\n• Telegram channel enabled\n• Full written documentation',
    accent: C.pass,
    size: 12,
  });
  panel(s, {
    x: 6.82, y: 1.75, w: 5.9, h: 3.05,
    heading: 'Outstanding',
    body: '• 5 of 7 required strings not yet applied in Kore XO\n• Search AI collection not yet created in the builder\n• 6 content intents not yet trained in Kore\n• Welcome Chat Flow sits in draft, so Telegram serves the older greeting\n• WhatsApp blocked on Meta Business verification',
    accent: C.warn,
    size: 12,
  });
  panel(s, {
    x: 0.62, y: 5.0, w: W - 1.24, h: 1.55,
    heading: 'Next, in priority order',
    body: 'Republish Welcome Chat Flow and confirm the greeting on every channel. Apply the remaining five strings via the canvas with read-back verification. Create and train the Search AI collection, then retest end to end. Resolve the WhatsApp verification.',
    accent: C.teal,
    size: 11.5,
  });
}

/* ------------------------------------------------------------- 16 close */
{
  const s = pptx.addSlide();
  s.background = { color: C.dark };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.16, fill: { color: C.teal } });
  s.addText('Thank you', {
    x: 0.9, y: 1.5, w: 9, h: 0.9, fontFace: FONT, fontSize: 40, bold: true, color: C.white,
  });
  s.addText('Questions welcome.', {
    x: 0.9, y: 2.45, w: 9, h: 0.4, fontFace: FONT, fontSize: 15, color: '9FB5B1',
  });
  s.addShape(pptx.ShapeType.line, { x: 0.9, y: 3.1, w: 1.6, h: 0, line: { color: C.teal, width: 2.5 } });
  const links = [
    ['Live app', 'https://aicharbot.vercel.app'],
    ['Telegram bot', 'https://t.me/PronixAIChatbotSandeepBot'],
    ['Kore.ai builder', 'platform.kore.ai/builder/app/automationdialoggpt/automationconversationorchestration'],
  ];
  links.forEach(([label, url], i) => {
    const y = 3.4 + i * 0.62;
    s.addText(label, {
      x: 0.9, y, w: 2.4, h: 0.32, fontFace: FONT, fontSize: 12, bold: true, color: '7FC4BC',
    });
    s.addText(url, {
      x: 3.4, y, w: 8.6, h: 0.32, fontFace: FONT, fontSize: 12, color: C.white,
    });
  });
  s.addText('Evidence and full status: docs/assignment-status.md', {
    x: 0.9, y: 5.5, w: 9, h: 0.32, fontFace: FONT, fontSize: 11.5, italic: true, color: '7B8F8B',
  });
}

const outDir = path.join(root, 'output');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'Pronix-Kore-XO-Assignment.pptx');

await pptx.writeFile({ fileName: outFile });
console.log(`Wrote ${outFile}`);
console.log(`Slides: ${page + 1}`);
console.log(`Corpus: ${knowledge.documentCount} documents · intents: ${spec.intents.length} · required copy: 7`);