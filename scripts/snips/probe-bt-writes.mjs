/**
 * Probe builder-task write routes for the dialog document.
 *
 * The lock endpoint lives under /users/{u}/bt/resources/{id}, so that is the
 * likely save namespace. Every attempt sends the document exactly as read, so a
 * success rewrites identical content.
 */
import { installAuthObserver } from '../kore-api.mjs';

const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';
const USER = 'u-7294aa15-9290-55a1-8b27-c45802448cde';
const LOGIN = 'dg-81900e92-4624-54d2-9ba8-920be68541aa';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);

  return JSON.stringify(
    await page.evaluate(
      async (streamId, userId, dialogId) => {
        const bags = (window.__koreBags || []).map((entry) => entry.headers);
        const api = 'https://platform.kore.ai/api/1.1';

        const send = async (method, path, payload) => {
          for (const headers of bags) {
            const init = { method, headers: { ...headers }, credentials: 'include' };
            if (payload !== undefined) {
              init.headers['Content-Type'] = 'application/json';
              init.body = JSON.stringify(payload);
            }
            // eslint-disable-next-line no-await-in-loop
            const response = await fetch(api + path, init);
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
                (Array.isArray(parsed) ? `array[${parsed.length}]` : typeof parsed),
            };
          }
          return { status: 'auth' };
        };

        const docResult = (await send('GET', `/builder/streams/${streamId}/dialogs/${dialogId}`, undefined)).body;
        if (!docResult || !docResult.nodes) return { stage: 'read-failed' };

        const bt = `/users/${userId}/bt/resources/${dialogId}`;
        const attempts = [
          ['PUT bt resource', 'PUT', bt, docResult],
          ['POST bt resource', 'POST', bt, docResult],
          ['PUT bt save', 'PUT', `${bt}/save`, docResult],
          ['POST bt save', 'POST', `${bt}/save`, docResult],
          ['PUT bt dialogs', 'PUT', `/users/${userId}/bt/dialogs/${dialogId}`, docResult],
          ['POST bt dialogs', 'POST', `/users/${userId}/bt/dialogs/${dialogId}`, docResult],
          ['PUT builder dialog', 'PUT', `/builder/streams/${streamId}/dialogs/${dialogId}`, docResult],
          ['POST builder dialog', 'POST', `/builder/streams/${streamId}/dialogs/${dialogId}`, docResult],
          ['PUT builder dialog save', 'PUT', `/builder/streams/${streamId}/dialogs/${dialogId}/save`, docResult],
          ['POST builder dialog save', 'POST', `/builder/streams/${streamId}/dialogs/${dialogId}/save`, docResult],
          ['POST builder dialog nodes', 'POST', `/builder/streams/${streamId}/dialogs/${dialogId}/nodes`, { nodes: docResult.nodes }],
          ['PUT dialogs publish', 'PUT', `/builder/streams/${streamId}/dialogs/${dialogId}/publish`, docResult],
          ['POST dialogs publish', 'POST', `/builder/streams/${streamId}/dialogs/${dialogId}/publish`, docResult],
        ];

        const log = [];
        for (const [label, method, path, payload] of attempts) {
          // eslint-disable-next-line no-await-in-loop
          const result = await send(method, path, payload);
          log.push({
            label,
            method,
            path: path.replace(streamId, '{stream}').replace(userId, '{user}'),
            status: result.status,
            detail: result.detail,
          });
          if (result.status >= 200 && result.status < 300) break;
        }

        const afterDoc = (await send('GET', `/builder/streams/${streamId}/dialogs/${dialogId}`, undefined)).body;

        return {
          lModBefore: docResult.lMod,
          lModAfter: (afterDoc || {}).lMod,
          nodesBefore: (docResult.nodes || []).length,
          nodesAfter: ((afterDoc || {}).nodes || []).length,
          attempts: log,
        };
      },
      STREAM,
      USER,
      LOGIN,
    ),
    null,
    1,
  );
}