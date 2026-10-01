/**
 * Discover the builder's write endpoints by observing real UI traffic.
 *
 * Opens the User Login dialog, edits one message, saves, and records the
 * method/URL/keys of the resulting write requests. Nothing is printed except
 * request shape, never header or token values.
 */
import { installAuthObserver } from '../kore-api.mjs';

export default async function run(page, h) {
  await installAuthObserver(page);

  const seen = [];
  await page.evaluateOnNewDocument(() => {
    window.__koreWrites = [];
    const keep = ['_zitok', '_vtok', 'authorization', 'session-id'];
    const pending = new WeakMap();

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

    const originalFetch = window.fetch;
    window.fetch = function patchedFetch(input, init) {
      try {
        const url = typeof input === 'string' ? input : input.url;
        const method = (init && init.method) || 'GET';
        if (method !== 'GET') {
          window.__koreWrites.push({ via: 'fetch', method, url, bodyKeys: null });
        }
        const bucket = {};
        new Request(input, init).headers.forEach((value, name) => {
          const key = String(name).toLowerCase();
          if (keep.includes(key)) bucket[key] = value;
        });
        if (Object.keys(bucket).length) window.__koreAuthHeaders = bucket;
      } catch {
        /* ignore */
      }
      return originalFetch.apply(this, arguments);
    };

    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function patchedSend(body) {
      try {
        const method = this.__koreMethod || 'GET';
        if (method !== 'GET' && typeof body === 'string' && body.length) {
          let keys = null;
          try {
            keys = Object.keys(JSON.parse(body));
          } catch {
            keys = ['<non-json>'];
          }
          window.__koreWrites.push({ via: 'xhr', method, url: this.__koreUrl, bodyKeys: keys });
        }
        if (pending.get(this) && Object.keys(pending.get(this)).length) {
          window.__koreAuthHeaders = pending.get(this);
        }
      } catch {
        /* ignore */
      }
      return originalSend.apply(this, arguments);
    };

    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function patchedOpen(method, url) {
      this.__koreMethod = method;
      this.__koreUrl = url;
      return originalOpen.apply(this, arguments);
    };
  });

  await h.enterApp();
  await h.wait(3000);
  await h.clickText('Dialogs');
  await h.wait(6000);

  const before = await page.evaluate(() => (window.__koreWrites || []).length);
  seen.push({ phase: 'baseline', count: before });

  // Open User Login from the dialogs list by clicking its grid row.
  const opened = await page.evaluate(() => {
    const leaf = [...document.querySelectorAll('*')].find((node) => {
      if (node.children.length) return false;
      return (node.innerText || '').trim() === 'User Login';
    });
    if (!leaf) return { ok: false, reason: 'leaf not found' };

    // Walk up to the row container that carries the click handler.
    let target = leaf;
    for (let up = 0; up < 8 && target; up += 1) {
      target = target.parentElement;
      if (!target) break;
      const style = window.getComputedStyle(target);
      if (style.cursor === 'pointer' || /row|card|dialog/i.test(target.className || '')) break;
    }
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
    target.dispatchEvent(event);
    return { ok: true, tag: target.tagName, cls: String(target.className).slice(0, 80) };
  });
  await h.wait(12000);
  seen.push({ phase: 'opened', opened, url: await h.url() });

  const dump = await h.dump(2500);
  seen.push({ phase: 'screen', text: dump.slice(0, 1200) });

  const writes = await page.evaluate(() => window.__koreWrites || []);
  return JSON.stringify({ seen, writes }, null, 1);
}