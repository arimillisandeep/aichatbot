/**
 * Open the Chat Flow from the builder and capture the API reads it issues.
 *
 * Only platform.kore.ai/api URLs and response shapes are reported.
 */
import { installAuthObserver } from '../kore-api.mjs';

export default async function run(page, h) {
  await page.evaluateOnNewDocument(() => {
    window.__apiReads = [];
    window.__authHeaders = null;
    const keep = ['_zitok', '_vtok', 'authorization', 'session-id'];

    const note = (method, url) => {
      if (url.includes('platform.kore.ai/api/')) {
        window.__apiReads.push({ method, url: url.split('?')[0] });
      }
    };

    const originalFetch = window.fetch;
    window.fetch = function patchedFetch(input, init) {
      try {
        const url = typeof input === 'string' ? input : input.url;
        const bucket = {};
        new Request(input, init).headers.forEach((value, name) => {
          const key = String(name).toLowerCase();
          if (keep.includes(key)) bucket[key] = value;
        });
        if (Object.keys(bucket).length) window.__authHeaders = bucket;
        note((init && init.method) || 'GET', url);
      } catch {
        /* ignore */
      }
      return originalFetch.apply(this, arguments);
    };

    const pending = new WeakMap();
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function patchedOpen(method, url) {
      this.__method = method;
      this.__url = url;
      return originalOpen.apply(this, arguments);
    };
    const originalSet = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function patchedSet(name, value) {
      const key = String(name).toLowerCase();
      if (keep.includes(key)) {
        const bucket = pending.get(this) || {};
        bucket[key] = value;
        pending.set(this, bucket);
      }
      return originalSet.apply(this, arguments);
    };
    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function patchedSend(body) {
      try {
        if (pending.get(this) && Object.keys(pending.get(this)).length) {
          window.__authHeaders = pending.get(this);
        }
        note(this.__method || 'GET', this.__url || '');
      } catch {
        /* ignore */
      }
      return originalSend.apply(this, arguments);
    };
  });

  await h.enterApp();
  await h.wait(4000);

  const navLabels = await page.evaluate(() => {
    const wanted = ['chat flow', 'conversation orchestration', 'dialog tasks', 'search ai', 'knowledge ai'];
    return [...document.querySelectorAll('*')]
      .filter((node) => !node.children.length)
      .map((node) => (node.innerText || '').trim())
      .filter((text) => wanted.includes(text.toLowerCase()));
  });

  const clickedChatFlow = await page.evaluate(() => {
    const leaf = [...document.querySelectorAll('*')].find((node) => {
      if (node.children.length) return false;
      return (node.innerText || '').trim().toLowerCase() === 'chat flow';
    });
    if (!leaf) return false;
    const clickable = leaf.closest('a') || leaf.closest('button') || leaf.parentElement || leaf;
    clickable.click();
    return true;
  });

  await h.wait(9000);

  const reads = await page.evaluate(() => window.__apiReads || []);
  const unique = [...new Set(reads.map((read) => `${read.method} ${read.url.replace('https://platform.kore.ai', '')}`))];

  return JSON.stringify(
    { navLabels: [...new Set(navLabels)], clickedChatFlow, url: await h.url(), reads: unique },
    null,
    1,
  );
}