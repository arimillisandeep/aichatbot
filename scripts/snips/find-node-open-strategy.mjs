/**
 * Find the interaction that opens a flow node's message config.
 *
 * Tries several strategies and reports which one exposes an editable control
 * holding the node's current text.
 */
import { installAuthObserver } from '../kore-api.mjs';
import { openFlow, wait } from '../kore-ui-edit.mjs';

const NODE = 'MessagePrompt0003';
const CURRENT = 'Thank you!';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);
  await openFlow(page, h, 'Welcome Chat Flow');
  await h.wait(3000);

  // Geometry of the node card and its message div.
  const geo = await page.evaluate(
    (node, current) => {
      const label = [...document.querySelectorAll('*')].find(
        (element) => !element.children.length && (element.innerText || '').trim() === node,
      );
      const message = [...document.querySelectorAll('div.message-input')].find(
        (element) => (element.innerText || '').trim() === current,
      );
      const box = (element) => {
        if (!element) return null;
        let card = element;
        for (let up = 0; up < 8 && card; up += 1) {
          card = card.parentElement;
          if (!card) break;
          const rect = card.getBoundingClientRect();
          if (rect.width > 120 && rect.height > 60) break;
        }
        const rect = (card || element).getBoundingClientRect();
        return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      };
      return { card: box(label), message: box(message) };
    },
    NODE,
    CURRENT,
  );

  const probe = () =>
    page.evaluate((current) => {
      const visible = (node) => node.offsetParent !== null;
      const hit = [...document.querySelectorAll('textarea, input, [contenteditable]')]
        .filter((node) => visible(node))
        .map((node) => ({
          tag: node.tagName.toLowerCase(),
          cls: String(node.className).slice(0, 40),
          value: String(node.value !== undefined && node.value !== null ? node.value : node.textContent || ''),
          rect: node.getBoundingClientRect(),
        }))
        .find((item) => item.value.trim() === current && item.rect.width > 30);
      if (!hit) return null;
      return {
        tag: hit.tag,
        cls: hit.cls,
        x: Math.round(hit.rect.x + hit.rect.width / 2),
        y: Math.round(hit.rect.y + hit.rect.height / 2),
      };
    }, CURRENT);

  const results = [];
  const strategies = [
    ['card single', geo.card, 1],
    ['card double', geo.card, 2],
    ['message single', geo.message, 1],
    ['message double', geo.message, 2],
  ];

  for (const [label, box, clicks] of strategies) {
    if (!box) {
      results.push({ label, status: 'no-box' });
      // eslint-disable-next-line no-continue
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    await page.mouse.click(box.x, box.y, { clickCount: clicks, delay: 90 });
    // eslint-disable-next-line no-await-in-loop
    await wait(3000);
    // eslint-disable-next-line no-await-in-loop
    const field = await probe();
    results.push({ label, box, exposedField: field });
    if (field) break;
  }

  return JSON.stringify({ geo, results }, null, 1);
}