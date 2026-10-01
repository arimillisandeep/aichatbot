/**
 * Attaches to the already-running Chrome window opened by kore-login.mjs and
 * reports what is reachable once the user has signed in.
 *
 * It reads the live page (URL, title, visible headings) from the browser the
 * user is looking at. It does not extract cookies or tokens.
 *
 * Usage: node scripts/kore-session-check.mjs
 */
import puppeteer from 'puppeteer-core';

import { CDP_URL } from './kore-login.mjs';

const browser = await puppeteer.connect({ browserURL: CDP_URL, defaultViewport: null });

try {
  const pages = await browser.pages();
  console.log('Open tabs: ' + pages.length);

  for (const page of pages) {
    const url = page.url();
    if (!url.includes('kore.ai')) continue;
    let title = '';
    try {
      title = await page.title();
    } catch {
      title = '(unavailable)';
    }
    console.log('- ' + url + '  [' + title + ']');
  }

  const signedIn = pages.some((page) => /platform\.kore\.ai\/(?!auth)/.test(page.url()));
  console.log(signedIn ? 'STATUS: signed in' : 'STATUS: not signed in yet');

  if (signedIn) {
    const page = pages.find((candidate) => /platform\.kore\.ai\/(?!auth)/.test(candidate.url()));
    const headings = await page
      .$$eval('h1, h2, [role="heading"]', (nodes) => nodes.slice(0, 25).map((node) => node.textContent.trim()).filter(Boolean))
      .catch(() => []);
    console.log('Visible headings:');
    headings.forEach((heading) => console.log('  - ' + heading));
  }
} finally {
  browser.disconnect();
}