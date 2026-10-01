/** Click into a flow node's message editor and report what appears. */
import { installAuthObserver } from '../kore-api.mjs';
import { openFlow, openNode, wait } from '../kore-ui-edit.mjs';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);
  await openFlow(page, h, 'Welcome Chat Flow');
  await h.wait(3000);
  await openNode(page, 'MessagePrompt0003');
  await wait(3000);

  const at = await page.evaluate(() => {
    const node = document.querySelector('div.message-input');
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
  });
  if (!at) return JSON.stringify({ stage: 'no-message-input' }, null, 1);

  // Real click into the editor.
  await page.mouse.click(at.x, at.y);
  await wait(2500);

  const afterClick = await page.evaluate(() => {
    const visible = (node) => node.offsetParent !== null;
    return {
      textareas: [...document.querySelectorAll('textarea')]
        .filter(visible)
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return { value: node.value, x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }),
      editables: [...document.querySelectorAll('[contenteditable]')]
        .filter(visible)
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return {
            attr: node.getAttribute('contenteditable'),
            text: (node.innerText || '').slice(0, 40),
            x: Math.round(rect.x + rect.width / 2),
            y: Math.round(rect.y + rect.height / 2),
          };
        }),
      focused: document.activeElement ? document.activeElement.className : null,
    };
  });

  return JSON.stringify({ at, afterClick }, null, 1);
}