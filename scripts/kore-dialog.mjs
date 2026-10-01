/**
 * Opens the signed-in Kore.ai XO app, then a dialog task by name, and reports
 * the node graph read from the rendered DOM.
 *
 * Direct navigation to a builder URL redirects to the app home, so the app is
 * entered through the home screen first.
 *
 * Usage: node scripts/kore-dialog.mjs "User Login"
 */
import puppeteer from 'puppeteer-core';

import { CDP_URL } from './kore-login.mjs';

const TASK = process.argv[2] || 'User Login';
const APP_NAME = 'Conversation_AI_ChatBot_Pronix';
const HOME = 'https://platform.kore.ai/builder/home';
const TASKS = 'https://platform.kore.ai/builder/app/automationdialoggpt/automationdialogtasks';

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

const browser = await puppeteer.connect({ browserURL: CDP_URL, defaultViewport: null });

try {
  const pages = await browser.pages();
  const page = pages.find((candidate) => candidate.url().includes('platform.kore.ai'));
  if (!page) throw new Error('No Kore.ai tab found');
  await page.setViewport({ width: 1680, height: 1050 });

  async function clickExact(label) {
    return page.evaluate((text) => {
      const normalize = (value) => value.replace(/\s+/g, ' ').trim().toLowerCase();
      const target = normalize(text);
      const nodes = [...document.querySelectorAll('a, button, tr, td, li, [role="tab"], [role="menuitem"], div, span')]
        .filter((node) => normalize(node.innerText || node.textContent) === target)
        .filter((node) => node.offsetParent !== null);
      const match = nodes.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length)[0];
      if (!match) return false;
      (match.closest('a') || match.closest('button') || match.closest('tr') || match).click();
      return true;
    }, label);
  }

  await page.goto(HOME, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(3000);

  if (!(await clickExact(APP_NAME))) {
    console.log('Could not enter app ' + APP_NAME);
  } else {
    await wait(6000);
  }

  await page.goto(TASKS, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(4000);
  console.log('tasks url: ' + page.url());

  const opened = await clickExact(TASK);
  await wait(7000);
  console.log((opened ? 'opened ' : 'NOT FOUND ') + '"' + TASK + '"  ->  ' + page.url());

  const text = await page.evaluate(() => document.body.innerText.replace(/\n{2,}/g, '\n'));
  console.log('\n===== Dialog =====');
  console.log(text.slice(0, 5000));
} finally {
  browser.disconnect();
}