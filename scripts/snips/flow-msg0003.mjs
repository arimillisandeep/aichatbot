/** Set the remaining Welcome Chat Flow message and verify both. */
import { installAuthObserver } from '../kore-api.mjs';
import { openFlow, openNode, setFieldText, readFlowMessages, wait } from '../kore-ui-edit.mjs';

const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';
const USER = 'u-7294aa15-9290-55a1-8b27-c45802448cde';
const FLOW = 'cf-7fe548da-c56b-59ed-b437-f00bf638d74f';
const NO_PROBLEM = 'No problem! Have a great day.';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);

  await openFlow(page, h, 'Welcome Chat Flow');
  await h.wait(4000);

  const diagnostics = await page.evaluate(() => ({
    url: location.href,
    bagCount: ((window.__koreBags || []).length),
    bagKeys: (window.__koreBags || []).map((entry) => Object.keys(entry.headers).join('+')),
  }));

  let before = null;
  for (let attempt = 0; attempt < 5 && !before; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    before = await readFlowMessages(page, { userId: USER, streamId: STREAM, flowId: FLOW });
    if (!before) await h.wait(3000);
  }

  if (!before) return JSON.stringify({ stage: 'read-failed', diagnostics }, null, 1);

  // Canvas nodes are labelled MessagePrompt000N; the message objects have
  // human names, so the node label is what has to be clicked.
  const nodeLabel = 'MessagePrompt0003';
  const target = (before || []).find((item) => /thank you/i.test(item.text));
  if (!target) return JSON.stringify({ stage: 'message-not-found', diagnostics, before }, null, 1);

  const opened = await openNode(page, nodeLabel);
  if (!opened) return JSON.stringify({ stage: 'node-not-found', diagnostics, nodeLabel, target }, null, 1);

  const result = await setFieldText(page, NO_PROBLEM, { match: target.text });

  const after = await readFlowMessages(page, { userId: USER, streamId: STREAM, flowId: FLOW });
  await wait(1500);
  const settled = await readFlowMessages(page, { userId: USER, streamId: STREAM, flowId: FLOW });

  return JSON.stringify(
    {
      target: target.name,
      result,
      after: (after || []).map((item) => ({ name: item.name, text: item.text })),
      settled: (settled || []).map((item) => ({ name: item.name, text: item.text })),
      applied: (settled || []).some((item) => item.text === NO_PROBLEM),
    },
    null,
    1,
  );
}