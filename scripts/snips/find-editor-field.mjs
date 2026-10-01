/** Locate the editable element that holds a flow node's message text. */
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

  const found = await page.evaluate(() => {
    const visible = (node) => node.offsetParent !== null;
    const results = [];

    // Any element whose text is exactly the current message.
    for (const node of document.querySelectorAll('*')) {
      if (node.children.length) continue;
      const text = (node.innerText || node.textContent || '').trim();
      if (text !== 'Thank you!') continue;
      const rect = node.getBoundingClientRect();
      results.push({
        how: 'exact-text',
        tag: node.tagName.toLowerCase(),
        cls: String(node.className).slice(0, 70),
        editable: node.isContentEditable === true,
        role: node.getAttribute('role'),
        visible: visible(node),
        x: Math.round(rect.x + rect.width / 2),
        y: Math.round(rect.y + rect.height / 2),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
      });
    }

    // Contenteditable widgets anywhere on screen.
    const editables = [...document.querySelectorAll('[contenteditable]')]
      .filter((node) => visible(node))
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          how: 'contenteditable',
          tag: node.tagName.toLowerCase(),
          cls: String(node.className).slice(0, 70),
          attr: node.getAttribute('contenteditable'),
          text: (node.innerText || '').trim().slice(0, 40),
          x: Math.round(rect.x + rect.width / 2),
          y: Math.round(rect.y + rect.height / 2),
        };
      });

    return { results, editables };
  });

  const screen = await h.dump(2500);
  return JSON.stringify({ found, screenTail: screen.slice(-1200) }, null, 1);
}