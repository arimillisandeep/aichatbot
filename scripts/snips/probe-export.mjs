/**
 * Work out how the dialogs export route expects to be called.
 *
 * GET on /dialogs/export returns 500 rather than 404, so the route exists and
 * only rejected the empty call. This is read-only: export makes no changes.
 */
import { installAuthObserver } from '../kore-api.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';
const LOGIN = 'dg-81900e92-4624-54d2-9ba8-920be68541aa';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);

  const data = await page.evaluate(
    async (streamId, dialogId) => {
      const bags = (window.__koreBags || []).map((entry) => entry.headers);
      const root = `https://platform.kore.ai/api/1.1/builder/streams/${streamId}/dialogs`;

      const call = async (method, path, payload) => {
        for (const headers of bags) {
          const init = { method, headers: { ...headers }, credentials: 'include' };
          if (payload !== undefined) {
            init.headers['Content-Type'] = 'application/json';
            init.body = JSON.stringify(payload);
          }
          // eslint-disable-next-line no-await-in-loop
          const response = await fetch(root + path, init);
          if (response.status === 401 || response.status === 403) continue;
          const raw = await response.text();
          let body = raw;
          try {
            body = JSON.parse(raw);
          } catch {
            /* raw */
          }
          return {
            status: response.status,
            type: response.headers.get('content-type'),
            preview: typeof body === 'string' ? body.slice(0, 400) : null,
            keys: body && typeof body === 'object' && !Array.isArray(body) ? Object.keys(body).slice(0, 14) : null,
            isArray: Array.isArray(body),
            length: Array.isArray(body) ? body.length : null,
            detail: (body && body.message) || (body && body.errors && (body.errors[0] || {}).msg) || null,
          };
        }
        return { status: 'auth' };
      };

      const attempts = [
        ['GET export', 'GET', '/export', undefined],
        ['GET export ?dialogId', 'GET', `/export?dialogId=${dialogId}`, undefined],
        ['GET export ?dialogs', 'GET', `/export?dialogs=${dialogId}`, undefined],
        ['GET export ?ids', 'GET', `/export?ids=${dialogId}`, undefined],
        ['POST export', 'POST', '/export', { dialogIds: [dialogId] }],
        ['POST export ids', 'POST', '/export', { ids: [dialogId] }],
        ['POST export single', 'POST', '/export', { _id: dialogId }],
        ['GET export single', 'GET', `/export/${dialogId}`, undefined],
        ['POST export single path', 'POST', `/export/${dialogId}`, {}],
      ];

      const log = [];
      for (const [label, method, path, payload] of attempts) {
        // eslint-disable-next-line no-await-in-loop
        log.push({ label, method, path: path.replace(dialogId, '{id}'), ...(await call(method, path, payload)) });
      }
      return log;
    },
    STREAM,
    LOGIN,
  );

  mkdirSync('output/kore', { recursive: true });
  writeFileSync('output/kore/probe-export.json', JSON.stringify(data, null, 2));

  return JSON.stringify(data, null, 1);
}