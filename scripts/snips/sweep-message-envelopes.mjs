/**
 * Sweep candidate write envelopes for the chat-flow message endpoint.
 *
 * The route exists (it answers 412, not 404), so the problem is payload shape.
 * Each attempt carries the desired text, so a success is the change we want.
 * The result is re-read after every accepted write.
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
              detail: (parsed && parsed.errors && (parsed.errors[0] || {}).msg) || (parsed && parsed.message) || null,
            };
            if (response.status !== 401 && response.status !== 403) return last;
          }
          return last || { status: 0 };
        };

        const readText = async () => {
          const list = await send('GET', '/messages', undefined);
          const items = Array.isArray(list.body) ? list.body : [];
          const now = items.find((item) => item && item._id === messageId);
          return ((now || {}).messages || [])
            .flatMap((part) => part.locale || [])
            .filter((locale) => locale.language === 'en')
            .map((locale) => locale.message);
        };

        const list = await send('GET', '/messages', undefined);
        const original = (Array.isArray(list.body) ? list.body : []).find((item) => item && item._id === messageId);
        if (!original) return { stage: 'read-failed', status: list.status };

        const base = JSON.parse(JSON.stringify(original));
        for (const part of base.messages) {
          for (const locale of part.locale || []) {
            if (locale.language === 'en') locale.message = desired;
          }
        }
        const omit = (keys) => {
          const copy = JSON.parse(JSON.stringify(base));
          keys.forEach((key) => delete copy[key]);
          return copy;
        };

        const envelopes = [
          ['full object', 'POST', '/messages', base],
          ['no __v', 'POST', '/messages', omit(['__v'])],
          ['no __v/lMod/state', 'POST', '/messages', omit(['__v', 'lMod', 'state'])],
          ['array', 'POST', '/messages', [base]],
          ['wrapped messageData', 'POST', '/messages', { messageData: base }],
          ['wrapped data', 'POST', '/messages', { data: base }],
          ['minimal', 'POST', '/messages', { _id: base._id, cfId: base.cfId, name: base.name, lname: base.lname, refId: base.refId, messages: base.messages }],
          ['with state', 'POST', '/messages', { ...omit(['__v']), state: 'configured' }],
          ['full object PUT', 'PUT', '/messages', base],
          ['PUT by id', 'PUT', `/messages/${messageId}`, base],
          ['POST by id', 'POST', `/messages/${messageId}`, base],
          ['PATCH by id', 'PATCH', `/messages/${messageId}`, { messages: base.messages }],
          ['POST ?isUpdate', 'POST', '/messages?isUpdate=true', base],
        ];

        const log = [];
        for (const [label, method, path, payload] of envelopes) {
          if (payload === undefined) continue;
          // eslint-disable-next-line no-await-in-loop
          const result = await send(method, path, payload);
          log.push({ label, method, path, status: result.status, detail: result.detail });
          if (result.status >= 200 && result.status < 300) {
            log.push({ label: 'VERIFIED', text: await readText() });
            break;
          }
        }

        return { attempts: log, finalText: await readText() };
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