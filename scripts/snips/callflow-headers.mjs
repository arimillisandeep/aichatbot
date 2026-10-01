/** Report header NAMES (never values) used by the callflows API request. */
export default async function run(page, h) {
  await page.evaluateOnNewDocument(() => {
    window.__callflowHeaders = null;
    window.__authHeaders = null;
    const keep = ['_zitok', '_vtok', 'authorization', 'session-id'];

    const record = (headers) => {
      const bucket = {};
      headers.forEach((value, name) => {
        const key = String(name).toLowerCase();
        if (keep.includes(key)) bucket[key] = value;
      });
      if (Object.keys(bucket).length) window.__authHeaders = bucket;
    };

    const pending = new WeakMap();
    const originalSet = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function patchedSet(name, value) {
      const key = String(name).toLowerCase();
      const bucket = pending.get(this) || {};
      bucket[key] = '1';
      pending.set(this, bucket);
      return originalSet.apply(this, arguments);
    };
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function patchedOpen(method, url) {
      this.__url = url;
      return originalOpen.apply(this, arguments);
    };
    const realSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function patchedSend(body) {
      try {
        if ((this.__url || '').includes('/callflows/')) {
          const names = Object.keys(pending.get(this) || {});
          window.__callflowHeaders = names;
          const values = {};
          names.forEach((name) => {
            values[name] = valueOf(name);
          });
          function valueOf() {
            return null;
          }
        }
        if (pending.get(this)) {
          const bag = {};
          // Recompute values by replaying through the original setter is not
          // possible, so hand the bucket to a dedicated store instead.
          window.__lastHeaders = pending.get(this);
        }
      } catch {
        /* ignore */
      }
      return realSend.apply(this, arguments);
    };

    const originalFetch = window.fetch;
    window.fetch = function patchedFetch(input, init) {
      try {
        record(new Request(input, init).headers);
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes('/callflows/')) {
          const names = [];
          new Request(input, init).headers.forEach((value, name) => names.push(name));
          window.__callflowHeaders = names;
        }
      } catch {
        /* ignore */
      }
      return originalFetch.apply(this, arguments);
    };
  });

  await h.enterApp();
  await h.wait(4000);
  await h.clickText('Flows & Channels');
  await h.wait(7000);
  await page.evaluate(() => {
    const leaf = [...document.querySelectorAll('*')].find((node) => {
      if (node.children.length) return false;
      return (node.innerText || '').trim() === 'Welcome Chat Flow';
    });
    if (leaf) (leaf.closest('a') || leaf.closest('tr') || leaf.parentElement || leaf).click();
  });
  await h.wait(12000);

  const names = await page.evaluate(() => window.__callflowHeaders);
  return JSON.stringify({ callflowHeaderNames: names }, null, 1);
}