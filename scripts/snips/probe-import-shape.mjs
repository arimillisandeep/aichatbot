/**
 * Learn the import payload shape from its validation errors.
 *
 * An empty or near-empty body should be rejected with a message naming the
 * expected fields, without creating anything.
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

      const call = async (method, path, payload, raw) => {
        for (const headers of bags) {
          const init = { method, headers: { ...headers }, credentials: 'include' };
          if (raw !== undefined) {
            init.headers['Content-Type'] = 'application/json';
            init.body = raw;
          } else if (payload !== undefined) {
            init.headers['Content-Type'] = 'application/json';
            init.body = JSON.stringify(payload);
          }
          // eslint-disable-next-line no-await-in-loop
          const response = await fetch(root + path, init);
          if (response.status === 401 || response.status === 403) continue;
          const body = await response.text();
          let parsed = body;
          try {
            parsed = JSON.parse(body);
          } catch {
            /* raw */
          }
          return {
            status: response.status,
            keys: parsed && typeof parsed === 'object' ? Object.keys(parsed).slice(0, 12) : null,
            detail:
              (parsed && parsed.message) ||
              (parsed && parsed.errors && (parsed.errors[0] || {}).msg) ||
              (typeof parsed === 'string' ? parsed.slice(0, 200) : null),
            errors: (parsed && parsed.errors) || null,
          };
        }
        return { status: 'auth' };
      };

      const log = [];
      // Validation probes: nothing here can create a dialog.
      for (const [label, method, path, payload, raw] of [
        ['POST import empty obj', 'POST', '/import', {}, undefined],
        ['POST import empty arr', 'POST', '/import', [], undefined],
        ['POST import null', 'POST', '/import', undefined, 'null'],
        ['POST import garbage', 'POST', '/import', undefined, 'not-json'],
        ['POST import {dialogs:[]}', 'POST', '/import', { dialogs: [] }, undefined],
        ['POST import {name}', 'POST', '/import', { name: 'x' }, undefined],
        ['POST import by id path', 'POST', `/import/${dialogId}`, {}, undefined],
        ['POST import stream-level', 'POST', '/import', { dialogIds: [dialogId] }, undefined],
      ]) {
        // eslint-disable-next-line no-await-in-loop
        log.push({ label, ...(await call(method, path, payload, raw)) });
      }

      // Confirm nothing was created.
      const dialogs = await call('GET', '', undefined);
      return { log, dialogListKeys: dialogs.keys };
    },
    STREAM,
    LOGIN,
  );

  mkdirSync('output/kore', { recursive: true });
  writeFileSync('output/kore/probe-import-shape.json', JSON.stringify(data, null, 2));

  return JSON.stringify(data, null, 1);
}