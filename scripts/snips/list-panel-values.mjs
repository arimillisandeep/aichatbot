/** List every visible control with a non-empty value, after opening a node. */
import { installAuthObserver } from '../kore-api.mjs';
import { openFlow, openNode, wait } from '../kore-ui-edit.mjs';

const NODE = 'MessagePrompt0003';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);
  await openFlow(page, h, 'Welcome Chat Flow');
  await h.wait(3000);
  await openNode(page, NODE);
  await h.wait(4000);

  const controls = await page.evaluate(() => {
    const visible = (node) => node.offsetParent !== null;
    return [...document.querySelectorAll('textarea, input, [contenteditable], select')]
      .filter((node) => visible(node))
      .map((node) => {
        const rect = node.getBoundingClientRect();
        const value =
          node.value !== undefined && node.value !== null && node.value !== ''
            ? node.value
            : node.isContentEditable
              ? node.textContent || ''
              : '';
        return {
          tag: node.tagName.toLowerCase(),
          type: node.getAttribute('type') || '',
          cls: String(node.className).slice(0, 45),
          value: String(value).slice(0, 70),
          x: Math.round(rect.x + rect.width / 2),
          y: Math.round(rect.y + rect.height / 2),
          w: Math.round(rect.width),
        };
      })
      .filter((item) => item.value.trim() && item.w > 30);
  });

  return JSON.stringify({ count: controls.length, controls }, null, 1).slice(0, 4000);
}