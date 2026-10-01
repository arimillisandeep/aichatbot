/**
 * Test whether the chat-flow write requires an ETag / If-Match precondition.
 *
 * Reads the message, records the response ETag, then retries the write with
 * If-Match and If-Unmodified-Since variants. Read-modify-write of one string.
 */
import { installAuthObserver } from '../kore-api.mjs';

const USER = 'u-7294aa15-9290-55a1-8b27-c45802448cde';
const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';
const FLOW = 'cf-7fe548da-c56b-59ed-b437-f00bf638d74f';
const MESSAGE = 'cfm-64266c64-7be8-5ff0-ad52-dc5122bb6856';
const DESIRED = 'Hello! Welcome to our Virtual Assistant.';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);
  await h.clickText('Flows & Channels');
  await h.wait(6000);
  await page.evaluate(() => {
    const leaf = [...document.querySelectorAll('*')].find((node) => {
      if (node.children.length) return false;
      return (node.innerText || '').trim() === 'Welcome Chat Flow';
    });
    if (leaf) (leaf.closest('a') || leaf.closest('tr') || leaf.parentElement || leaf).click();
  });
  await h.wait(10000);

  return JSON.stringify(
    await page.evaluate(
      async (userId, streamId, flowId, messageId, desired) => {
        const bags = (window.__koreBags || []).map((entry) => entry.headers);
        const root = `https://platform.kore.ai/api/1.1/users/${userId}/streams/${streamId}/callflows/${flowId}`;

        const send = async (method, path, payload, extra) => {
          let last = null;
          for (const headers of bags) {
            const init = { method, headers: { ...headers, ...(extra || {}) }, credentials: 'include' };
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
              etag: response.headers.get('etag'),
              lastModified: response.headers.get('last-modified'),
            };
            if (response.status !== 401 && response.status !== 403) return last;
          }
          return last || { status: 0 };
        };

        const list = await send('GET', '/messages', undefined);
        const items = Array.isArray(list.body) ? list.body : [];
        const original = items.find((item) => item && item._id === messageId);
        if (!original) return { stage: 'read-failed', status: list.status, etag: list.etag };

        const updated = JSON.parse(JSON.stringify(original));
        for (const part of updated.messages) {
          for (const locale of part.locale || []) {
            if (locale.language === 'en') locale.message = desired;
          }
        }

        const attempts = [];
        const tryWrite = async (label, method, path, payload, extra) => {
          const result = await send(method, path, payload, extra);
          attempts.push({
            label,
            status: result.status,
            message: (result.body && (result.body.message || result.body.error)) || null,
          });
          return result;
        };

        // Baseline, then ETag-preconditioned variants.
        await tryWrite('POST /messages', 'POST', '/messages', updated, undefined);
        if (list.etag) {
          await tryWrite('POST /messages + If-Match', 'POST', '/messages', updated, { 'If-Match': list.etag });
        }
        if (list.lastModified) {
          await tryWrite('POST /messages + If-Unmodified-Since', 'POST', '/messages', updated, {
            'If-Unmodified-Since': list.lastModified,
          });
        }
        await tryWrite('PUT /messages/id + If-Match', 'PUT', `/messages/${messageId}`, updated, list.etag ? { 'If-Match': list.etag } : undefined);

        const verify = await send('GET', '/messages', undefined);
        const now = (Array.isArray(verify.body) ? verify.body : []).find((item) => item && item._id === messageId);
        const text = ((now || {}).messages || [])
          .flatMap((part) => part.locale || [])
          .filter((locale) => locale.language === 'en')
          .map((locale) => locale.message);

        return {
          readEtag: list.etag,
          readLastModified: list.lastModified,
          attempts,
          nowText: text,
        };
      },
      USER,
      STREAM,
      FLOW,
      MESSAGE,
      DESIRED,
    ),
    null,
    1,
  );
}