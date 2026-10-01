/**
 * Edit the greeting through the flow editor and capture the exact write body.
 *
 * Only body KEY NAMES and structure are reported, never session material.
 */
const bodyShape = (value, depth = 0) => {
  if (Array.isArray(value)) return value.slice(0, 3).map((item) => bodyShape(item, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).slice(0, 14)) out[key] = bodyShape(value[key], depth + 1);
    return out;
  }
  return typeof value;
};

export default async function run(page, h) {
  await page.evaluateOnNewDocument(() => {
    window.__writes = [];
    const note = (method, url, body) => {
      if (!url.includes('platform.kore.ai/api/')) return;
      if (method === 'GET' || method === 'OPTIONS') return;
      let parsed = null;
      if (typeof body === 'string' && body) {
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = body.slice(0, 200);
        }
      }
      window.__writes.push({ method, url: url.split('?')[0], body: parsed });
    };

    const originalFetch = window.fetch;
    window.fetch = function patchedFetch(input, init) {
      try {
        note((init && init.method) || 'GET', typeof input === 'string' ? input : input.url, init && init.body);
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
        note(this.__method || 'GET', this.__url || '', body);
      } catch {
        /* ignore */
      }
      return originalSend.apply(this, arguments);
    };
  });

  await h.enterApp();
  await h.wait(3500);
  await h.clickText('Flows & Channels');
  await h.wait(6000);
  await page.evaluate(() => {
    const leaf = [...document.querySelectorAll('*')].find((node) => {
      if (node.children.length) return false;
      return (node.innerText || '').trim() === 'Welcome Chat Flow';
    });
    if (leaf) (leaf.closest('a') || leaf.closest('tr') || leaf.parentElement || leaf).click();
  });
  await h.wait(11000);
  await page.evaluate(() => window.__writes.splice(0));

  const nodeId = 'cfst-79ec1746-d968-5d21-8ce0-9c63ea1dc85a';
  const opened = await page.evaluate((id) => {
    const target = document.querySelector(`[data-node-id="${id}"], #${id}`) || [...document.querySelectorAll('*')].find(
      (node) => (node.getAttribute('data-node-id') || node.id) === id,
    );
    if (!target) return { ok: false };
    for (const type of ['dblclick', 'click']) {
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    }
    return { ok: true };
  }, nodeId);
  await h.wait(6000);

  const panel = await page.evaluate(() => ({
    textareas: [...document.querySelectorAll('textarea')].map((node) => ({
      value: (node.value || '').slice(0, 60),
      cls: String(node.className).slice(0, 40),
    })),
    inputs: [...document.querySelectorAll('input[type="text"], input:not([type])')].map((node) => (node.value || '').slice(0, 40)),
    buttons: [...document.querySelectorAll('button')].map((node) => (node.innerText || '').trim()).filter(Boolean).slice(-25),
  }));

  // Type the new greeting into the first editor textarea the way a user would.
  const typed = await page.evaluate((text) => {
    const area = [...document.querySelectorAll('textarea')].find((node) => node.offsetParent !== null);
    if (!area) return { ok: false, reason: 'no visible textarea' };
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(area, text);
    area.dispatchEvent(new Event('input', { bubbles: true }));
    area.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, now: area.value };
  }, 'Hello! Welcome to our Virtual Assistant.');
  await h.wait(2000);

  const saved = await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((node) => /^(save|update|apply)$/i.test((node.innerText || '').trim()));
    if (!button) return { ok: false, buttons: [...document.querySelectorAll('button')].map((n) => (n.innerText || '').trim()).filter(Boolean) };
    button.click();
    return { ok: true };
  });
  await h.wait(8000);

  const writes = await page.evaluate(() => (window.__writes || []).map((write) => ({
    method: write.method,
    url: write.url.replace('https://platform.kore.ai', ''),
    shape: write.body,
  })));

  const { bodyShape } = await import('../snips/capture-flow-save.mjs').catch(() => ({ bodyShape: null }));

  return JSON.stringify({ opened, panel, typed, saved, writes }, null, 1).slice(0, 4000);
}