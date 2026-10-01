/**
 * Edit a message inside a Kore.ai dialog task through the canvas editor.
 *
 * Same two constraints as the flow editor: input must be trusted (Puppeteer's
 * mouse and keyboard, not element.click()), and there is no Save button, so
 * the commit is a blur. The viewport is widened first because dialog nodes are
 * laid out far to the right and fall outside a default window.
 *
 * Every change is confirmed by re-reading the components API.
 */
import { installAuthObserver } from './kore-api.mjs';
import { ensureWideViewport, wait } from './kore-ui-edit.mjs';

const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';

/** Current text of a named component, decoded. */
async function readComponent(page, name) {
  return page.evaluate(
    async (streamId, wanted) => {
      const bags = (window.__koreBags || []).map((entry) => entry.headers);
      for (const headers of bags) {
        // eslint-disable-next-line no-await-in-loop
        const response = await fetch(
          `https://platform.kore.ai/api/1.1/builder/streams/${streamId}/components`,
          { headers, credentials: 'include' },
        );
        if (response.status !== 200) continue;
        const items = await response.json();
        const found = (Array.isArray(items) ? items : []).find((item) => item && item.name === wanted);
        if (!found) continue;
        const decode = (value) => {
          try {
            return decodeURIComponent(value);
          } catch {
            return value;
          }
        };
        return {
          _id: found._id,
          type: found.type,
          text: (found.message || []).map((part) => decode(part.text || '')).join(' '),
        };
      }
      return null;
    },
    STREAM,
    name,
  );
}

/** Open a dialog task editor and confirm its canvas is up. */
export async function openDialogTask(page, helpers, dialogName) {
  await helpers.clickText('Dialogs');
  await wait(7000);
  await ensureWideViewport(page);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const ready = await page.evaluate(() => /Conditions|Transitions|New Node|Add Node/i.test(document.body.innerText || ''));
    if (ready) {
      await ensureWideViewport(page);
      return true;
    }
    // eslint-disable-next-line no-await-in-loop
    const clicked = await page.evaluate((name) => {
      const leaf = [...document.querySelectorAll('*')].find(
        (node) => !node.children.length && (node.innerText || '').trim() === name,
      );
      if (!leaf) return false;
      (leaf.closest('a') || leaf.closest('tr') || leaf.parentElement || leaf).click();
      return true;
    }, dialogName);
    if (!clicked) return false;
    // eslint-disable-next-line no-await-in-loop
    await wait(8000);
  }
  return false;
}

/** Drag the canvas so nodes are not hidden beneath the app header. */
async function panCanvas(page, dx = 0, dy = 140) {
  // Grab a point that is empty canvas, not a node.
  const start = await page.evaluate(() => {
    const w = innerWidth;
    const h = innerHeight;
    for (let y = 200; y < h - 120; y += 40) {
      for (let x = 300; x < w - 200; x += 60) {
        const el = document.elementFromPoint(x, y);
        if (el && !el.closest('[class*="node"], .message-input, [class*="card"]')) {
          return { x, y };
        }
      }
    }
    return { x: 600, y: Math.round(h / 2) };
  });

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + dx, start.y + dy, { steps: 12 });
  await page.mouse.up();
  await wait(2000);
  return start;
}

/** Open a dialog node's config panel by its on-canvas label. */
async function openDialogNode(page, nodeLabel) {
  const box = await page.evaluate((label) => {
    const el = [...document.querySelectorAll('*')].find(
      (node) => !node.children.length && (node.innerText || '').trim() === label,
    );
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    // Click the label itself, nudged below its baseline. Cards near the top of
    // the canvas can extend above the viewport, so their centre is unusable.
    return {
      x: Math.round(rect.x + rect.width / 2),
      y: Math.round(rect.y + rect.height / 2 + 4),
      labelY: Math.round(rect.y),
    };
  }, nodeLabel);

  if (!box) return null;

  // If the label is under the top chrome, pan the canvas down and re-locate.
  if (box.y < 130) {
    await panCanvas(page, 0, 150);
    const moved = await page.evaluate((label) => {
      const el = [...document.querySelectorAll('*')].find(
        (node) => !node.children.length && (node.innerText || '').trim() === label,
      );
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        x: Math.round(rect.x + rect.width / 2),
        y: Math.round(rect.y + rect.height / 2 + 4),
        labelY: Math.round(rect.y),
      };
    }, nodeLabel);
    if (moved) {
      await page.mouse.click(moved.x, moved.y, { clickCount: 2, delay: 90 });
      await wait(4000);
      return { ...moved, panned: true };
    }
  }

  await page.mouse.click(box.x, box.y, { clickCount: 2, delay: 90 });
  await wait(4000);
  return box;
}

