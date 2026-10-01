/**
 * Acquire the builder resource lock, write the greeting, then release the lock.
 *
 * Snapshot of originals: output/kore/welcome-chat-flow*.json
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
        const flowRoot = `https://platform.kore.ai/api/1.1/users/${userId}/streams/${streamId}/callflows/${flowId}`;
        const lockRoot = `https://platform.kore.ai/api/1.1/users/${userId}/bt/resources/${flowId}`;

        const send = async (root, method, path, payload) => {
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
              message: (parsed && (parsed.message || parsed.error)) || null,
            };
            if (response.status !== 401 && response.status !== 403) return last;
          }
          return last || { status: 0 };
        };

        const log = {};

        log.lockGet = await send(lockRoot, 'GET', '/lock', undefined);
        log.lockPost = await send(lockRoot, 'POST', '/lock', { resourceId: flowId, TTLInMin: 10 });
        log.lockPostKeys = log.lockPost.body && Object.keys(log.lockPost.body).slice(0, 12);

        const list = await send(flowRoot, 'GET', '/messages', undefined);
        const items = Array.isArray(list.body) ? list.body : [];
        const original = items.find((item) => item && item._id === messageId);

        log.write = { status: 0, message: 'message object not found' };
        if (original) {
          const updated = JSON.parse(JSON.stringify(original));
          for (const part of updated.messages) {
            for (const locale of part.locale || []) {
              if (locale.language === 'en') locale.message = desired;
            }
          }
          log.write = await send(flowRoot, 'POST', '/messages', updated);
        }

        const verify = await send(flowRoot, 'GET', '/messages', undefined);
        const now = (Array.isArray(verify.body) ? verify.body : []).find((item) => item && item._id === messageId);
        log.nowText = ((now || {}).messages || [])
          .flatMap((part) => part.locale || [])
          .filter((locale) => locale.language === 'en')
          .map((locale) => locale.message);

        return log;
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