/**
 * Read the app's tokens and deploy metadata to resolve the public web link.
 *
 * Secret values are replaced with a redaction marker before they leave the
 * page, so no token or secret is ever returned to Node.
 */
import { installAuthObserver } from '../kore-api.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';
const USER = 'u-7294aa15-9290-55a1-8b27-c45802448cde';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);

  const data = await page.evaluate(
    async (streamId, userId) => {
      const bags = (window.__koreBags || []).map((entry) => entry.headers);
      const api = 'https://platform.kore.ai/api/1.1';

      // Redact anything that looks like a credential before it crosses out.
      const scrub = (value, key = '', depth = 0) => {
        if (depth > 8) return '[deep]';
        const secretish = /secret|token|password|apikey|api_key|credential/i.test(key);
        if (secretish && typeof value === 'string') return '[redacted]';
        if (Array.isArray(value)) return value.map((item) => scrub(item, key, depth + 1));
        if (value && typeof value === 'object') {
          return Object.fromEntries(
            Object.entries(value).map(([childKey, child]) => [childKey, scrub(child, childKey, depth + 1)]),
          );
        }
        return value;
      };

      const get = async (path) => {
        for (const headers of bags) {
          // eslint-disable-next-line no-await-in-loop
          const response = await fetch(api + path, { headers, credentials: 'include' });
          if (response.status === 401 || response.status === 403) continue;
          const raw = await response.text();
          let body = raw;
          try {
            body = JSON.parse(raw);
          } catch {
            /* raw */
          }
          return { status: response.status, body: scrub(body) };
        }
        return { status: 'auth', body: null };
      };

      const out = { probes: {} };
      for (const [name, path] of [
        ['tokens', `/users/${userId}/builder/streams/${streamId}/tokens`],
        ['getcodevelopers', `/users/${userId}/builder/streams/${streamId}/getcodevelopers`],
      ]) {
        // eslint-disable-next-line no-await-in-loop
        const result = await get(path);
        out.probes[name] = { path, status: result.status, body: result.body };
      }
      return out;
    },
    STREAM,
    USER,
  );

  mkdirSync('output/kore', { recursive: true });
  writeFileSync('output/kore/tokens-redacted.json', JSON.stringify(data, null, 2));

  return JSON.stringify(data, null, 1).slice(0, 4000);
}