/** Read the full 412 validation error to learn which field is rejected. */
import { installAuthObserver } from '../kore-api.mjs';

const USER = 'u-7294aa15-9290-55a1-8b27-c45802448cde';
const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';
const FLOW = 'cf-7fe548da-c56b-59ed-b437-f00bf638d74f';
const MESSAGE = 'cfm-64266c64-7be8-5ff0-ad52-dc5122bb6856';

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
      async (userId, streamId, flowId, messageId) => {
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
            last = { status: response.status, body: parsed, text };
            if (response.status !== 401 && response.status !== 403) return last;
          }
          return last || { status: 0 };
        };

        const list = await send('GET', '/messages', undefined);
        const original = (Array.isArray(list.body) ? list.body : []).find((item) => item && item._id === messageId);

        const out = { fullObject: null, byId: null, originalKeys: null };
        if (original) {
          out.originalKeys = Object.keys(original);
          out.fullObject = await send('POST', '/messages', original);
          out.byId = await send('PUT', `/messages/${messageId}`, original);
        }
        return out;
      },
      USER,
      STREAM,
      FLOW,
      MESSAGE,
    ),
    null,
    1,
  );
}