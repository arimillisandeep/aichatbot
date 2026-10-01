/**
 * Recover the builder's REST endpoint templates from its own JS bundle.
 *
 * The app is loaded in the authenticated page; scripts are read as text and
 * searched for URL fragments. Read-only.
 */
import { installAuthObserver } from '../kore-api.mjs';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(4000);

  const scripts = await page.evaluate(() =>
    [...document.querySelectorAll('script[src]')].map((node) => node.src).filter(Boolean),
  );

  const patterns = [
    /builder\/streams\/[^"'`]{0,60}dialogs[^"'`]{0,60}/g,
    /dialogs\/\$\{[^}]+\}\/components/g,
    /['"`][^"'`]*\/dialogs[^"'`]*['"`]/g,
    /['"`][^"'`]*components[^"'`]*['"`]/g,
  ];

  const hits = {};
  let checked = 0;

  for (const src of scripts.slice(0, 40)) {
    // eslint-disable-next-line no-await-in-loop
    const text = await page.evaluate(async (url) => {
      try {
        const response = await fetch(url, { credentials: 'include' });
        return response.ok ? await response.text() : '';
      } catch {
        return '';
      }
    }, src);
    if (!text) continue;
    checked += 1;

    for (const pattern of patterns) {
      const matches = text.match(pattern) || [];
      for (const value of matches) {
        const key = value.length > 90 ? value.slice(0, 90) : value;
        hits[key] = (hits[key] || 0) + 1;
      }
    }
  }

  const sorted = Object.entries(hits)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 60)
    .map(([value, count]) => `${count}x  ${value}`);

  return ['scripts: ' + scripts.length + ' fetched: ' + checked, '', ...sorted].join('\n');
}