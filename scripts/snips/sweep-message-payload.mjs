/**
 * Find a payload shape that actually persists dialog message text.
 *
 * Component PUT returns 200 and advances lMod but the text never changes, so
 * the message payload shape is still wrong. Each variant is verified by
 * re-reading the component from the service.
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
        const api = 'https://platform.kore.ai/api/1.1';
        const root = `${api}/builder/streams/${streamId}`;

        const send = async (method, path, payload) => {
          let last = null;
          for (const headers of bags) {
            const init = { method, headers: { ...headers }, credentials: 'include' };
            if (payload !== undefined) {
              init.headers['Content-Type'] = 'application/json';
              init.body = JSON.stringify(payload);
            }
            // eslint-disable-next-line no-await-in-loop
            const response = await fetch(path.startsWith('http') ? path : api + path, init);
            const raw = await response.text();
            let parsed = raw;
            try {
              parsed = JSON.parse(raw);
            } catch {
              /* raw */
            }
            last = { status: response.status, body: parsed };
            if (response.status !== 401 && response.status !== 403) return last;
          }
          return last || { status: 0 };
        };

        const readText = async () => {
          const result = await send('GET', '/builder/streams/' + streamId + '/components', undefined);
          const items = Array.isArray(result.body) ? result.body : [];
          const found = items.find((item) => item && item._id === componentId);
          return ((found || {}).message || []).map((part) => part.text);
        };

        const base = (await send('GET', '/builder/streams/' + streamId + '/components', undefined)).body.find(
          (item) => item && item._id === componentId,
        );
        if (!base) return { stage: 'read-failed' };

        const start = await readText();
        const mid = base.message[0]._id;
        const msg = base.message[0];

        const probeGets = [];
        for (const path of [
          `/builder/streams/${streamId}/components/${componentId}/messages`,
          `/builder/streams/${streamId}/components/messages/${componentId}`,
          `/builder/streams/${streamId}/components/messages/${mid}`,
        ]) {
          // eslint-disable-next-line no-await-in-loop
          const result = await send('GET', path, undefined);
          probeGets.push({
            path,
            status: result.status,
            keys: result.body && typeof result.body === 'object' ? Object.keys(result.body).slice(0, 8) : null,
          });
        }

        const variants = [
          ['message only array', 'PUT', `/builder/streams/${streamId}/components/${componentId}`, { message: [{ text, channel: 'default', type: 'basic' }] }],
          ['message only text', 'PUT', `/builder/streams/${streamId}/components/${componentId}`, { message: [{ text }] }],
          ['message object', 'PUT', `/builder/streams/${streamId}/components/${componentId}`, { message: { text } }],
          ['messages plural', 'PUT', `/builder/streams/${streamId}/components/${componentId}`, { messages: [{ text }] }],
          ['full + plain text', 'PUT', `/builder/streams/${streamId}/components/${componentId}`, { ...base, message: [{ ...msg, text }] }],
          ['full + encoded text', 'PUT', `/builder/streams/${streamId}/components/${componentId}`, { ...base, message: [{ ...msg, text: encodeURIComponent(text) }] }],
          ['POST message only', 'POST', `/builder/streams/${streamId}/components/${componentId}`, { message: [{ text, channel: 'default', type: 'basic' }] }],
          ['POST components/messages', 'POST', `/builder/streams/${streamId}/components/messages`, { _id: componentId, message: [{ text, channel: 'default', type: 'basic' }] }],
        ];

        const log = [];
        let applied = false;
        for (const [label, method, path, payload] of variants) {
          // eslint-disable-next-line no-await-in-loop
          const result = await send(method, path, payload);
          // eslint-disable-next-line no-await-in-loop
          const now = await readText();
          const hit = now.some((value) => value === text || value === encodeURIComponent(text));
          log.push({ label, method, status: result.status, now });
          if (hit) {
            applied = true;
            break;
          }
        }

        return { start, probeGets, attempts: log, applied, final: await readText() };
      },
      STREAM,
      COMPONENT,
      TEXT,
    ),
    null,
    1,
  );
}