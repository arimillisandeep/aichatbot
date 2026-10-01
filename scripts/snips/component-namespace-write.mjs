/**
 * Try a component message write with the dialog's vNameSpace populated.
 *
 * The dialog carries ns-f055ee80... but its components carry an empty array,
 * which is the remaining difference between the two documents.
 */
import { installAuthObserver } from '../kore-api.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';
const LOGIN = 'dg-81900e92-4624-54d2-9ba8-920be68541aa';
const TEXT = 'Hello {{entities.email}}! You have successfully logged in.';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);

  const result = await page.evaluate(
    async (streamId, dialogId, text) => {
      const bags = (window.__koreBags || []).map((entry) => entry.headers);
      const root = `https://platform.kore.ai/api/1.1/builder/streams/${streamId}`;

      const send = async (method, path, payload) => {
        for (const headers of bags) {
          const init = { method, headers: { ...headers }, credentials: 'include' };
          if (payload !== undefined) {
            init.headers['Content-Type'] = 'application/json';
            init.body = JSON.stringify(payload);
          }
          // eslint-disable-next-line no-await-in-loop
          const response = await fetch(root + path, init);
          const raw = await response.text();
          let parsed = raw;
          try {
            parsed = JSON.parse(raw);
          } catch {
            /* raw */
          }
          if (response.status === 401 || response.status === 403) continue;
          return {
            status: response.status,
            body: parsed,
            detail:
              (parsed && parsed.message) ||
              (parsed && parsed.errors && (parsed.errors[0] || {}).msg) ||
              (Array.isArray(parsed) ? `array[${parsed.length}]` : null),
          };
        }
        return { status: 'auth' };
      };

      const doc = (await send('GET', `/dialogs/${dialogId}`, undefined)).body || {};
      const namespaces = doc.vNameSpace || [];
      const components = (await send('GET', '/components', undefined)).body || [];
      const target = components.find((item) => item && item.name === 'Message0002');
      if (!target) return { stage: 'target-missing' };

      const variants = [
        ['vNameSpace list', namespaces],
        ['vNameSpace string', namespaces[0]],
        ['useTaskLevelNs false', 'flag'],
      ];

      const log = [];
      for (const [label, mode] of variants) {
        const copy = JSON.parse(JSON.stringify(target));
        copy.message[0].text = text;
        if (mode === 'flag') copy.useTaskLevelNs = false;
        else if (Array.isArray(mode)) copy.vNameSpace = mode;
        else copy.vNameSpace = [mode];

        // eslint-disable-next-line no-await-in-loop
        const write = await send('PUT', `/components/${target._id}`, copy);
        // eslint-disable-next-line no-await-in-loop
        const after = ((await send('GET', '/components', undefined)).body || []).find(
          (item) => item && item._id === target._id,
        );
        const texts = ((after || {}).message || []).map((part) => part.text);
        log.push({ label, status: write.status, detail: write.detail, applied: texts.includes(text), texts });
        if (texts.includes(text)) break;
      }

      return { namespaces, attempts: log };
    },
    STREAM,
    LOGIN,
    TEXT,
  );

  mkdirSync('output/kore', { recursive: true });
  writeFileSync('output/kore/component-namespace-write.json', JSON.stringify(result, null, 2));

  return JSON.stringify(result, null, 1);
}