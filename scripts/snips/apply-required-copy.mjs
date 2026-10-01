/**
 * Apply the required copy to existing message/dialogAct components.
 *
 * Text is URL-encoded because that is how the builder stores dialog message
 * text (observed in the read model). Every write is verified by re-reading.
 * Nothing is deleted and no node graph is touched.
 */
import { installAuthObserver } from '../kore-api.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';

// Only nodes whose position in the existing graph makes the copy correct.
const EDITS = [
  {
    dialog: 'User Registration',
    componentId: 'dc-f5007cc1-94ef-56d5-a6dd-926e3409a89f', // SubmitRegistration (terminal node)
    name: 'SubmitRegistration',
    text: 'Registration successful! Would you like to continue?',
  },
  {
    dialog: 'User Registration',
    componentId: 'dc-ed4931cb-1129-5f97-8ea6-f17b3fe96a39', // Message0001 (unreachable placeholder)
    name: 'Message0001',
    text: 'Thank you! Have a great day.',
  },
  {
    dialog: 'User Login',
    componentId: 'dc-8082c858-41cc-5cbe-a9f0-91b9d1d5ed4f', // Message0002 (placeholder)
    name: 'Message0002',
    text: 'Hello {{entities.email}}! You have successfully logged in.',
  },
];

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);

  const result = await page.evaluate(
    async (streamId, edits) => {
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
          last = { status: response.status, body: parsed };
          if (response.status !== 401 && response.status !== 403) return last;
        }
        return last || { status: 0 };
      };

      const readComponents = async () => {
        const result = await send('GET', '/components', undefined);
        return Array.isArray(result.body) ? result.body : [];
      };

      const decode = (value) => {
        try {
          return decodeURIComponent(value);
        } catch {
          return value;
        }
      };
      const readText = (component) => ((component || {}).message || []).map((part) => decode(part.text));

      const log = [];
      for (const edit of edits) {
        const components = await readComponents();
        const current = components.find((item) => item && item._id === edit.componentId);
        if (!current) {
          log.push({ name: edit.name, stage: 'not-found', componentId: edit.componentId });
          // eslint-disable-next-line no-continue
          continue;
        }

        const before = readText(current);
        const updated = JSON.parse(JSON.stringify(current));
        const encoded = encodeURIComponent(edit.text);
        if (Array.isArray(updated.message) && updated.message.length) {
          for (const part of updated.message) part.text = encoded;
        } else if (Array.isArray(updated.dialogAct)) {
          for (const part of updated.dialogAct) part.text = encoded;
        } else {
          log.push({ name: edit.name, stage: 'no-message-field', keys: Object.keys(current).slice(0, 20) });
          // eslint-disable-next-line no-continue
          continue;
        }

        // eslint-disable-next-line no-await-in-loop
        const write = await send('PUT', `/components/${edit.componentId}`, updated);

        // eslint-disable-next-line no-await-in-loop
        const verifyList = await readComponents();
        const now = verifyList.find((item) => item && item._id === edit.componentId);

        log.push({
          dialog: edit.dialog,
          name: edit.name,
          componentId: edit.componentId,
          before,
          writeStatus: write.status,
          after: readText(now),
          verified: readText(now).includes(edit.text),
          lMod: (now || {}).lMod,
        });
      }

      return log;
    },
    STREAM,
    EDITS,
  );

  mkdirSync('output/kore', { recursive: true });
  writeFileSync('output/kore/applied-copy.json', JSON.stringify(result, null, 2));

  return JSON.stringify(result, null, 1);
}