/** Map flow nodes to their message objects and inspect the config panel. */
import { installAuthObserver } from '../kore-api.mjs';
import { openFlow, openNode, readFlowMessages, wait } from '../kore-ui-edit.mjs';

const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';
const USER = 'u-7294aa15-9290-55a1-8b27-c45802448cde';
const FLOW = 'cf-7fe548da-c56b-59ed-b437-f00bf638d74f';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);
  await openFlow(page, h, 'Welcome Chat Flow');
  await h.wait(3000);

  // Node -> message id mapping, read from the flow document.
  const mapping = await page.evaluate(
    async (u, s, f) => {
      const bags = (window.__koreBags || []).map((entry) => entry.headers);
      for (const headers of bags) {
        // eslint-disable-next-line no-await-in-loop
        const response = await fetch(
          `https://platform.kore.ai/api/1.1/users/${u}/streams/${s}/callflows/${f}`,
          { headers, credentials: 'include' },
        );
        if (response.status !== 200) continue;
        const flow = await response.json();
        return (flow.steps || [])
          .filter((step) => step && step.type === 'messageprompt')
          .map((step) => ({
            node: step.name,
            messageId: (step.taskDefinition || {}).messageToUser || null,
          }));
      }
      return null;
    },
    USER,
    STREAM,
    FLOW,
  );

  const messages = await readFlowMessages(page, { userId: USER, streamId: STREAM, flowId: FLOW });
  const byId = Object.fromEntries((messages || []).map((item) => [item._id, item.text]));
  const resolved = (mapping || []).map((entry) => ({ node: entry.node, text: byId[entry.messageId] || null }));

  // Open one node and record exactly what the panel shows.
  const opened = await openNode(page, 'MessagePrompt0003');
  await wait(2500);

  const panel = await page.evaluate(() => {
    const visible = (node) => node.offsetParent !== null;
    const fields = [...document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]')]
      .filter((node) => visible(node) && node.getBoundingClientRect().width > 30)
      .map((node, index) => {
        const rect = node.getBoundingClientRect();
        return {
          index,
          tag: node.tagName.toLowerCase(),
          value: node.value || node.textContent || '',
          x: Math.round(rect.x + rect.width / 2),
          y: Math.round(rect.y + rect.height / 2),
        };
      });
    const buttons = [...document.querySelectorAll('button, [role="button"]')]
      .filter((node) => visible(node) && (node.innerText || '').trim())
      .map((node) => (node.innerText || '').trim().slice(0, 24));
    return { fields, buttons: [...new Set(buttons)].slice(0, 30) };
  });

  return JSON.stringify({ resolved, opened, panel }, null, 1);
}