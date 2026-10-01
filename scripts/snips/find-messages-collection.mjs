/**
 * Locate the collection that actually stores dialog message text.
 *
 * The component PUT returns message ids but never changes the text, so the
 * text is held in a separate store. Probe candidate routes read-only first.
 */
import { installAuthObserver } from '../kore-api.mjs';

const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';
const DIALOG = 'dg-81900e92-4624-54d2-9ba8-920be68541aa';
const MESSAGE = 'mt-62342c8f-4cc1-5689-87ae-1f7835105b25';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);

  return JSON.stringify(
    await page.evaluate(
      async (streamId, dialogId, messageId) => {
        const bags = (window.__koreBags || []).map((entry) => entry.headers);
        const api = 'https://platform.kore.ai/api/1.1';

        const shape = (value) => {
          if (Array.isArray(value)) return `array[${value.length}]`;
          if (value && typeof value === 'object') return 'object{' + Object.keys(value).slice(0, 12).join(',') + '}';
          return typeof value;
        };

        const texts = (value) => {
          if (!Array.isArray(value)) return null;
          return value.map((part) => (part && typeof part === 'object' ? part.text : part));
        };

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
            return {
              path,
              status: response.status,
              shape: shape(body),
              text: texts(body && body.message) || texts(Array.isArray(body) ? body[0] && body[0].message : null),
              keys: Array.isArray(body)
                ? (body[0] ? Object.keys(body[0]).slice(0, 12) : [])
                : body && typeof body === 'object'
                  ? Object.keys(body).slice(0, 12)
                  : [],
            };
          }
          return { path, error: 'auth' };
        };

        const candidates = [
          `/builder/streams/${streamId}/messages`,
          `/builder/streams/${streamId}/messages/${messageId}`,
          `/builder/streams/${streamId}/dialogs/${dialogId}/messages`,
          `/builder/streams/${streamId}/dialogs/${dialogId}/messages/${messageId}`,
          `/builder/streams/${streamId}/components/messages`,
          `/builder/streams/${streamId}/message`,
        ];

        const out = [];
        for (const path of candidates) {
          // eslint-disable-next-line no-await-in-loop
          out.push(await get(path));
        }
        return out;
      },
      STREAM,
      DIALOG,
      MESSAGE,
    ),
    null,
    1,
  );
}