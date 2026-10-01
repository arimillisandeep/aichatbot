/**
 * Drive the flow editor's own save to learn the exact write contract.
 *
 * Records method, URL and body key names for non-GET calls. Header and token
 * values are never captured.
 */
export default async function run(page, h) {
  await page.evaluateOnNewDocument(() => {
    window.__writes = [];
    const note = (method, url, body) => {
      if (!url.includes('platform.kore.ai/api/')) return;
      if (method === 'GET' || method === 'OPTIONS') return;
      let keys = null;
      if (typeof body === 'string' && body) {
        try {
          keys = Object.keys(JSON.parse(body));
        } catch {
          keys = ['<non-json>'];
        }
      }
      window.__writes.push({ method, url: url.split('?')[0], keys });
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

    const pending = new WeakMap();
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSet = XMLHttpRequest.prototype.setRequestHeader;
    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function patchedOpen(method, url) {
      this.__method = method;
      this.__url = url;
      return originalOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.setRequestHeader = function patchedSet(name, value) {
      const bag = pending.get(this) || {};
      bag[String(name).toLowerCase()] = 'set';
      pending.set(this, bag);
      return originalSet.apply(this, arguments);
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

  // Select the second Message Prompt node on the canvas, then open its editor.
  const selected = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('[class*="node"], [data-node-id], [id*="cfst-"]')];
    const target = nodes.find((node) => /cfst-79ec1746|MessagePrompt0002/i.test(node.getAttribute('id') || node.getAttribute('data-node-id') || ''));
    if (target) {
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return { ok: true, via: 'id', id: target.id || target.getAttribute('data-node-id') };
    }
    // Fall back: click each Message Prompt in turn.
    const byText = [...document.querySelectorAll('*')].filter((node) => {
      if (node.children.length) return false;
      return (node.innerText || '').trim() === 'Message Prompt';
    });
    if (byText.length >= 2) {
      byText[1].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return { ok: true, via: 'text', count: byText.length };
    }
    return { ok: false, nodeCandidates: nodes.length };
  });
  await h.wait(6000);

  const screen = await h.dump(2500);
  const writes = await page.evaluate(() => window.__writes || []);

  return JSON.stringify(
    {
      selected,
      writes: writes.map((write) => ({
        ...write,
        url: write.url.replace('https://platform.kore.ai', ''),
      })),
      screen: screen.slice(0, 1500),
    },
    null,
    1,
  );
}