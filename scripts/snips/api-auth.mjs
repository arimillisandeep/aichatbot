/**
 * Report which request headers the builder sends, by NAME ONLY.
 *
 * Header values are never returned, printed, or stored. This only establishes
 * what a same-session request needs in order to be accepted.
 */
import { withApi } from '../kore-api.mjs';

export default async function run(page, h) {
  await page.evaluateOnNewDocument(() => {
    window.__koreHeaderNames = [];
    const originalFetch = window.fetch;
    window.fetch = function patchedFetch(input, init) {
      try {
        const request = new Request(input, init);
        request.headers.forEach((value, name) => {
          if (!window.__koreHeaderNames.includes(name)) window.__koreHeaderNames.push(name);
        });
      } catch {
        /* ignore */
      }
      return originalFetch.apply(this, arguments);
    };
  });

  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
  await h.enterApp();
  await h.wait(1500);
  await h.clickText('Dialogs');
  await h.wait(6000);

  const names = await page.evaluate(() => window.__koreHeaderNames || []);

  // Probe which headers the endpoint actually accepts, by trying requests with
  // the captured headers attached. The token itself stays in page scope.
  const probe = await withApi(page, async (kore) => {
    const template = window.__koreAuthHeaders || null;
    return { hasTemplate: !!template, status: kore.status };
  });

  return JSON.stringify({ headerNames: names, probe }, null, 1);
}