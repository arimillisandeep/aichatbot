/**
 * Discover publish / unpublish routes for dialogs and chat flows.
 *
 * Probe with GET and OPTIONS only, so no state is changed while mapping.
 */
import { installAuthObserver } from '../kore-api.mjs';

const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';
const USER = 'u-7294aa15-9290-55a1-8b27-c45802448cde';
const FLOW = 'cf-7fe548da-c56b-59ed-b437-f00bf638d74f';
const DIALOG = 'dg-f5ea5367-ed33-58e2-8a70-e9b7366c0080';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);

  return JSON.stringify(
    await page.evaluate(
      async (streamId, userId, flowId, dialogId) => {
        const bags = (window.__koreBags || []).map((entry) => entry.headers);
        const api = 'https://platform.kore.ai/api/1.1';

        const probe = async (method, path) => {
          for (const headers of bags) {
            // eslint-disable-next-line no-await-in-loop
            const response = await fetch(api + path, { method, headers, credentials: 'include' });
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
                (Array.isArray(body) ? `array[${body.length}]` : null),
            };
          }
          return { status: 'auth' };
        };

        const flowRoot = `/users/${userId}/streams/${streamId}/callflows/${flowId}`;
        const dialogRoot = `/builder/streams/${streamId}/dialogs/${dialogId}`;

        const out = {};
        for (const [name, path] of [
          ['flow /publish', `${flowRoot}/publish`],
          ['flow /unpublish', `${flowRoot}/unpublish`],
          ['flow /versions', `${flowRoot}/versions`],
          ['flow /state', `${flowRoot}/state`],
          ['dialog /publish', `${dialogRoot}/publish`],
          ['dialog /unpublish', `${dialogRoot}/unpublish`],
          ['dialog /state', `${dialogRoot}/state`],
          ['dialog /validate', `${dialogRoot}/validate`],
          ['stream /deploy', `/builder/streams/${streamId}/deploy`],
        ]) {
          // eslint-disable-next-line no-await-in-loop
          out[name] = { get: await probe('GET', path), options: await probe('OPTIONS', path) };
        }

        return out;
      },
      STREAM,
      USER,
      FLOW,
      DIALOG,
    ),
    null,
    1,
  );
}