/** Read the Welcome Chat Flow model and snapshot it. */
import { installAuthObserver } from '../kore-api.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const USER = 'u-7294aa15-9290-55a1-8b27-c45802448cde';
const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';
const FLOW = 'cf-7fe548da-c56b-59ed-b437-f00bf638d74f';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);

  // The Flows API uses a different auth header set than the Dialog builder, so
  // visit the Flows screen first to make the builder issue one of those.
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

  const data = await page.evaluate(
    async (userId, streamId, flowId) => {
      const bags = ((window.__koreBags || []).map((entry) => entry.headers));
      const base = `https://platform.kore.ai/api/1.1/users/${userId}/streams/${streamId}/callflows/${flowId}`;

      const read = async (path) => {
        let last = null;
        for (const headers of bags) {
          // eslint-disable-next-line no-await-in-loop
          const response = await fetch(base + path, { headers, credentials: 'include' });
          last = { status: response.status, body: await response.json() };
          if (response.status !== 401 && response.status !== 403) return last;
        }
        return last || { status: 0, body: null };
      };

      return { bagCount: bags.length, flow: await read(''), messages: await read('/messages') };
    },
    USER,
    STREAM,
    FLOW,
  );

  mkdirSync('output/kore', { recursive: true });
  writeFileSync('output/kore/welcome-chat-flow.json', JSON.stringify(data.flow.body, null, 2));
  writeFileSync('output/kore/welcome-chat-flow.messages.json', JSON.stringify(data.messages.body, null, 2));

  return JSON.stringify(
    {
      bagCount: data.bagCount,
      status: data.flow.status,
      topKeys: Object.keys(data.flow.body || {}).slice(0, 30),
      name: (data.flow.body || {}).name,
      body: data.flow.body,
      messagesStatus: data.messages.status,
    },
    null,
    1,
  );
}