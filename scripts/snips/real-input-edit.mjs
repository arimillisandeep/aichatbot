/**
 * Edit the welcome greeting with real, trusted input events.
 *
 * Earlier attempts used element.click() inside the page, which produces
 * untrusted events that Angular's listeners ignore. Puppeteer's mouse and
 * keyboard go through the CDP Input domain and are trusted, so the editor
 * should actually open and commit.
 *
 * Verified afterwards through the read API, not by trusting the UI.
 */
import { installAuthObserver } from '../kore-api.mjs';

const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';
const USER = 'u-7294aa15-9290-55a1-8b27-c45802448cde';
const FLOW = 'cf-7fe548da-c56b-59ed-b437-f00bf638d74f';
const MESSAGE = 'cfm-64266c64-7be8-5ff0-ad52-dc5122bb6856';
const DESIRED = 'Hello! Welcome to our Virtual Assistant.';

const readGreeting = async (page) =>
  page.evaluate(
    async (streamId, userId, flowId, messageId) => {
      const bags = (window.__koreBags || []).map((entry) => entry.headers);
      for (const headers of bags) {
        // eslint-disable-next-line no-await-in-loop
        const response = await fetch(
          `https://platform.kore.ai/api/1.1/users/${userId}/streams/${streamId}/callflows/${flowId}/messages`,
          { headers, credentials: 'include' },
        );
        if (response.status !== 200) continue;
        const items = await response.json();
        const found = (Array.isArray(items) ? items : []).find((item) => item && item._id === messageId);
        return (found ? found.messages || [] : [])
          .flatMap((part) => part.locale || [])
          .filter((locale) => locale.language === 'en')
          .map((locale) => locale.message);
      }
      return null;
    },
    STREAM,
    USER,
    FLOW,
    MESSAGE,
  );

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);
  await h.clickText('Flows & Channels');
  await h.wait(6000);
  await page.evaluate(() => {
    const leaf = [...document.querySelectorAll('*')].find((node) => {
      if (node.children.length) return false;
      return (node.innerText || '').trim() === 'Welcome Chat Flow';
    });
    if (leaf) (leaf.closest('a') || leaf.closest('tr') || leaf.parentElement || leaf).click();
  });
  await h.wait(12000);

  const before = await readGreeting(page);

  // Locate the node on the canvas and double-click it with real input.
  const box = await page.evaluate(() => {
    const label = [...document.querySelectorAll('*')].find(
      (node) => !node.children.length && (node.innerText || '').trim() === 'MessagePrompt0002',
    );
    if (!label) return null;
    // Climb to the node card so the click lands on the widget, not the label.
    let card = label;
    for (let up = 0; up < 8 && card; up += 1) {
      card = card.parentElement;
      if (!card) break;
      const rect = card.getBoundingClientRect();
      if (rect.width > 90 && rect.height > 50) break;
    }
    const rect = (card || label).getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, w: rect.width, h: rect.height };
  });

  if (!box) return JSON.stringify({ stage: 'node-not-found', before }, null, 1);

  await page.mouse.click(box.x, box.y, { clickCount: 2, delay: 80 });
  await h.wait(4000);

  // The config panel should now be open: find a visible text control.
  const target = await page.evaluate(() => {
    const visible = (node) => node.offsetParent !== null;
    const areas = [...document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]')].filter(
      (node) => visible(node) && node.getBoundingClientRect().width > 40,
    );
    if (!areas.length) return null;
    // Prefer one that already holds the current greeting.
    const match = areas.find((node) => /welcome/i.test(node.value || node.textContent || '')) || areas[0];
    const rect = match.getBoundingClientRect();
    return {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
      value: match.value || match.textContent || '',
      count: areas.length,
    };
  });

  if (!target) {
    const screen = await h.dump(2000);
    return JSON.stringify({ stage: 'no-editor-panel', before, box, screen: screen.slice(0, 1200) }, null, 1);
  }

  // Select all existing text, then type the replacement.
  await page.mouse.click(target.x, target.y);
  await h.wait(600);
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await h.wait(300);
  await page.keyboard.type(DESIRED);
  await h.wait(1500);

  const typed = await page.evaluate(() => {
    const visible = (node) => node.offsetParent !== null;
    const areas = [...document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]')].filter(
      (node) => visible(node) && node.getBoundingClientRect().width > 40,
    );
    return areas.map((node) => node.value || node.textContent);
  });

  // Commit with a real click on the panel's own Save control.
  const saveBox = await page.evaluate(() => {
    const visible = (node) => node.offsetParent !== null;
    const buttons = [...document.querySelectorAll('button, [role="button"], a')].filter((node) => {
      if (!visible(node)) return false;
      const text = (node.innerText || '').trim().toLowerCase();
      return /^(save|update|apply|done)$/.test(text);
    });
    if (!buttons.length) return null;
    // Prefer a Save inside the config panel rather than a page-level one.
    const inPanel =
      buttons.find((node) => /config|panel|side|drawer|property/i.test(node.closest('[class]')?.className || '')) ||
      buttons[buttons.length - 1];
    const rect = inPanel.getBoundingClientRect();
    return {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
      label: inPanel.innerText.trim(),
      candidates: buttons.map((node) => node.innerText.trim()),
    };
  });

  // Enumerate what commit controls exist, then try blur-driven auto-save.
  const controls = await page.evaluate(() => {
    const visible = (node) => node.offsetParent !== null;
    const buttons = [...document.querySelectorAll('button, [role="button"], a, [class*="btn"]')]
      .filter((node) => visible(node) && (node.innerText || '').trim())
      .map((node) => (node.innerText || '').trim().slice(0, 30));
    return [...new Set(buttons)].slice(0, 40);
  });

  // Blur the field: click empty canvas, then also try Tab and Escape.
  await page.mouse.click(20, Math.round(600));
  await h.wait(2500);
  const afterBlur = await readGreeting(page);

  await page.keyboard.press('Tab');
  await h.wait(2000);
  const afterTab = await readGreeting(page);

  const applied = [afterBlur, afterTab].some((values) => (values || []).includes(DESIRED));
  if (!applied) {
    // Reopen and look for an explicit commit control near the panel.
    await page.mouse.click(box.x, box.y, { clickCount: 2, delay: 80 });
    await h.wait(3000);
  }

  return JSON.stringify({ stage: 'blur-save', before, controls, afterBlur, afterTab, applied }, null, 1);
}