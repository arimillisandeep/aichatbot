/**
 * Find the accepted shape for updating a message component's text.
 *
 * Uses Message0002 in User Login, which is in development (writable). Each
 * variant writes the target text and the result is re-read to confirm.
 */
import { installAuthObserver } from '../kore-api.mjs';

const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';
const COMPONENT = 'dc-8082c858-41cc-5cbe-a9f0-91b9d1d5ed4f';
const TEXT = 'Hello {{entities.email}}! You have successfully logged in.';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);

  return JSON.stringify(
    await page.evaluate(
      async (streamId, componentId, text) => {
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
            const text2 = await response.text();
            let parsed = text2;
            try {
              parsed = JSON.parse(text2);
            } catch {
              /* raw */
            }
            last = { status: response.status, body: parsed };
            if (response.status !== 401 && response.status !== 403) return last;
          }
          return last || { status: 0 };
        };

        const readCurrent = async () => {
          const result = await send('GET', '/components', undefined);
          const items = Array.isArray(result.body) ? result.body : [];
          const found = items.find((item) => item && item._id === componentId);
          return ((found || {}).message || []).map((part) => part.text);
        };

        const start = await readCurrent();
        const base = (await send('GET', '/components', undefined)).body.find(
          (item) => item && item._id === componentId,
        );
        if (!base) return { stage: 'read-failed' };

        const build = (textValue, keys) => {
          const copy = JSON.parse(JSON.stringify(base));
          keys.forEach((key) => delete copy[key]);
          copy.message[0].text = textValue;
          return copy;
        };

        const variants = [
          ['full plain', 'PUT', `/components/${componentId}`, build(text, [])],
          ['no __v', 'PUT', `/components/${componentId}`, build(text, ['__v'])],
          ['no read-only', 'PUT', `/components/${componentId}`, build(text, ['__v', 'refId', 'createdOn', 'lMod', 'lModBy', 'botName'])],
          ['messages subroute', 'PUT', `/components/${componentId}/messages`, base.message],
          [
            'message id subroute',
            'PUT',
            `/components/${componentId}/messages/${base.message[0]._id}`,
            { text, channel: 'default', type: 'basic' },
          ],
        ];

        const log = [];
        for (const [label, method, path, payload] of variants) {
          // eslint-disable-next-line no-await-in-loop
          const result = await send(method, path, payload);
          // eslint-disable-next-line no-await-in-loop
          const now = await readCurrent();
          const applied = now.some((value) => value === text);
          log.push({ label, method, path, status: result.status, applied, now });
          if (applied) break;
        }

        return { start, attempts: log, final: await readCurrent() };
      },
      STREAM,
      COMPONENT,
      TEXT,
    ),
    null,
    1,
  );
}