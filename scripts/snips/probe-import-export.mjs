/**
 * Probe Import & Export, intent training, and Search AI collection routes.
 *
 * The publish screen offers "Import & Export". If dialog tasks can be imported
 * from a document, that is a write path that bypasses the component and graph
 * APIs which reject writes. Read-only probing first.
 */
import { installAuthObserver } from '../kore-api.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';
const USER = 'u-7294aa15-9290-55a1-8b27-c45802448cde';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);

  const data = await page.evaluate(
    async (streamId, userId) => {
      const bags = (window.__koreBags || []).map((entry) => entry.headers);
      const api = 'https://platform.kore.ai/api/1.1';
      const b = `/builder/streams/${streamId}`;
      const u = `/users/${userId}/builder/streams/${streamId}`;

      // GET and OPTIONS only: map which routes exist without changing state.
      const probe = async (method, path) => {
        for (const headers of bags) {
          const init = { method, headers: { ...headers }, credentials: 'include' };
          // eslint-disable-next-line no-await-in-loop
          const response = await fetch(api + path, init);
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
            detail:
              (body && body.message) ||
              (body && body.errors && (body.errors[0] || {}).msg) ||
              (Array.isArray(body) ? `array[${body.length}]` : typeof body),
          };
        }
        return { status: 'auth' };
      };

      const groups = {
        importExport: [
          `${b}/dialogs/import`,
          `${b}/import`,
          `${b}/export`,
          `${u}/import`,
          `${u}/export`,
          `${b}/importexport`,
          `${b}/dialogs/export`,
          `${u}/dialogs/import`,
        ],
        intentTraining: [
          `${b}/intents/train`,
          `${b}/nlp`,
          `${b}/nlu`,
          `${b}/training`,
          `${b}/intents/training`,
          `${b}/model`,
        ],
        searchAi: [
          `${b}/searchai`,
          `${b}/searchAi`,
          `${b}/searchai/collections`,
          `${b}/searchAi/collections`,
          `${b}/knowledgegraph`,
          `${b}/searchaicollection`,
          `${u}/searchai`,
        ],
      };

      const out = {};
      for (const [group, paths] of Object.entries(groups)) {
        out[group] = {};
        for (const path of paths) {
          // eslint-disable-next-line no-await-in-loop
          out[group][path.replace(`${api}`, '').replace(streamId, '{s}').replace(userId, '{u}')] = await probe('GET', path);
        }
      }
      return out;
    },
    STREAM,
    USER,
  );

  mkdirSync('output/kore', { recursive: true });
  writeFileSync('output/kore/probe-import-export.json', JSON.stringify(data, null, 2));

  return JSON.stringify(data, null, 1);
}