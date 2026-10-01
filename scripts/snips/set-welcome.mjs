/**
 * Set the Welcome Chat Flow greeting to the required copy.
 *
 * Snapshot: output/kore/welcome-chat-flow*.json (unchanged originals).
 * The message object is re-read, mutated in exactly one place, written back,
 * then re-read to confirm persistence.
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
  await h.wait(9000);

  const result = await page.evaluate(
    async (userId, streamId, flowId, messageId, desired) => {
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
        return last || { status: 0, body: null };
      };

      const readAll = async () => {
        const list = await send('GET', '/messages', undefined);
        const items = Array.isArray(list.body) ? list.body : (list.body && list.body.messages) || [];
        return { status: list.status, items };
      };

      const beforeList = await readAll();
      const original = (beforeList.items || []).find((item) => item && item._id === messageId);
      if (!original || !original.messages) {
        return {
          stage: 'read-failed',
          status: beforeList.status,
          ids: (beforeList.items || []).map((item) => item && item._id),
        };
      }

      // Mutate exactly one string.
      const updated = JSON.parse(JSON.stringify(original));
      for (const part of updated.messages) {
        for (const locale of part.locale || []) {
          if (locale.language === 'en') locale.message = desired;
        }
      }

      const attempts = [];
      const candidates = [
        ['POST', `/messages/${messageId}`, updated],
        ['PUT', `/messages/${messageId}`, updated],
        ['PUT', '/messages', updated],
        ['POST', '/messages', updated],
      ];
      for (const [method, path, payload] of candidates) {
        // eslint-disable-next-line no-await-in-loop
        const attempt = await send(method, path, payload);
        attempts.push({ attempt: `${method} ${path}`, status: attempt.status });
        if (attempt.status >= 200 && attempt.status < 300) break;
      }

      const afterList = await readAll();
      const nowMessage = (afterList.items || []).find((item) => item && item._id === messageId);
      const english = (message) =>
        ((message || {}).messages || [])
          .flatMap((part) => part.locale || [])
          .filter((locale) => locale.language === 'en')
          .map((locale) => locale.message);

      return {
        originalText: english(original),
        attempts,
        verifyStatus: afterList.status,
        nowText: english(nowMessage),
      };
    },
    USER,
    STREAM,
    FLOW,
    MESSAGE,
    DESIRED,
  );

  return JSON.stringify(result, null, 1);
}