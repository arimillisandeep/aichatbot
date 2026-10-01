/**
 * Enters the signed-in Kore.ai XO app and then navigates within it, reporting the
 * rendered screen after each step.
 *
 * The app must be entered by clicking its card on the builder home; navigating
 * directly to a builder URL redirects back to home.
 *
 * Usage:
 *   node scripts/kore-app.mjs                       list dialog tasks
 *   node scripts/kore-app.mjs Dialogs                open the Dialogs screen
 *   node scripts/kore-app.mjs Dialogs "User Login"   open a dialog by name
 */
import puppeteer from 'puppeteer-core';

import { CDP_URL } from './kore-login.mjs';

const APP_NAME = process.env.KORE_APP || 'Conversation_AI_ChatBot_Pronix';
const HOME = 'https://platform.kore.ai/builder/home';

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

const browser = await puppeteer.connect({ browserURL: CDP_URL, defaultViewport: null });

try {
  const pages = await browser.pages();
  const page = pages.find((candidate) => candidate.url().includes('platform.kore.ai'));
  if (!page) throw new Error('No Kore.ai tab found');
  await page.setViewport({ width: 1680, height: 1050 });

  // Click a leaf element whose text matches exactly, preferring a real link.
  const clickExact = (text) => page.evaluate((label) => {
    const target = label.trim().toLowerCase();
    const matches = [...document.querySelectorAll('*')].filter(
      (node) => node.children.length === 0 && (node.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase() === target,
    );
    const node = matches[0];
    if (!node) return false;
    (node.closest('a') || node).click();
    return true;
  }, text);

  async function enterApp() {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await page.goto(HOME, { waitUntil: 'networkidle2', timeout: 60000 });
      await wait(4000);
      if (await clickExact(APP_NAME)) {
        await wait(7000);
        if (page.url().includes('/builder/app/')) return true;
      }
    }
    return false;
  }

  if (!(await enterApp())) {
    console.log('Could not enter app ' + APP_NAME + ' (url: ' + page.url() + ')');
    process.exit(1);
  }
  console.log('entered app: ' + page.url());

  const steps = process.argv.slice(2);
  for (const step of steps) {
    const clicked = await clickExact(step);
    await wait(clicked ? 5000 : 1000);
    console.log((clicked ? 'clicked ' : 'NOT FOUND ') + '"' + step + '"  ->  ' + page.url());
  }

  const text = await page.evaluate(() => document.body.innerText.replace(/\n{2,}/g, '\n'));
  console.log('\n===== Screen =====');
  console.log(text.slice(0, Number(process.env.KORE_DUMP || 5000)));
} finally {
  browser.disconnect();
}