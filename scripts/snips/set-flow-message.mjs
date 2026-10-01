/**
 * Robustly set a chat flow node's message text and verify through the API.
 *
 * The canvas is intermittent, so every step is retried: open the node, wait for
 * div.message-input, click it, wait for the editor to appear, replace the text,
 * blur to commit, then confirm by re-reading. Nothing is reported as done
 * unless the read API shows the new text.
 */
import { installAuthObserver } from '../kore-api.mjs';
import { openFlow, openNode, readFlowMessages, wait } from '../kore-ui-edit.mjs';

const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';
const USER = 'u-7294aa15-9290-55a1-8b27-c45802448cde';
const FLOW = 'cf-7fe548da-c56b-59ed-b437-f00bf638d74f';

/** Which message object a node currently sends, and its text. */
async function nodeMessage(page, nodeLabel) {
  return page.evaluate(
    async (u, s, f, label) => {
      const bags = (window.__koreBags || []).map((entry) => entry.headers);
      let flow = null;
      for (const headers of bags) {
        // eslint-disable-next-line no-await-in-loop
        const response = await fetch(
          `https://platform.kore.ai/api/1.1/users/${u}/streams/${s}/callflows/${f}`,
          { headers, credentials: 'include' },
        );
        if (response.status === 200) {
          flow = await response.json();
          break;
        }
      }
      const step = ((flow || {}).steps || []).find((item) => item && item.name === label);
      const messageId = step && step.taskDefinition && step.taskDefinition.messageToUser;
      if (!messageId) return null;

      for (const headers of bags) {
        // eslint-disable-next-line no-await-in-loop
        const response = await fetch(
          `https://platform.kore.ai/api/1.1/users/${u}/streams/${s}/callflows/${f}/messages`,
          { headers, credentials: 'include' },
        );
        if (response.status !== 200) continue;
        const items = await response.json();
        const found = (Array.isArray(items) ? items : []).find((item) => item && item._id === messageId);
        if (!found) continue;
        return {
          node: label,
          messageId,
          text: ((found.messages || [])
            .flatMap((part) => part.locale || [])
            .filter((locale) => locale.language === 'en')
            .map((locale) => locale.message) || []).join(''),
        };
      }
      return null;
    },
    USER,
    STREAM,
    FLOW,
    nodeLabel,
  );
}

/**
 * Box of the node's inline message editor, matched on its current text.
 *
 * Every message node on the canvas renders a div.message-input, so the box has
 * to be chosen by content or the wrong node is edited.
 */
async function messageInputBox(page, currentText) {
  return page.evaluate((text) => {
    const nodes = [...document.querySelectorAll('div.message-input')].filter(
      (node) => node.offsetParent !== null,
    );
    if (!nodes.length) return null;
    const wanted = (text || '').trim();
    const match = wanted
      ? nodes.find((node) => (node.innerText || node.textContent || '').trim() === wanted) ||
        nodes.find((node) => (node.innerText || '').includes(wanted))
      : null;
    const target = match || nodes[0];
    const rect = target.getBoundingClientRect();
    return {
      x: Math.round(rect.x + rect.width / 2),
      y: Math.round(rect.y + rect.height / 2),
      count: nodes.length,
      matched: !!match,
      text: (target.innerText || '').trim().slice(0, 50),
    };
  }, currentText);
}

/** Type into whichever editor the panel revealed. */
async function typeIntoEditor(page, text) {
  const editor = await page.evaluate(() => {
    const visible = (node) => node.offsetParent !== null;
    const area = [...document.querySelectorAll('textarea')].filter(
      (node) => visible(node) && node.getBoundingClientRect().width > 40,
    );
    const editable = [...document.querySelectorAll('[contenteditable="true"]')].filter(visible);
    const target = area[0] || editable[0];
    if (!target) return null;
    const rect = target.getBoundingClientRect();
    return {
      tag: target.tagName.toLowerCase(),
      x: Math.round(rect.x + rect.width / 2),
      y: Math.round(rect.y + rect.height / 2),
      value: target.value || target.textContent || '',
    };
  });
  if (!editor) return null;

  await page.mouse.click(editor.x, editor.y);
  await wait(500);
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await wait(250);
  await page.keyboard.type(text);
  await wait(1500);
  return editor;
}

/**
 * Set a node's message, retrying the whole open-edit-commit cycle.
 */
export async function setFlowMessage(page, nodeLabel, text, { attempts = 5 } = {}) {
  const log = [];

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const before = await nodeMessage(page, nodeLabel);
    if (!before) {
      log.push({ attempt, step: 'node-missing' });
      // eslint-disable-next-line no-await-in-loop
      await openNode(page, nodeLabel);
      // eslint-disable-next-line no-await-in-loop
      await wait(2500);
      // eslint-disable-next-line no-await-in-loop
      continue;
    }

    if (before.text === text) return { ok: true, alreadyCorrect: true, node: nodeLabel, log };

    // eslint-disable-next-line no-await-in-loop
    await openNode(page, nodeLabel);
    // eslint-disable-next-line no-await-in-loop
    await wait(3000);

    // eslint-disable-next-line no-await-in-loop
    const inputBox = await messageInputBox(page, before.text);
    if (!inputBox) {
      log.push({ attempt, step: 'panel-not-open', before: before.text });
      // eslint-disable-next-line no-await-in-loop
      continue;
    }
    if (!inputBox.matched) {
      log.push({ attempt, step: 'no-matching-input', before: before.text, saw: inputBox.text });
      // eslint-disable-next-line no-await-in-loop
      continue;
    }

    // Click the inline message to reveal its editor.
    await page.mouse.click(inputBox.x, inputBox.y);
    // eslint-disable-next-line no-await-in-loop
    await wait(2500);

    // eslint-disable-next-line no-await-in-loop
    const editor = await typeIntoEditor(page, text);
    if (!editor) {
      log.push({ attempt, step: 'no-editor', inputBox });
      // eslint-disable-next-line no-await-in-loop
      continue;
    }

    // Commit on blur, then confirm from the service.
    await page.mouse.click(15, 640);
    // eslint-disable-next-line no-await-in-loop
    await wait(3500);
    // eslint-disable-next-line no-await-in-loop
    const after = await nodeMessage(page, nodeLabel);
    log.push({ attempt, step: 'typed', editor: editor.value, after: after && after.text });

    if (after && after.text === text) return { ok: true, node: nodeLabel, log, text };
  }

  return { ok: false, node: nodeLabel, log };
}

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);
  await openFlow(page, h, 'Welcome Chat Flow');
  await h.wait(3000);

  const results = [];
  for (const [label, text] of [
    ['MessagePrompt0003', 'No problem! Have a great day.'],
  ]) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await setFlowMessage(page, label, text));
    // eslint-disable-next-line no-await-in-loop
    await h.wait(2000);
  }

  const final = await readFlowMessages(page, { userId: USER, streamId: STREAM, flowId: FLOW });
  return JSON.stringify(
    { results, final: (final || []).map((item) => ({ name: item.name, text: item.text })) },
    null,
    1,
  );
}