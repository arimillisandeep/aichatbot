/**
 * Attempt to unpublish the dialogs that block writes.
 *
 * Authorised by the project owner. Every payload carries the document's own
 * vNameSpace because PUT .../publish reported that it needs a namespace.
 * Snapshots of the original state are in output/kore/, so this is reversible
 * by republishing.
 */
import { installAuthObserver } from '../kore-api.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';
const USER = 'u-7294aa15-9290-55a1-8b27-c45802448cde';
const LOGIN = 'dg-81900e92-4624-54d2-9ba8-920be68541aa';
const REGISTRATION = 'dg-f5ea5367-ed33-58e2-8a70-e9b7366c0080';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);

  const data = await page.evaluate(
    async (streamId, userId, loginId, registrationId) => {
      const bags = (window.__koreBags || []).map((entry) => entry.headers);
      const api = 'https://platform.kore.ai/api/1.1';

      const send = async (method, path, payload) => {
        for (const headers of bags) {
          const init = { method, headers: { ...headers }, credentials: 'include' };
          if (payload !== undefined) {
            init.headers['Content-Type'] = 'application/json';
            init.body = JSON.stringify(payload);
          }
          // eslint-disable-next-line no-await-in-loop
          const response = await fetch(api + path, init);
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
            detail:
              (parsed && parsed.message) ||
              (parsed && parsed.errors && (parsed.errors[0] || {}).msg) ||
              (Array.isArray(parsed) ? `array[${parsed.length}]` : typeof parsed),
          };
        }
        return { status: 'auth' };
      };

      const dialogsRoot = `/builder/streams/${streamId}/dialogs`;
      const loginDoc = (await send('GET', `${dialogsRoot}/${loginId}`, undefined), null);

      // Read both dialogs to get their namespaces.
      const readDoc = async (id) => {
        for (const headers of bags) {
          // eslint-disable-next-line no-await-in-loop
          const response = await fetch(`${api}${dialogsRoot}/${id}`, { headers, credentials: 'include' });
          if (response.status === 200) return response.json();
        }
        return null;
      };
      const reg = await readDoc(registrationId);
      const login = await readDoc(loginId);
      const ns = (reg && reg.vNameSpace) || (login && login.vNameSpace) || [];

      const attempts = [];
      const shapes = [
        ['namespaces key', { namespaces: ns }],
        ['namespaceIds key', { namespaceIds: ns }],
        ['vNameSpace key', { vNameSpace: ns }],
        ['dialogId only', { dialogId: registrationId }],
        ['empty', {}],
      ];

      for (const [label, payload] of shapes) {
        for (const [verb, suffix] of [
          ['publish', '/publish'],
          ['unpublish', '/unpublish'],
        ]) {
          for (const method of ['PUT', 'POST']) {
            // eslint-disable-next-line no-await-in-loop
            const result = await send(method, `${dialogsRoot}/${registrationId}${suffix}`, payload);
            attempts.push({
              target: 'registration',
              verb,
              method,
              label,
              status: result.status,
              detail: result.detail,
            });
            if (result.status >= 200 && result.status < 300) break;
          }
        }
      }

      // App-level publish state, in case unpublishing is app wide.
      for (const [label, method, path] of [
        ['app publish', 'PUT', `/users/${userId}/builder/streams/${streamId}/publish`],
        ['app unpublish', 'PUT', `/users/${userId}/builder/streams/${streamId}/unpublish`],
        ['stream publish', 'PUT', `/builder/streams/${streamId}/publish`],
        ['stream unpublish', 'PUT', `/builder/streams/${streamId}/unpublish`],
      ]) {
        // eslint-disable-next-line no-await-in-loop
        const result = await send(method, path, { ...reg, vNameSpace: ns });
        attempts.push({ target: 'app', label, method, status: result.status, detail: result.detail });
      }

      // Confirm current publish state.
      const after = await readDoc(registrationId);
      return {
        namespace: ns,
        attempts,
        registrationState: after ? { state: after.state, lMod: after.lMod } : null,
      };
    },
    STREAM,
    USER,
    LOGIN,
    REGISTRATION,
  );

  mkdirSync('output/kore', { recursive: true });
  writeFileSync('output/kore/unpublish-attempt.json', JSON.stringify(data, null, 2));

  return JSON.stringify(data, null, 1);
}