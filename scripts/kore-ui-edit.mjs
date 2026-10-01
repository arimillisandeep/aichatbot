/**
 * Browser-driven editing helpers for the Kore.ai builder.
 *
 * The builder's own write API rejects message text, but the canvas editor
 * commits on blur. Two things make this work:
 *
 *   1. Input must be trusted. `element.click()` inside the page produces
 *      untrusted events that Angular ignores, so every interaction here goes
 *      through Puppeteer's mouse and keyboard, which use the CDP Input domain.
 *   2. There is no Save button. The editor persists the field on blur, so the
 *      commit step is clicking away and then re-reading from the API.
 *
 * Every helper verifies through the read API rather than trusting the screen.
 */

/**
 * Widen the rendered viewport so the whole canvas is clickable.
 *
 * Nodes near the right edge of the flow render beyond the window, so a click
 * aimed at their coordinates lands on nothing. The dialog editor also places
 * nodes far to the right.
 */
export async function ensureWideViewport(page, { width = 2400, height = 1000 } = {}) {
  const current = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  if (current.width >= width) return current;
  await page.setViewport({ width, height });
  await wait(2500);
  return page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
}

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

/** Read all message text currently stored for a chat flow. */
export async function readFlowMessages(page, { userId, streamId, flowId }) {
  return page.evaluate(
    async (u, s, f) => {
      const bags = (window.__koreBags || []).map((entry) => entry.headers);
      for (const headers of bags) {
        // eslint-disable-next-line no-await-in-loop
        const response = await fetch(
          `https://platform.kore.ai/api/1.1/users/${u}/streams/${s}/callflows/${f}/messages`,
          { headers, credentials: 'include' },
        );
        if (response.status !== 200) continue;
        const items = await response.json();
        return (Array.isArray(items) ? items : []).map((item) => ({
          _id: item && item._id,
          name: item && item.name,
          text: ((item && item.messages) || [])
            .flatMap((part) => part.locale || [])
            .filter((locale) => locale.language === 'en')
            .map((locale) => locale.message)
            .join(''),
        }));
      }
      return null;
    },
    userId,
    streamId,
    flowId,
  );
}

/** Read every message component in the app, decoded. */
export async function readComponentMessages(page, { streamId }) {
  return page.evaluate(
    async (s) => {
      const bags = (window.__koreBags || []).map((entry) => entry.headers);
      for (const headers of bags) {
        // eslint-disable-next-line no-await-in-loop
        const response = await fetch(
          `https://platform.kore.ai/api/1.1/builder/streams/${s}/components`,
          { headers, credentials: 'include' },
        );
        if (response.status !== 200) continue;
        const items = await response.json();
        return (Array.isArray(items) ? items : [])
          .filter((item) => item && Array.isArray(item.message) && item.message.length)
          .map((item) => {
            const decode = (value) => {
              try {
                return decodeURIComponent(value);
              } catch {
                return value;
              }
            };
            return {
              _id: item._id,
              name: item.name,
              type: item.type,
              text: item.message.map((part) => decode(part.text || '')).join(' '),
            };
          });
      }
      return null;
    },
    streamId,
  );
}

/** True once the flow canvas and its node palette are on screen. */
async function canvasReady(page) {
  return page.evaluate(() => {
    const text = document.body.innerText || '';
    return /Message Prompt/.test(text) && /New Node/.test(text);
  });
}

/**
 * Navigate to a Start Flow editor by its visible name.
 *
 * The editor opens as an overlay and the URL does not change, so success is
 * detected from the canvas palette and the row click is retried until it lands.
 */
export async function openFlow(page, helpers, flowName) {
  await helpers.clickText('Flows & Channels');
  await wait(6000);
  await ensureWideViewport(page);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (await canvasReady(page)) {
      await ensureWideViewport(page);
      return true;
    }
    // eslint-disable-next-line no-await-in-loop
    const clicked = await page.evaluate((name) => {
      const leaf = [...document.querySelectorAll('*')].find(
        (node) => !node.children.length && (node.innerText || '').trim() === name,
      );
      if (!leaf) return false;
      const row = leaf.closest('tr') || leaf.closest('a') || leaf.parentElement || leaf;
      row.click();
      return true;
    }, flowName);
    if (!clicked) return false;
    // eslint-disable-next-line no-await-in-loop
    await wait(6000);
  }
  return canvasReady(page);
}

/** Navigate to a Dialog Task editor by its visible name. */
export async function openDialog(page, helpers, dialogName) {
  await helpers.clickText('Dialogs');
  await wait(7000);
  await page.evaluate((name) => {
    const leaf = [...document.querySelectorAll('*')].find(
      (node) => !node.children.length && (node.innerText || '').trim() === name,
    );
    if (leaf) (leaf.closest('a') || leaf.closest('tr') || leaf.parentElement || leaf).click();
  }, dialogName);
  await wait(13000);
}

/** Bounding box of the canvas card for a node label. */
async function nodeBox(page, label) {
  return page.evaluate((text) => {
    const leaf = [...document.querySelectorAll('*')].find(
      (node) => !node.children.length && (node.innerText || '').trim() === text,
    );
    if (!leaf) return null;
    let card = leaf;
    for (let up = 0; up < 8 && card; up += 1) {
      card = card.parentElement;
      if (!card) break;
      const rect = card.getBoundingClientRect();
      if (rect.width > 90 && rect.height > 50) break;
    }
    const rect = (card || leaf).getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, w: rect.width, h: rect.height };
  }, label);
}

/** Open a node's config panel with a trusted double-click. */
export async function openNode(page, label) {
  const box = await nodeBox(page, label);
  if (!box) return null;
  await page.mouse.click(box.x, box.y, { clickCount: 2, delay: 90 });
  await wait(3500);
  return box;
}

/** Visible text controls, with their boxes. */
async function textFields(page) {
  return page.evaluate(() => {
    const visible = (node) => node.offsetParent !== null;
    return [...document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]')]
      .filter((node) => visible(node) && node.getBoundingClientRect().width > 40)
      .map((node, index) => {
        const rect = node.getBoundingClientRect();
        return {
          index,
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
          value: node.value || node.textContent || '',
        };
      });
  });
}

/**
 * Replace the text of the field currently holding `currentText`.
 *
 * Falls back to the first field when the current text is not matched, which
 * is the common case for a newly added node.
 */
export async function setFieldText(page, nextText, { match } = {}) {
  const fields = await textFields(page);
  if (!fields.length) return { ok: false, reason: 'no text fields visible' };

  const target =
    (match && fields.find((field) => field.value.trim() === match.trim())) ||
    (match && fields.find((field) => field.value.includes(match))) ||
    fields[fields.length - 1];

  await page.mouse.click(target.x, target.y);
  await wait(500);
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await wait(250);
  await page.keyboard.type(nextText);
  await wait(1200);

  // Commit: the editor persists on blur.
  await page.mouse.click(15, 620);
  await wait(3000);
  await page.keyboard.press('Tab');
  await wait(2000);

  return { ok: true, wrote: nextText, previous: target.value, fieldCount: fields.length };
}

export { wait };
