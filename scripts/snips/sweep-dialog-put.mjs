/**
 * Sweep dialog-level PUT payload variants.
 *
 * Every attempt sends the document as read, so a success rewrites identical
 * content. Nothing is lost if a variant is rejected.
 */
import { installAuthObserver } from '../kore-api.mjs';

const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';
const LOGIN = 'dg-81900e92-4624-54d2-9ba8-920be68541aa';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);

  return JSON.stringify(
    await page.evaluate(
      async (streamId, dialogId) => {
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
              body: parsed,
              detail: (parsed && parsed.errors && (parsed.errors[0] || {}).msg) || (parsed && parsed.message) || null,
            };
            if (response.status !== 401 && response.status !== 403) return last;
          }
          return last || { status: 0 };
        };

        const read = async () => {
          const result = await send('GET', `/dialogs/${dialogId}`, undefined);
          return result;
        };

        const before = await send('GET', `/dialogs/${dialogId}`, undefined);
        const doc = before.body;
        if (!doc || doc.errors) return { stage: 'read-failed', status: before.status };

        const omit = (keys) => {
          const copy = JSON.parse(JSON.stringify(doc));
          keys.forEach((key) => delete copy[key]);
          return copy;
        };
        const withPatch = (patch) => ({ ...JSON.parse(JSON.stringify(doc)), ...patch });

        const readOnly = ['__v', '_id', 'createdBy', 'createdOn', 'lMod', 'lModBy', 'refId', 'isPublishedVersion', 'version'];

        const variants = [
          ['full', doc],
          ['no __v', omit(['__v'])],
          ['__v+1', withPatch({ __v: (doc.__v || 0) + 1 })],
          ['no read-only', omit(readOnly)],
          ['no __v/_id/created*/lMod*', omit(['__v', '_id', 'createdBy', 'createdOn', 'lMod', 'lModBy'])],
          ['no publish/version', omit(['isPublishedVersion', 'version'])],
          ['state configured', withPatch({ state: 'configured' })],
          ['no publish/version/state', omit(['isPublishedVersion', 'version', 'state', '__v'])],
          ['wrapper dialog', { dialog: doc }],
          ['wrapper data', { data: doc }],
        ];

        const log = [];
        let ok = null;
        for (const [label, payload] of variants) {
          // eslint-disable-next-line no-await-in-loop
          const result = await send('PUT', `/dialogs/${dialogId}`, payload);
          log.push({ label, status: result.status, detail: result.detail });
          if (result.status >= 200 && result.status < 300) {
            ok = label;
            break;
          }
        }

        const after = await send('GET', `/dialogs/${dialogId}`, undefined);
        return {
          lModBefore: doc.lMod,
          lModAfter: (after.body || {}).lMod,
          nodesBefore: (doc.nodes || []).length,
          nodesAfter: ((after.body || {}).nodes || []).length,
          accepted: ok,
          attempts: log,
        };
      },
      STREAM,
      LOGIN,
    ),
    null,
    1,
  );
}