/** A visible editable control holding `currentText`. */
async function fieldHolding(page, currentText) {
  return page.evaluate((text) => {
    const visible = (node) => node.offsetParent !== null;
    const wanted = (text || '').trim();
    return [...document.querySelectorAll('textarea, input, [contenteditable]')]
      .filter((node) => visible(node) && node.getBoundingClientRect().width > 30)
      .map((node) => {
        const rect = node.getBoundingClientRect();
        const value =
          node.value !== undefined && node.value !== null && node.value !== ''
            ? node.value
            : node.textContent || '';
        return {
          cls: String(node.className).slice(0, 45),
          value: String(value),
          x: Math.round(rect.x + rect.width / 2),
          y: Math.round(rect.y + rect.height / 2),
        };
      })
      .find((item) => item.value.trim() === wanted) || null;
  }, currentText);
}

/**
 * Set a dialog node's message, retrying until the API confirms it.
 */
export async function setDialogMessage(page, nodeLabel, nextText, { attempts = 4 } = {}) {
  const log = [];
  const before = await readComponent(page, nodeLabel);
  if (!before) return { ok: false, stage: 'component-not-found', node: nodeLabel };

  if (before.text === nextText) return { ok: true, alreadyCorrect: true, node: nodeLabel };

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const box = await openDialogNode(page, nodeLabel);
    if (!box) {
      log.push({ attempt, step: 'node-not-found' });
      // eslint-disable-next-line no-await-in-loop
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const field = await fieldHolding(page, before.text);
    if (!field) {
      // Sometimes the node itself renders the text; click it to promote it.
      // eslint-disable-next-line no-await-in-loop
      const inline = await page.evaluate((text) => {
        const visible = (node) => node.offsetParent !== null;
        const el = [...document.querySelectorAll('div, span, p')].find(
          (node) => !node.children.length && (node.innerText || '').trim() === (text || '').trim() && visible(node),
        );
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }, before.text);
      if (inline) {
        // eslint-disable-next-line no-await-in-loop
        await page.mouse.click(inline.x, inline.y);
        // eslint-disable-next-line no-await-in-loop
        await wait(2500);
      }
      // eslint-disable-next-line no-await-in-loop
      const retryField = await fieldHolding(page, before.text);
      if (!retryField) {
        log.push({ attempt, step: 'no-field', inline: !!inline });
        // eslint-disable-next-line no-await-in-loop
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      await typeAndBlur(page, retryField, nextText);
    } else {
      // eslint-disable-next-line no-await-in-loop
      await typeAndBlur(page, field, nextText);
    }

    // eslint-disable-next-line no-await-in-loop
    const after = await readComponent(page, nodeLabel);
    log.push({ attempt, step: 'typed', after: after && after.text });
    if (after && after.text === nextText) return { ok: true, node: nodeLabel, log, text: after.text };
  }

  return { ok: false, node: nodeLabel, log };
}

async function typeAndBlur(page, field, text) {
  await page.mouse.click(field.x, field.y);
  await wait(500);
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await wait(250);
  await page.keyboard.type(text);
  await wait(1500);
  // Commit on blur.
  await page.mouse.click(15, 640);
  await wait(3000);
  await page.keyboard.press('Tab');
  await wait(2000);
}
