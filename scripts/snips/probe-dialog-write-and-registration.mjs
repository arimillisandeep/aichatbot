/**
 * Confirm the dialog-level write route and read the Registration dialog.
 *
 * The dialog PUT is probed with the document exactly as read, so a success
 * rewrites identical content and only advances lMod.
 */
import { installAuthObserver } from '../kore-api.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';
const LOGIN = 'dg-81900e92-4624-54d2-9ba8-920be68541aa';
const REGISTRATION = 'dg-f5ea5367-ed33-58e2-8a70-e9b7366c0080';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);

  const result = await page.evaluate(
    async (streamId, loginId, registrationId) => {
      const bags = (window.__koreBags || []).map((entry) => entry.headers);
      const root = `https://platform.kore.ai/api/1.1/builder/streams/${streamId}`;

      const send = async (method, path, payload) => {
        let last = null;
        for (const headers of bags) {
          const init = { method, headers: { ...headers }, credentials: 'include' };
          if (payload !== undefined) {
            init.headers['Content-Type'] = 'application/json';
            init.body = JSON.stringify(payload);
          }
          // eslint-disable-next-line no-await-in-loop
          const response = await fetch(root + path, init);
          const text = await response.text();
          let parsed = text;
          try {
            parsed = JSON.parse(text);
          } catch {
            /* raw */
          }
          last = {
            status: response.status,
            body: parsed,
            detail: (parsed && parsed.errors && (parsed.errors[0] || {}).msg) || (parsed && parsed.message) || null,
          };
          if (response.status !== 401 && response.status !== 403) return last;
        }
        return last || { status: 0 };
      };

      const out = { dialogWrite: null, registration: null };

      // 1. Dialog-level write, with the document unchanged.
      const before = await send('GET', `/dialogs/${loginId}`, undefined);
      const document = before.body;
      out.dialogWrite = { readStatus: before.status, lModBefore: (document || {}).lMod };
      if (document) {
        // eslint-disable-next-line no-await-in-loop
        const attempt = await send('PUT', `/dialogs/${loginId}`, document);
        out.dialogWrite.status = attempt.status;
        out.dialogWrite.detail = attempt.detail;
        // eslint-disable-next-line no-await-in-loop
        const after = await send('GET', `/dialogs/${loginId}`, undefined);
        out.dialogWrite.lModAfter = (after.body || {}).lMod;
        out.dialogWrite.nodesAfter = ((after.body || {}).nodes || []).length;
      }

      // 2. Read the Registration dialog for later work.
      const regDialog = await send('GET', `/dialogs/${registrationId}`, undefined);
      const regComps = await send('GET', `/dialogs/${registrationId}/components?sendEntityRules=true`, undefined);
      const comps = Array.isArray(regComps.body) ? regComps.body : [];

      out.registration = {
        dialogStatus: regDialog.status,
        name: (regDialog.body || {}).name,
        state: (regDialog.body || {}).state,
        lMod: (regDialog.body || {}).lMod,
        nodes: ((regDialog.body || {}).nodes || []).map((node) => ({
          nodeId: node.nodeId,
          type: node.type,
          componentId: node.componentId,
          transitions: node.transitions,
        })),
        components: comps.map((component) => ({
          _id: component._id,
          type: component.type,
          name: component.name,
          label: component.label,
          text: (component.message || []).map((part) => part.text),
          serviceType: component.serviceType,
        })),
      };

      return out;
    },
    STREAM,
    LOGIN,
    REGISTRATION,
  );

  mkdirSync('output/kore', { recursive: true });
  writeFileSync('output/kore/registration.dialog.json', JSON.stringify(result.registration, null, 2));

  return JSON.stringify(result, null, 1).slice(0, 6000);
}