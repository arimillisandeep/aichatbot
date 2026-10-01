/** Dump the Conversation Orchestration screen to locate the Welcome Chat Flow. */
import { installAuthObserver } from '../kore-api.mjs';

export default async function run(page, h) {
  await page.evaluateOnNewDocument(() => {
    window.__apiReads = [];
    const keep = ['_zitok', '_vtok', 'authorization', 'session-id'];
    const note = (method, url) => {
      if (url.includes('platform.kore.ai/api/')) window.__apiReads.push(`${method} ${url.split('?')[0]}`);
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
  await h.wait(9000);

  const text = await h.dump(4000);
  const reads = await page.evaluate(() => window.__apiReads || []);
  const unique = [...new Set(reads.map((read) => read.replace('https://platform.kore.ai', '')))];

  const buttons = await page.evaluate(() =>
    [...new Set(
      [...document.querySelectorAll('button, a, [role="tab"]')]
        .map((node) => (node.innerText || '').trim())
        .filter((value) => value && value.length < 40),
    )].slice(0, 60),
  );

  return [
    'URL: ' + (await h.url()),
    '',
    '--- READS ---',
    unique.join('\n'),
    '',
    '--- SCREEN ---',
    text.slice(0, 2000),
    '',
    '--- CONTROLS ---',
    buttons.join(' | '),
  ].join('\n');
}