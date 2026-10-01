/** Open the Welcome Chat Flow and capture the API used to read/write its nodes. */
import { installAuthObserver } from '../kore-api.mjs';

export default async function run(page, h) {
  await page.evaluateOnNewDocument(() => {
    window.__api = [];
    const note = (method, url) => {
      if (url.includes('platform.kore.ai/api/')) window.__api.push(`${method} ${url.split('?')[0]}`);
    };
    const originalFetch = window.fetch;
    window.fetch = function patchedFetch(input, init) {
      try {
        note((init && init.method) || 'GET', typeof input === 'string' ? input : input.url);
      } catch {
        /* ignore */
      }
      return originalFetch.apply(this, arguments);
    };
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function patchedOpen(method, url) {
      this.__method = method;
      this.__url = url;
      return originalOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function patchedSend(body) {
      try {
        note(this.__method || 'GET', this.__url || '');
      } catch {
        /* ignore */
      }
      return originalSend.apply(this, arguments);
    };
  });

  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(4000);
  await h.clickText('Flows & Channels');
  await h.wait(7000);

  await page.evaluate(() => window.__api.splice(0));

  const clicked = await page.evaluate(() => {
    const leaf = [...document.querySelectorAll('*')].find((node) => {
      if (node.children.length) return false;
      return (node.innerText || '').trim() === 'Welcome Chat Flow';
    });
    if (!leaf) return false;
    (leaf.closest('a') || leaf.closest('tr') || leaf.parentElement || leaf).click();
    return true;
  });

  await h.wait(12000);

  const calls = await page.evaluate(() => window.__api || []);
  const text = await h.dump(2500);

  return [
    'clicked: ' + clicked,
    'URL: ' + (await h.url()),
    '',
    '--- CALLS AFTER OPEN ---',
    [...new Set(calls.map((call) => call.replace('https://platform.kore.ai', '')))].join('\n'),
    '',
    '--- SCREEN ---',
    text.slice(0, 1200),
  ].join('\n');
}