/**
 * Test whether a new dialog task can be created and then edited.
 *
 * The store-provided dialogs cannot be unpublished because of an account
 * privilege. A freshly created task is not store-provided, so if creation and
 * edit both work, the required flows can be authored from scratch.
 *
 * Anything created here is disposable and can be deleted.
 */
import { installAuthObserver } from '../kore-api.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);

  const data = await page.evaluate(
    async (streamId) => {
      const bags = (window.__koreBags || []).map((entry) => entry.headers);
      const root = `https://platform.kore.ai/api/1.1/builder/streams/${streamId}`;

      const send = async (method, path, payload) => {
        for (const headers of bags) {
          const init = { method, headers: { ...headers }, credentials: 'include' };
          if (payload !== undefined) {
            init.headers['Content-Type'] = 'application/json';
            init.body = JSON.stringify(payload);
          }
          // eslint-disable-next-line no-await-in-loop
          const response = await fetch(root + path, init);
          if (response.status === 401 || response.status === 403) continue;
          const raw = await response.text();
          let parsed = raw;
          try {
            parsed = JSON.parse(raw);
          } catch {
            /* raw */
          }
          return {
            status: response.status,
            body: parsed,
            detail:
              (parsed && parsed.message) ||
              (parsed && parsed.errors && (parsed.errors[0] || {}).msg) ||
              (Array.isArray(parsed) ? `array[${parsed.length}]` : typeof parsed),
          };
        }
        return { status: 'auth' };
      };

      const before = (await send('GET', '/dialogs', undefined)).body;
      const beforeCount = Array.isArray(before) ? before.length : null;

      // Minimal skeleton, modelled on the shape of an existing dialog.
      const skeleton = {
        name: 'ZZ API Probe Task',
        shortDesc: 'Temporary task created to test the create and edit path.',
        nodes: [],
        state: 'configured',
        visibility: 'private',
        isPublishedVersion: false,
      };

      const attempts = [];
      for (const [label, method, path, payload] of [
        ['POST dialogs name only', 'POST', '/dialogs', { name: 'ZZ API Probe Task' }],
        ['POST dialogs skeleton', 'POST', '/dialogs', skeleton],
        ['POST dialogs with desc', 'POST', '/dialogs', { name: 'ZZ API Probe Task', description: 'probe', nodes: [] }],
      ]) {
        // eslint-disable-next-line no-await-in-loop
        const result = await send(method, path, payload);
        attempts.push({
          label,
          status: result.status,
          detail: result.detail,
          createdId: (result.body && result.body._id) || null,
        });
        if (result.status >= 200 && result.status < 300) break;
      }

      const after = (await send('GET', '/dialogs', undefined)).body;
      const afterList = Array.isArray(after) ? after : [];
      const created = afterList.find((item) => item && item.name === 'ZZ API Probe Task');

      return {
        beforeCount,
        afterCount: afterList.length,
        attempts,
        created: created
          ? { _id: created._id, name: created.name, state: created.state, status: created.status, nodes: (created.nodes || []).length }
          : null,
      };
    },
    STREAM,
  );

  mkdirSync('output/kore', { recursive: true });
  writeFileSync('output/kore/create-dialog-probe.json', JSON.stringify(data, null, 2));

  return JSON.stringify(data, null, 1);
}