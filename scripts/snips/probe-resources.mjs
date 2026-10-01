/** Probe builder "bt/resources" endpoints read-only, reporting shape not values. */
import { installAuthObserver } from '../kore-api.mjs';

const DIALOG = 'dg-81900e92-4624-54d2-9ba8-920be68541aa';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3000);

  return JSON.stringify(
    await withApiProbe(page),
    null,
    1,
  );
}

async function withApiProbe(page) {
  const result = await page.evaluate(async (dialogId) => {
    const userId = 'u-7294aa15-9290-55a1-8b27-c45802448cde';
    const headers = window.__koreAuthHeaders || {};
    const base = `https://platform.kore.ai/api/1.1/users/${userId}/bt/resources`;

    const shape = (value) => {
      if (Array.isArray(value)) return `array[${value.length}]`;
      if (value && typeof value === 'object') return 'object{' + Object.keys(value).slice(0, 14).join(',') + '}';
      return typeof value;
    };

    const get = async (path) => {
      try {
        const response = await fetch(base + path, { headers, credentials: 'include' });
        const text = await response.text();
        let body = text;
        try {
          body = JSON.parse(text);
        } catch {
          /* keep raw */
        }
        return { path, status: response.status, shape: shape(body) };
      } catch (error) {
        return { path, error: String(error).slice(0, 80) };
      }
    };

    const candidates = [
      `/${dialogId}`,
      `/${dialogId}/components`,
      `/${dialogId}/nodes`,
      `/${dialogId}/lock`,
      `/${dialogId}/history`,
      `/${dialogId}/publish`,
    ];

    const out = [];
    for (const path of candidates) {
      // eslint-disable-next-line no-await-in-loop
      out.push(await get(path));
    }
    return out;
  }, DIALOG);
  return result;
}
