/**
 * Audit the live Kore.ai app against the assignment requirements.
 *
 * Read-only. Reports what is present so the gap list is factual.
 */
import { installAuthObserver } from '../kore-api.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';
const USER = 'u-7294aa15-9290-55a1-8b27-c45802448cde';
const FLOW = 'cf-7fe548da-c56b-59ed-b437-f00bf638d74f';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);

  const data = await page.evaluate(
    async (streamId, userId, flowId) => {
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
          return body;
        }
        return null;
      };

      const dialogs = (await get(`/builder/streams/${streamId}/dialogs`)) || [];
      const list = Array.isArray(dialogs) ? dialogs : dialogs.dialogs || [];
      const components = (await get(`/builder/streams/${streamId}/components`)) || [];
      const intents = (await get(`/builder/streams/${streamId}/intents`)) || [];
      const flowMessages = (await get(`/users/${userId}/streams/${streamId}/callflows/${flowId}/messages`)) || [];
      const app = (await get(`/users/${userId}/builder/streams/${streamId}`)) || {};

      const decode = (value) => {
        try {
          return decodeURIComponent(value);
        } catch {
          return value;
        }
      };
      const componentByName = (name) => components.find((item) => item && item.name === name);

      return {
        dialogs: list.map((dialog) => ({
          name: dialog.name,
          status: dialog.status || dialog.state,
          nodes: (dialog.nodes || []).length,
        })),
        intents: (Array.isArray(intents) ? intents : []).map((intent) => intent.name),
        componentTypes: components.reduce((acc, item) => {
          acc[item.type] = (acc[item.type] || 0) + 1;
          return acc;
        }, {}),
        greeting: (Array.isArray(flowMessages) ? flowMessages : [])
          .filter((item) => item && item._id === 'cfm-64266c64-7be8-5ff0-ad52-dc5122bb6856')
          .flatMap((item) => item.messages || [])
          .flatMap((part) => part.locale || [])
          .filter((locale) => locale.language === 'en')
          .map((locale) => locale.message),
        copyPresent: {
          Message0001: ((componentByName('Message0001') || {}).message || []).map((p) => decode(p.text)),
          Message0002: ((componentByName('Message0002') || {}).message || []).map((p) => decode(p.text)),
          loginLookupNotice: ((componentByName('loginLookupNotice') || {}).message || []).map((p) => decode(p.text)),
          SubmitRegistration: ((componentByName('SubmitRegistration') || {}).message || []).map((p) => decode(p.text)),
        },
        channels: (app.channels || []).map((channel) => ({
          type: channel.type,
          name: channel.name,
          enable: channel.enable,
        })),
        approvedChannels: app.approvedChannels,
      };
    },
    STREAM,
    USER,
    FLOW,
  );

  mkdirSync('output/kore', { recursive: true });
  writeFileSync('output/kore/audit.json', JSON.stringify(data, null, 2));

  return JSON.stringify(data, null, 1).slice(0, 5000);
}