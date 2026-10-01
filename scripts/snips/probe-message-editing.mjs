/** Determine how the message div becomes editable. */
import { installAuthObserver } from '../kore-api.mjs';
import { openFlow, openNode, wait } from '../kore-ui-edit.mjs';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);
  await openFlow(page, h, 'Welcome Chat Flow');
  await h.wait(3000);
  await openNode(page, 'MessagePrompt0003');
  await h.wait(3000);

  const box = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('div.message-input')].filter(
      (node) => node.offsetParent !== null,
    );
    const target = nodes.find((node) => (node.innerText || '').trim() === 'Thank you!');
    if (!target) return null;
    const rect = target.getBoundingClientRect();
    return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
  });
  if (!box) return JSON.stringify({ stage: 'no-box' }, null, 1);

  const snapshot = () =>
    page.evaluate(() => {
      const visible = (node) => node.offsetParent !== null;
      const fields = [...document.querySelectorAll('textarea, input, [contenteditable]')]
        .filter((node) => visible(node) && node.getBoundingClientRect().width > 30)
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return {
            tag: node.tagName.toLowerCase(),
            type: node.getAttribute('type') || '',
            editable: node.getAttribute('contenteditable') || '',
            value: String(node.value !== undefined && node.value !== null ? node.value : node.textContent || '').slice(0, 45),
            x: Math.round(rect.x + rect.width / 2),
            y: Math.round(rect.y + rect.height / 2),
          };
        });
      return { fields, focused: document.activeElement ? document.activeElement.className : null };
    });

  const out = { box };
  out.initial = await snapshot();

  await page.mouse.click(box.x, box.y);
  await wait(2500);
  out.afterSingleClick = await snapshot();

  await page.mouse.click(box.x, box.y, { clickCount: 2, delay: 100 });
  await wait(2500);
  out.afterDoubleClick = await snapshot();

  return JSON.stringify(out, null, 1);
}