/**
 * Collect the deployed channel details and links for this app.
 *
 * Reads the builder's own channel configuration; nothing is changed.
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
          return { status: response.status, body };
        }
        return { status: 'auth', body: null };
      };

      const urls = (value, found = [], depth = 0) => {
        if (depth > 6 || !value) return found;
        if (typeof value === 'string') {
          if (/^https?:\/\//i.test(value)) found.push(value);
          return found;
        }
        if (Array.isArray(value)) {
          value.forEach((item) => urls(item, found, depth + 1));
          return found;
        }
        if (typeof value === 'object') {
          Object.values(value).forEach((item) => urls(item, found, depth + 1));
        }
        return found;
      };

      const out = { probes: {}, links: [] };

      for (const [name, path] of [
        ['channels', `/builder/streams/${streamId}/channels`],
        ['digital channels', `/users/${userId}/builder/streams/${streamId}/channels`],
        ['app config', `/users/${userId}/builder/streams/${streamId}`],
        ['deploy', `/builder/streams/${streamId}/deploy`],
        ['dockStatus', `/builder/streams/${streamId}/dockStatus`],
        ['websdkthemes', `/users/${userId}/builder/streams/${streamId}/websdkthemes`],
      ]) {
        // eslint-disable-next-line no-await-in-loop
        const result = await get(path);
        out.probes[name] = { path, status: result.status };
        if (result.status === 200) {
          out.probes[name].urls = [...new Set(urls(result.body))].slice(0, 25);
          if (name === 'app config') {
            const body = result.body || {};
            out.probes[name].approvedChannels = body.approvedChannels;
            out.probes[name].channels = body.channels;
            out.probes[name].appName = body.name || body.appName;
            out.probes[name].botName = body.botName;
            out.probes[name].botId = body.botId;
            out.probes[name].streamId = body.streamId || body._id;
          }
          if (name === 'channels' || name === 'digital channels') out.probes[name].body = result.body;
        }
      }

      out.links = [...new Set(Object.values(out.probes).flatMap((entry) => entry.urls || []))];
      return out;
    },
    STREAM,
    USER,
  );

  mkdirSync('output/kore', { recursive: true });
  writeFileSync('output/kore/channels.json', JSON.stringify(data, null, 2));

  return JSON.stringify(data, null, 1).slice(0, 5000);
}