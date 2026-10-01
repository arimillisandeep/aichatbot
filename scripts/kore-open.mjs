/**
 * Clicks a label inside the signed-in Kore.ai XO app and dumps the resulting
 * screen, so dialog tasks, intents, Search AI, and channels can be inspected.
 *
 * Usage: node scripts/kore-open.mjs "<label>" ["<second label>"]
 */
import puppeteer from 'puppeteer-core';

import { CDP_URL } from './kore-login.mjs';

const labels = process.argv.slice(2).filter(Boolean);
if (!labels.length) {
  console.error('Pass one or more labels to click, e.g. node scripts/kore-open.mjs Dialogs');
  process.exit(1);
}

const APP_URL = 'https://platform.kore.ai/builder/app/automationdialoggpt/automationconversationorchestration';

const browser = await puppeteer.connect({ browserURL: CDP_URL, defaultViewport: null });

try {
  const pages = await browser.pages();
  const page = pages.find((candidate) => candidate.url().includes('platform.kore.ai'));
  if (!page) throw new Error('No Kore.ai tab found');

  await page.setViewport({ width: 1680, height: 1050 });

  if (!page.url().includes('platform.kore.ai')) {
    await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((done) => setTimeout(done, 3000));
  }

  for (const label of labels) {
    const clicked = await page.evaluate((text) => {
      const normalize = (value) => value.replace(/\s+/g, ' ').trim().toLowerCase();
      const target = normalize(text);
      const nodes = [...document.querySelectorAll('button, [role="tab"], [role="menuitem"], a, .ant-menu-item, li, div, span')];
      const match = nodes
        .filter((node) => normalize(node.innerText || node.textContent) === target)
        .filter((node) => node.offsetParent !== null)
        .sort((a, b) => (a.innerText || '').length - (b.innerText || '').length)[0];
      if (!match) return false;
      (match.closest('button') || match.closest('a') || match).click();
      return true;
    }, label);

    await new Promise((done) => setTimeout(done, clicked ? 4000 : 1200));
    console.log((clicked ? 'clicked ' : 'NOT FOUND ') + '"' + label + '"  ->  ' + page.url());
  }

  const text = await page.evaluate(() => document.body.innerText.replace(/\n{2,}/g, '\n'));
  console.log('\n===== Screen =====');
  console.log(text.slice(0, 4000));
} finally {
  browser.disconnect();
}