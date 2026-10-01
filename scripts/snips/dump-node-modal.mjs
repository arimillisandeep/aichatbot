/** Dump the node config modal's own editable controls. */
import { installAuthObserver } from '../kore-api.mjs';
import { openFlow, openNode, wait } from '../kore-ui-edit.mjs';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);
  await openFlow(page, h, 'Welcome Chat Flow');
  await h.wait(3000);
  await openNode(page, 'MessagePrompt0003');
  await h.wait(4000);

  const modal = await page.evaluate(() => {
    const candidates = [
      ...document.querySelectorAll('[role="dialog"]'),
      ...document.querySelectorAll('[class*="modal"], [class*="Modal"], [class*="drawer"], [class*="Drawer"]'),
    ].filter((node) => node.offsetParent !== null);

    if (!candidates.length) return { found: false };

    // Use the largest visible candidate as the panel root.
    const root = candidates
      .map((node) => ({ node, rect: node.getBoundingClientRect() }))
      .sort((left, right) => right.rect.width * right.rect.height - left.rect.width * left.rect.height)[0].node;

    const controls = [...root.querySelectorAll('textarea, input, [contenteditable], [contenteditable="true"]')]
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          tag: node.tagName.toLowerCase(),
          type: node.getAttribute('type') || '',
          contenteditable: node.getAttribute('contenteditable') || '',
          cls: String(node.className).slice(0, 50),
          value: String(node.value !== undefined && node.value !== null ? node.value : node.textContent || '').slice(0, 60),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          x: Math.round(rect.x + rect.width / 2),
          y: Math.round(rect.y + rect.height / 2),
        };
      });

    return {
      found: true,
      rootTag: root.tagName.toLowerCase(),
      rootCls: String(root.className).slice(0, 80),
      rootText: (root.innerText || '').slice(0, 400),
      controls,
    };
  });

  return JSON.stringify(modal, null, 1).slice(0, 4500);
}