/**
 * Retry the chat flow message write now that the flow is a draft.
 *
 * The flow reported isPublishedVersion: true earlier and every write returned
 * 412. Editing through the UI moved it to In Development, so this retries the
 * API write against the draft.
 */
import { installAuthObserver } from '../kore-api.mjs';
import { openFlow, wait } from '../kore-ui-edit.mjs';

const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';
const USER = 'u-7294aa15-9290-55a1-8b27-c45802448cde';
const FLOW = 'cf-7fe548da-c56b-59ed-b437-f00bf638d74f';
const THANK_YOU = 'cfm-284bd182-2801-55c1-9dac-2eb22cf7da26';
const DESIRED = 'No problem! Have a great day.';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);

  // The Flows API needs that screen's header set, so visit it first.
  await openFlow(page, h, 'Welcome Chat Flow');
  await h.wait(3000);

  return JSON.stringify(
    await page.evaluate(
      async (streamId, userId, flowId, messageId, desired) => {
        const bags = (window.__koreBags || []).map((entry) => entry.headers);
        const root = `https://platform.kore.ai/api/1.1/users/${userId}/streams/${streamId}/callflows/${flowId}`;

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
            const raw = await response.text();
            let parsed = raw;
            try {
              parsed = JSON.parse(raw);
            } catch {
              /* raw */
            }
            last = {
              status: response.status,
              body: parsed,
              detail:
                (parsed && parsed.message) ||
                (parsed && parsed.errors && (parsed.errors[0] || {}).msg) ||
                (Array.isArray(parsed) ? `array[${parsed.length}]` : null),
            };
            if (response.status !== 401 && response.status !== 403) return last;
          }
          return last || { status: 'auth' };
        };

        const flow = await send('GET', '', undefined);
        const list = await send('GET', '/messages', undefined);
        const original = (Array.isArray(list.body) ? list.body : []).find(
          (item) => item && item._id === messageId,
        );

        const out = {
          isPublishedVersion: (flow.body || {}).isPublishedVersion,
          isPublished: (flow.body || {}).isPublished,
          state: (flow.body || {}).state,
          found: !!original,
        };
        if (!original) return out;

        const englishOf = (message) =>
          ((message || {}).messages || [])
            .flatMap((part) => part.locale || [])
            .filter((locale) => locale.language === 'en')
            .map((locale) => locale.message);

        out.before = englishOf(original);
        const updated = JSON.parse(JSON.stringify(original));
        for (const part of updated.messages) {
          for (const locale of part.locale || []) {
            if (locale.language === 'en') locale.message = desired;
          }
        }

        out.attempts = [];
        for (const [label, method, path, payload] of [
          ['POST /messages', 'POST', '/messages', updated],
          ['PUT /messages/{id}', 'PUT', `/messages/${messageId}`, updated],
        ]) {
          // eslint-disable-next-line no-await-in-loop
          const result = await send(method, path, payload);
          out.attempts.push({ label, status: result.status, detail: result.detail });
          // eslint-disable-next-line no-await-in-loop
          const verify = await send('GET', '/messages', undefined);
          const now = (Array.isArray(verify.body) ? verify.body : []).find(
            (item) => item && item._id === messageId,
          );
          const texts = englishOf(now);
          if (texts.includes(desired)) {
            out.applied = true;
            out.after = texts;
            break;
          }
        }
        return out;
      },
      STREAM,
      USER,
      FLOW,
      THANK_YOU,
      DESIRED,
    ),
    null,
    1,
  );
}