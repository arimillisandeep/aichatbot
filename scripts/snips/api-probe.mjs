/**
 * Discover the Kore.ai builder's internal API surface.
 *
 * Instruments fetch and XMLHttpRequest in the live signed-in page, then performs
 * normal UI navigation so the requests the builder itself makes are recorded.
 * Requests are observed, never replayed from extracted credentials.
 */
export default async function run(page, h) {
  const captured = [];

  await page.evaluateOnNewDocument(() => {
    const originalFetch = window.fetch;
    window.fetch = function patchedFetch(input, init) {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init && init.method) || (typeof input !== 'string' && input.method) || 'GET';
      const record = { method, url: String(url).slice(0, 220), body: init && init.body ? String(init.body).slice(0, 400) : null };
      window.__koreCapture = window.__koreCapture || [];
      window.__koreCapture.push(record);
      return originalFetch.apply(this, arguments);
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
      window.__koreCapture.push({
        xhr: true,
        method: this.__koreMethod,
        url: String(this.__koreUrl).slice(0, 220),
        body: body ? String(body).slice(0, 400) : null,
      });
      return originalSend.apply(this, arguments);
    };
  });

  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
  await page.evaluate(() => {
    window.__koreCapture = [];
  });

  await h.enterApp();
  await h.wait(2000);
  await h.clickText('Dialogs');
  await h.wait(6000);
  await h.clickText('User Login');
  await h.wait(7000);

  captured.push(...(await page.evaluate(() => window.__koreCapture || [])));

  const api = captured.filter((entry) =>
    /\/api\/|platform-api|builder|graphql/i.test(entry.url) && !/\.(png|jpg|svg|css|woff2?|ico)$/i.test(entry.url),
  );

  const unique = [];
  const seen = new Set();
  for (const entry of api) {
    const key = entry.method + ' ' + entry.url;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(entry);
  }

  return [
    'captured total: ' + captured.length,
    'api-like unique: ' + unique.length,
    '',
    JSON.stringify(unique.slice(0, 45), null, 1),
  ].join('\n');
}