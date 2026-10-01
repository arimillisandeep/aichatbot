/**
 * Find the namespace IDs the write API requires.
 *
 * Publish returns "namespace or namespaceIds not found or have incorrect
 * value", and the dialog document carries an empty vNameSpace, so the write
 * path almost certainly rejects on this. Read-only.
 */
import { installAuthObserver } from '../kore-api.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';
const DIALOG = 'dg-81900e92-4624-54d2-9ba8-920be68541aa';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);

  const result = await page.evaluate(
    async (streamId, dialogId) => {
      const bags = (window.__koreBags || []).map((entry) => entry.headers);
      const api = 'https://platform.kore.ai/api/1.1';

      const get = async (path) => {
        for (const headers of bags) {
          // eslint-disable-next-line no-await-in-loop
          const response = await fetch(api + path, { headers, credentials: 'include' });
          if (response.status === 401 || response.status === 403) continue;
          const raw = await response.text();
          let body = raw;
          try {
            body = JSON.parse(raw);
          } catch {
            /* raw */
          }
          return { path, status: response.status, body };
        }
        return { path, status: 'auth' };
      };

      const summarise = (value) => {
        if (Array.isArray(value)) {
          return {
            count: value.length,
            sample: value.slice(0, 5).map((item) =>
              item && typeof item === 'object'
                ? Object.keys(item).slice(0, 8).reduce((acc, key) => {
                    acc[key] = typeof item[key] === 'object' ? '[obj]' : item[key];
                    return acc;
                  }, {})
                : item,
            ),
          };
        }
        if (value && typeof value === 'object') return { keys: Object.keys(value).slice(0, 20) };
        return { type: typeof value };
      };

      const out = {};
      for (const [name, path] of [
        ['namespaces', `/builder/streams/${streamId}/namespaces`],
        ['namespace', `/builder/streams/${streamId}/namespace`],
        ['dialog namespaces', `/builder/streams/${streamId}/dialogs/${dialogId}/namespaces`],
        ['app config', `/users/u-7294aa15-9290-55a1-8b27-c45802448cde/builder/streams/${streamId}`],
        ['seed data', '/users/u-7294aa15-9290-55a1-8b27-c45802448cde/builder/seed_data'],
      ]) {
        // eslint-disable-next-line no-await-in-loop
        const result = await get(path);
        out[name] = { path: result.path, status: result.status, summary: summarise(result.body) };
        if (result.status === 200) out[name].raw = result.body;
      }

      // What does the dialog itself declare?
      const dialog = (await get(`/builder/streams/${streamId}/dialogs/${dialogId}`)).body || {};
      out.dialogNamespaceFields = {
        vNameSpace: dialog.vNameSpace,
        useTaskLevelNs: dialog.useTaskLevelNs,
        topKeys: Object.keys(dialog).filter((key) => /ns|namespace/i.test(key)),
      };

      return out;
    },
    STREAM,
    DIALOG,
  );

  mkdirSync('output/kore', { recursive: true });
  writeFileSync('output/kore/namespaces.json', JSON.stringify(result, null, 2));

  // Print a trimmed view; the raw app config is large.
  const trimmed = { ...result };
  for (const key of ['app config', 'seed data']) {
    if (trimmed[key] && trimmed[key].raw) delete trimmed[key].raw;
  }
  return JSON.stringify(trimmed, null, 1).slice(0, 5000);
}