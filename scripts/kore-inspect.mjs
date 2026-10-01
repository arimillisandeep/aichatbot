/**
 * Navigates the signed-in Kore.ai XO session and reports what is available:
 * which bots exist, and which Bot/Others/Knowledge collection tooling is present.
 *
 * It reads the rendered DOM through CDP. It does not extract cookies or tokens.
 *
 * Usage: node scripts/kore-inspect.mjs
 */
import puppeteer from 'puppeteer-core';

import { CDP_URL } from './kore-login.mjs';

const browser = await puppeteer.connect({ browserURL: CDP_URL, defaultViewport: null });

try {
  const pages = await browser.pages();
  const page = pages.find((candidate) => candidate.url().includes('platform.kore.ai'));
  if (!page) throw new Error('No Kore.ai tab found');

  await page.setViewport({ width: 1600, height: 1000 });

  async function visit(path, label) {
    await page.goto('https://platform.kore.ai' + path, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((done) => setTimeout(done, 2500));
    const text = await page.evaluate(() => document.body.innerText.replace(/\n{2,}/g, '\n').slice(0, 2200));
    console.log('\n===== ' + label + ' (' + page.url() + ') =====');
    console.log(text);
  }

  await visit('/builder/home', 'Builder home');

  const links = await page.evaluate(() =>
    [...document.querySelectorAll('a')]
      .map((node) => ({ text: node.innerText.trim().replace(/\s+/g, ' '), href: node.href }))
      .filter((node) => node.text && node.href.includes('platform.kore.ai'))
      .slice(0, 60),
  );
  console.log('\n===== Navigation links =====');
  links.forEach((link) => console.log('  ' + link.text + '  ->  ' + link.href));
} finally {
  browser.disconnect();
}