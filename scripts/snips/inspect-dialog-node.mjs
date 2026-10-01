/** Inspect the User Login message node's config panel in detail. */
import { installAuthObserver } from '../kore-api.mjs';
import { openDialogTask } from '../kore-ui-dialog.mjs';
import { ensureWideViewport } from '../kore-ui-edit.mjs';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);
  await openDialogTask(page, h, 'User Login');
  await h.wait(3000);
  await ensureWideViewport(page);

  const geo = await page.evaluate(() => {
    const el = [...document.querySelectorAll('*')].find(
      (node) => !node.children.length && (node.innerText || '').trim() === 'Message0002',
    );
    if (!el) return null;
    let card = el;
    for (let up = 0; up < 8 && card; up += 1) {
      card = card.parentElement;
      if (!card) break;
      const rect = card.getBoundingClientRect();
      if (rect.width > 120 && rect.height > 60) break;
    }
    const rect = (card || el).getBoundingClientRect();
    return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
  });

  if (!geo) return JSON.stringify({ stage: 'node-label-not-found' }, null, 1);

  await page.mouse.click(geo.x, geo.y, { clickCount: 2, delay: 90 });
  await h.wait(5000);

  const panel = await page.evaluate(() => {
    const visible = (node) => node.offsetParent !== null;
    const controls = [...document.querySelectorAll('textarea, input, [contenteditable], select, button')]
      .filter((node) => visible(node) && node.getBoundingClientRect().width > 25)
      .map((node) => {
        const rect = node.getBoundingClientRect();
        const value =
          node.value !== undefined && node.value !== null && node.value !== ''
            ? node.value
            : node.innerText || node.textContent || '';
        return {
          tag: node.tagName.toLowerCase(),
          cls: String(node.className).slice(0, 45),
          value: String(value).trim().slice(0, 55),
          x: Math.round(rect.x + rect.width / 2),
          y: Math.round(rect.y + rect.height / 2),
        };
      })
      .filter((item) => item.value);
    return {
      controlCount: controls.length,
      controls: controls.slice(0, 40),
      hasModal: !!document.querySelector('.modal-dialog, [role="dialog"]'),
    };
  });

  return JSON.stringify({ geo, panel }, null, 1).slice(0, 4500);
}