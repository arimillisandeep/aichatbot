/**
 * Sweep app-level component write routes.
 *
 * GET /builder/streams/{stream}/components works, so its write sibling is the
 * most likely place components are saved. Writes the current text back
 * unchanged first, so success proves the path without changing content.
 */
import { installAuthObserver } from '../kore-api.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';
const NOTICE = 'dc-29669010-614e-57c9-909d-e30d5517b4e1';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);

  const result = await page.evaluate(
    async (streamId, componentId) => {
      const bags = (window.__koreBags || []).map((entry) => entry.headers);
      const root = `https://platform.kore.ai/api/1.1/builder/streams/${streamId}`;

      const send = async (method, path, payload) => {
        let last = null;
        for (const headers of bags) {
          const init = { method, headers: { ...headers }, credentials: 'include' };
          if (payload !== undefined) {
            init.headers['Content-Type'] = 'application/json';
            init.body = JSON.stringify(payload);
          }
          // eslint-disable-next-line no-await-in-loop
          const response = await fetch(root + path, init);
          const text = await response.text();
          let parsed = text;
          try {
            parsed = JSON.parse(text);
          } catch {
            /* raw */
          }
          last = {
            status: response.status,
            detail: (parsed && parsed.errors && (parsed.errors[0] || {}).msg) || (parsed && parsed.message) || null,
          };
          if (response.status !== 401 && response.status !== 403) return last;
        }
        return last || { status: 0 };
      };

      const readAll = async () => {
        for (const headers of bags) {
          // eslint-disable-next-line no-await-in-loop
          const response = await fetch(`${root}/components`, { headers, credentials: 'include' });
          if (response.status === 200) return response.json();
        }
        return [];
      };

      const original = (await readAll()).find((item) => item && item._id === componentId);
      if (!original) return { stage: 'read-failed' };

      const base = JSON.parse(JSON.stringify(original));
      const omit = (keys) => {
        const copy = JSON.parse(JSON.stringify(base));
        keys.forEach((key) => delete copy[key]);
        return copy;
      };

      const attempts = [
        ['PUT components/{id}', 'PUT', `/components/${componentId}`, base],
        ['POST components/{id}', 'POST', `/components/${componentId}`, base],
        ['PUT components', 'PUT', '/components', base],
        ['POST components', 'POST', '/components', base],
        ['PUT components/{id} no __v', 'PUT', `/components/${componentId}`, omit(['__v'])],
        ['PUT components/{id} slim', 'PUT', `/components/${componentId}`, omit(['__v', 'entityRules', 'vNameSpace', 'refId'])],
      ];

      const log = [];
      let written = false;
      for (const [label, method, path, payload] of attempts) {
        // eslint-disable-next-line no-await-in-loop
        const result = await send(method, path, payload);
        log.push({ label, method, path, status: result.status, detail: result.detail });
        if (result.status >= 200 && result.status < 300) {
          written = true;
          break;
        }
      }

      const now = (await readAll()).find((item) => item && item._id === componentId);
      return {
        attempts: log,
        nowText: ((now || {}).message || []).map((part) => part.text),
        nowLMod: (now || {}).lMod,
        written,
      };
    },
    STREAM,
    NOTICE,
  );

  mkdirSync('output/kore', { recursive: true });
  writeFileSync('output/kore/app-component-write-probe.json', JSON.stringify(result, null, 2));

  return JSON.stringify(result, null, 1);
}