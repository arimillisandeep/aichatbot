/**
 * Retry the dialog write now that the document carries a vNameSpace.
 *
 * Also retries the message text write, since components carry their own
 * vNameSpace that may now be populated. Each result is verified by re-read.
 */
import { installAuthObserver } from '../kore-api.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';
const LOGIN = 'dg-81900e92-4624-54d2-9ba8-920be68541aa';
const MESSAGE = 'Hello {{entities.email}}! You have successfully logged in.';

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

      const out = {};

      // 1. Dialog write, document unchanged.
      const doc = (await send('GET', `/dialogs/${dialogId}`, undefined)).body;
      out.dialogNamespace = doc ? doc.vNameSpace : null;
      if (doc) {
        const write = await send('PUT', `/dialogs/${dialogId}`, doc);
        out.dialogWrite = { status: write.status, detail: write.detail };
        const after = (await send('GET', `/dialogs/${dialogId}`, undefined)).body || {};
        out.dialogWrite.lModAfter = after.lMod;
        out.dialogWrite.nodesAfter = (after.nodes || []).length;
      }

      // 2. Message text on the in-development User Login placeholder.
      const components = (await send('GET', '/components', undefined)).body || [];
      const target = components.find((item) => item && item.name === 'Message0002');
      out.targetFound = !!target;
      if (target) {
        out.componentNamespaceBefore = target.vNameSpace;
        const copy = JSON.parse(JSON.stringify(target));
        copy.message[0].text = text;
        const write = await send('PUT', `/components/${target._id}`, copy);
        out.componentWrite = { status: write.status, detail: write.detail };
        const after = ((await send('GET', '/components', undefined)).body || []).find(
          (item) => item && item._id === target._id,
        );
        out.componentWrite.textAfter = ((after || {}).message || []).map((part) => part.text);
        out.componentWrite.applied = ((after || {}).message || []).some((part) => part.text === text);
        out.componentNamespaceAfter = (after || {}).vNameSpace;
      }

      return out;
    },
    STREAM,
    LOGIN,
    MESSAGE,
  );

  mkdirSync('output/kore', { recursive: true });
  writeFileSync('output/kore/namespace-retry.json', JSON.stringify(result, null, 2));

  return JSON.stringify(result, null, 1);
}