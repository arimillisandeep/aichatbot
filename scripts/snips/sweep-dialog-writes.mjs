/**
 * Sweep write envelopes for dialog components.
 *
 * User Login is still in development, so this surface is the more likely
 * writable one. Message text is URL-encoded, per the observed model.
 * The first attempt writes the current text back unchanged, so a success is a
 * safe proof of the write path rather than a content change.
 */
import { installAuthObserver } from '../kore-api.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';
const DIALOG = 'dg-81900e92-4624-54d2-9ba8-920be68541aa';
const NOTICE = 'dc-29669010-614e-57c9-909d-e30d5517b4e1'; // loginLookupNotice

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);

  const result = await page.evaluate(
    async (streamId, dialogId, componentId) => {
      const bags = (window.__koreBags || []).map((entry) => entry.headers);
      const root = `https://platform.kore.ai/api/1.1/builder/streams/${streamId}/dialogs/${dialogId}`;

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
            body: parsed,
            detail: (parsed && parsed.errors && (parsed.errors[0] || {}).msg) || (parsed && parsed.message) || null,
          };
          if (response.status !== 401 && response.status !== 403) return last;
        }
        return last || { status: 0 };
      };

      const readComponents = async () => {
        const result = await send('GET', '/components?sendEntityRules=true', undefined);
        return Array.isArray(result.body) ? result.body : [];
      };

      const original = (await readComponents()).find((item) => item && item._id === componentId);
      if (!original) return { stage: 'read-failed' };

      const currentText = (original.message || []).map((part) => part.text);
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
        ['POST components/{id} no _id', 'POST', `/components/${componentId}`, omit(['_id', '__v'])],
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

      const now = (await readComponents()).find((item) => item && item._id === componentId);
      return {
        currentText,
        attempts: log,
        nowText: ((now || {}).message || []).map((part) => part.text),
        written,
      };
    },
    STREAM,
    DIALOG,
    NOTICE,
  );

  mkdirSync('output/kore', { recursive: true });
  writeFileSync('output/kore/dialog-write-probe.json', JSON.stringify(result, null, 2));

  return JSON.stringify(result, null, 1);
}