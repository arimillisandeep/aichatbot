/** Locate the Chat Flow holding the welcome message and its read endpoint. */
import { installAuthObserver } from '../kore-api.mjs';

const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3000);

  return JSON.stringify(
    await page.evaluate(async (streamId) => {
      const userId = 'u-7294aa15-9290-55a1-8b27-c45802448cde';
      const headers = window.__koreAuthHeaders || {};

      const shape = (value) => {
        if (Array.isArray(value)) return `array[${value.length}]`;
        if (value && typeof value === 'object') return 'object{' + Object.keys(value).slice(0, 14).join(',') + '}';
        return typeof value;
      };

      const get = async (url) => {
        try {
          const response = await fetch(url, { headers, credentials: 'include' });
          const text = await response.text();
          let body = text;
          try {
            body = JSON.parse(text);
          } catch {
            /* raw */
          }
          return { url: url.replace('https://platform.kore.ai', ''), status: response.status, shape: shape(body) };
        } catch (error) {
          return { url, error: String(error).slice(0, 90) };
        }
      };

      const api = 'https://platform.kore.ai/api/1.1';
      const candidates = [
        `${api}/builder/streams/${streamId}/chatflows`,
        `${api}/builder/streams/${streamId}/chatFlows`,
        `${api}/builder/streams/${streamId}/flow`,
        `${api}/builder/streams/${streamId}/chatFlow`,
        `${api}/users/${userId}/bt/resources?streamId=${streamId}`,
        `${api}/builder/streams/${streamId}/components`,
        `${api}/builder/streams/${streamId}/entities`,
        `${api}/builder/streams/${streamId}/intents`,
      ];

      const out = [];
      for (const url of candidates) {
        // eslint-disable-next-line no-await-in-loop
        out.push(await get(url));
      }
      return out;
    }, STREAM),
    null,
    1,
  );
}