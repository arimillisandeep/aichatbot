/** Check node canvas positions against the viewport for off-screen nodes. */
import { installAuthObserver } from '../kore-api.mjs';
import { openFlow, wait } from '../kore-ui-edit.mjs';

const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';
const USER = 'u-7294aa15-9290-55a1-8b27-c45802448cde';
const FLOW = 'cf-7fe548da-c56b-59ed-b437-f00bf638d74f';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);
  await openFlow(page, h, 'Welcome Chat Flow');
  await h.wait(4000);

  return JSON.stringify(
    await page.evaluate(
      async (u, s, f) => {
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

        const positions = (flow.steps || [])
          .filter((step) => step && step.type === 'messageprompt')
          .map((step) => ({
            node: step.name,
            left: step.metadata && step.metadata.position ? step.metadata.position.left : null,
            top: step.metadata && step.metadata.position ? step.metadata.position.top : null,
          }));

        // On-screen geometry for each node label.
        const onScreen = ['MessagePrompt0001', 'MessagePrompt0002', 'MessagePrompt0003'].map((label) => {
          const el = [...document.querySelectorAll('*')].find(
            (node) => !node.children.length && (node.innerText || '').trim() === label,
          );
          if (!el) return { label, found: false };
          const rect = el.getBoundingClientRect();
          return {
            label,
            found: true,
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
            inViewport: rect.x >= 0 && rect.y >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
          };
        });

        return {
          viewport: { width: innerWidth, height: innerHeight },
          positions,
          onScreen,
          scroll: { x: scrollX, y: scrollY },
        };
      },
      USER,
      STREAM,
      FLOW,
    ),
    null,
    1,
  );
}