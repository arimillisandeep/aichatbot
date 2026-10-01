/** Final state check: confirm no unintended changes landed during probing. */
import { installAuthObserver } from '../kore-api.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';
const USER = 'u-7294aa15-9290-55a1-8b27-c45802448cde';
const FLOW = 'cf-7fe548da-c56b-59ed-b437-f00bf638d74f';
const MESSAGE = 'cfm-64266c64-7be8-5ff0-ad52-dc5122bb6856';

const decode = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);

  const result = await page.evaluate(
    async (streamId, userId, flowId, messageId) => {
      const bags = (window.__koreBags || []).map((entry) => entry.headers);
      const get = async (url) => {
        for (const headers of bags) {
          // eslint-disable-next-line no-await-in-loop
          const response = await fetch(url, { headers, credentials: 'include' });
          if (response.status === 401 || response.status === 403) continue;
          return { status: response.status, body: await response.json() };
        }
        return { status: 0, body: null };
      };

      const api = 'https://platform.kore.ai/api/1.1';
      const components = await get(`${api}/builder/streams/${streamId}/components`);
      const dialogs = await get(`${api}/builder/streams/${streamId}/dialogs`);
      const flowMessages = await get(
        `${api}/users/${userId}/streams/${streamId}/callflows/${flowId}/messages`,
      );

      const items = Array.isArray(components.body) ? components.body : [];
      const dialogList = Array.isArray(dialogs.body) ? dialogs.body : (dialogs.body && dialogs.body.dialogs) || [];
      const messages = Array.isArray(flowMessages.body) ? flowMessages.body : [];

      const textOf = (component) => ((component || {}).message || []).map((part) => part.text);
      const target = (name) => items.find((item) => item && item.name === name);

      return {
        componentCount: items.length,
        dialogStatuses: dialogList.map((dialog) => `${dialog.name}:${dialog.status || dialog.state}`),
        greeting: messages
          .filter((item) => item && item._id === messageId)
          .flatMap((item) => item.messages || [])
          .flatMap((part) => part.locale || [])
          .filter((locale) => locale.language === 'en')
          .map((locale) => locale.message),
        keyTexts: {
          Message0001: textOf(target('Message0001')),
          Message0002: textOf(target('Message0002')),
          loginLookupNotice: textOf(target('loginLookupNotice')),
          SubmitRegistration: textOf(target('SubmitRegistration')),
        },
      };
    },
    STREAM,
    USER,
    FLOW,
    MESSAGE,
  );

  const decoded = {
    ...result,
    keyTexts: Object.fromEntries(
      Object.entries(result.keyTexts).map(([key, values]) => [key, values.map(decode)]),
    ),
  };

  mkdirSync('output/kore', { recursive: true });
  writeFileSync('output/kore/final-state.json', JSON.stringify(decoded, null, 2));

  return JSON.stringify(decoded, null, 1);
}