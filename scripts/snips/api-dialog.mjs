/** Capture only builder REST traffic that carries the app's dialog/intent model. */
export default async function run(page, h) {
  await page.evaluateOnNewDocument(() => {
    const originalFetch = window.fetch;
    window.fetch = function patchedFetch(input, init) {
      const url = typeof input === 'string' ? input : input.url;
      const record = {
        method: (init && init.method) || 'GET',
        url: String(url),
        body: init && init.body ? String(init.body) : null,
        status: null,
        response: null,
      };
      window.__koreCapture = window.__koreCapture || [];
      window.__koreCapture.push(record);
      const result = originalFetch.apply(this, arguments);
      return result.then((response) => {
        record.status = response.status;
        const clone = response.clone();
        record.response = clone.text().then((text) => text.slice(0, 1500)).catch(() => null);
        return response;
      });
    };

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function patchedOpen(method, url) {
      this.__koreMethod = method;
      this.__koreUrl = url;
      return originalOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function patchedSend(body) {
      window.__koreCapture = window.__koreCapture || [];
      const record = { xhr: true, method: this.__koreMethod, url: String(this.__koreUrl), body: body ? String(body) : null };
      window.__koreCapture.push(record);
      this.addEventListener('load', () => {
        record.status = this.status;
        try {
          record.response = String(this.responseText).slice(0, 1500);
        } catch {
          record.response = '(unreadable)';
        }
      });
      return originalSend.apply(this, arguments);
    };
  });

  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
  await page.evaluate(() => {
    window.__koreCapture = [];
  });

  await h.enterApp();
  await h.wait(1500);
  await h.clickText('Dialogs');
  await h.wait(7000);
  await h.clickText('User Login');
  await h.wait(8000);

  const all = await page.evaluate(() => window.__koreCapture || []);
  await page.evaluate(async () => {
    for (const entry of window.__koreCapture || []) {
      if (entry.response && typeof entry.response.then === 'function') {
        try {
          entry.response = await entry.response;
        } catch {
          entry.response = '(error)';
        }
      }
    }
  });
  const resolved = await page.evaluate(() => window.__koreCapture || []);

  const interesting = resolved.filter((entry) => {
    const url = entry.url;
    if (!/\/api\/1\.1\//.test(url)) return false;
    return /dialog|task|intent|node|flow|knowledge|collection|search/i.test(url);
  });

  return JSON.stringify(
    interesting.map((entry) => ({
      method: entry.method,
      status: entry.status,
      url: entry.url.replace(/[?&]rnd=[^&]*/, ''),
      body: entry.body ? entry.body.slice(0, 300) : null,
      response: entry.response ? String(entry.response).slice(0, 600) : null,
    })),
    null,
    1,
  );
}