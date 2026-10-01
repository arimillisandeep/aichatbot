/**
 * Verify the seven required copy strings against the live Kore.ai app.
 *
 * Run after hand-editing the builder. Prints a pass/fail table and exits
 * non-zero while anything is still missing, so it can gate a publish.
 *
 * Usage: node scripts/kore-verify-copy.mjs
 */
import { installAuthObserver } from './kore-api.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const STREAM = process.env.KORE_STREAM || 'st-a26d2d94-7296-534b-ba83-b80aaf937136';
const USER = process.env.KORE_USER || 'u-7294aa15-9290-55a1-8b27-c45802448cde';
const FLOW = 'cf-7fe548da-c56b-59ed-b437-f00bf638d74f';
const GREETING = 'cfm-64266c64-7be8-5ff0-ad52-dc5122bb6856';

// The assignment's required strings, exactly as specified.
const REQUIRED = [
  'Hello! Welcome to our Virtual Assistant.',
  'Registration successful! Would you like to continue?',
  'Thank you! Have a great day.',
  'This email is not registered. Would you like to create a new account?',
  'No problem! Have a great day.',
  'Hello [username]! You have successfully logged in.',
  'Something went wrong. Please try again later.',
];

const decode = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

// Kore renders the username token in its own syntax, so a literal comparison
// would never match. Accept any non-empty substitution for the placeholder.
const normalise = (value) => value.replace(/\{\{[^}]*\}\}/g, '<var>').replace('[[username]]', '<var>');

const isMatch = (text, required) => {
  const actual = normalise(text.trim());
  const wanted = normalise(required.trim());
  return actual === wanted || actual.includes(wanted);
};

async function main() {
  const { default: puppeteer } = await import('puppeteer-core');
  const { CDP_URL } = await import('./kore-login.mjs');

  const browser = await puppeteer.connect({ browserURL: CDP_URL, defaultViewport: null });
  let report;

  try {
    const page = (await browser.pages()).find((candidate) => candidate.url().includes('platform.kore.ai'));
    if (!page) throw new Error('No Kore.ai tab found. Open and sign in to the builder first.');

    await installAuthObserver(page);
    await page.goto('https://platform.kore.ai/builder/home', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((done) => setTimeout(done, 5000));
    await page.evaluate(() => {
      const leaf = [...document.querySelectorAll('*')].find((node) => {
        if (node.children.length) return false;
        return (node.innerText || '').trim() === 'Conversation_AI_ChatBot_Pronix';
      });
      if (leaf) (leaf.closest('a') || leaf.closest('tr') || leaf.parentElement || leaf).click();
    });
    await new Promise((done) => setTimeout(done, 8000));

    const live = await page.evaluate(
      async (streamId, userId, flowId, greetingId) => {
        const bags = (window.__koreBags || []).map((entry) => entry.headers);
        const api = 'https://platform.kore.ai/api/1.1';

        const get = async (path) => {
          for (const headers of bags) {
            // eslint-disable-next-line no-await-in-loop
            const response = await fetch(api + path, { headers, credentials: 'include' });
            if (response.status === 401 || response.status === 403) continue;
            const raw = await response.text();
            try {
              return JSON.parse(raw);
            } catch {
              return raw;
            }
          }
          return null;
        };

        const components = (await get(`/builder/streams/${streamId}/components`)) || [];
        const messages = (await get(`/users/${userId}/streams/${streamId}/callflows/${flowId}/messages`)) || [];

        const texts = [];
        for (const component of Array.isArray(components) ? components : []) {
          for (const part of component.message || []) {
            if (part && typeof part.text === 'string') texts.push(part.text);
          }
        }
        for (const item of Array.isArray(messages) ? messages : []) {
          for (const part of (item || {}).messages || []) {
            for (const locale of part.locale || []) {
              if (typeof locale.message === 'string') texts.push(locale.message);
            }
          }
        }
        return texts;
      },
      STREAM,
      USER,
      FLOW,
      GREETING,
    );

    const haystack = live.map(decode);
    report = REQUIRED.map((required) => {
      const hit = haystack.find((text) => isMatch(text, required));
      return { required, present: !!hit, foundAs: hit || null };
    });
  } finally {
    browser.disconnect();
  }

  const passed = report.filter((row) => row.present).length;

  console.log('\nRequired copy in Kore.ai XO\n');
  for (const row of report) {
    console.log(`  ${row.present ? 'PASS' : 'FAIL'}  ${row.required}`);
    if (row.present && row.foundAs !== row.required) console.log(`        as: ${row.foundAs}`);
  }
  console.log(`\n  ${passed}/${report.length} present\n`);

  mkdirSync('output/kore', { recursive: true });
  writeFileSync('output/kore/verify-copy.json', JSON.stringify(report, null, 2));

  if (passed !== report.length) {
    console.log('Remaining strings must be typed into the builder. See the hand-edit');
    console.log('checklist in docs/assignment-status.md.\n');
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
