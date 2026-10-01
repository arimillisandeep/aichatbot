/**
 * Opens a Kore.ai XO app and reports its structure: intents, dialog tasks,
 * Search AI configuration, and channels, read from the rendered DOM.
 *
 * Usage: node scripts/kore-app-inspect.mjs [appName]
 */
import puppeteer from 'puppeteer-core';

import { CDP_URL } from './kore-login.mjs';

const APP_NAME = process.argv[2] || 'Conversation_AI_ChatBot_Pronix';
const WAIT = 3000;

const browser = await puppeteer.connect({ browserURL: CDP_URL, defaultViewport: null });

try {
  const pages = await browser.pages();
  const page = pages.find((candidate) => candidate.url().includes('platform.kore.ai'));
  if (!page) throw new Error('No Kore.ai tab found');

  await page.setViewport({ width: 1680, height: 1050 });
  await page.goto('https://platform.kore.ai/builder/home', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((done) => setTimeout(done, WAIT));

  const clicked = await page.evaluate((name) => {
    const candidates = [...document.querySelectorAll('*')].filter(
      (node) => node.children.length === 0 && node.textContent.trim() === name,
    );
    const target = candidates[0];
    if (!target) return false;
    (target.closest('a') || target).click();
    return true;
  }, APP_NAME);

  if (!clicked) {
    console.log('App "' + APP_NAME + '" not found on the home screen.');
  } else {
    await new Promise((done) => setTimeout(done, 6000));
  }

  console.log('URL: ' + page.url());
  const text = await page.evaluate(() => document.body.innerText.replace(/\n{2,}/g, '\n'));
  console.log('\n===== App screen =====');
  console.log(text.slice(0, 3000));

  const nav = await page.evaluate(() =>
    [...document.querySelectorAll('[role="tab"], [role="menuitem"], .ant-menu-item, nav a, button')]
      .map((node) => node.innerText && node.innerText.trim().replace(/\s+/g, ' '))
      .filter((value) => value && value.length < 40)
      .filter((value, index, all) => all.indexOf(value) === index)
      .slice(0, 80),
  );
  console.log('\n===== Interactive labels =====');
  nav.forEach((label) => console.log('  - ' + label));
} finally {
  browser.disconnect();
}