/**
 * Kore.ai XO builder API client.
 *
 * Every call runs inside the signed-in Kore.ai page via same-origin fetch, so it
 * carries the session the user already authenticated. No cookies or tokens are
 * read, stored, or extracted; this is the same session the UI itself uses.
 */
export const STREAM_ID = process.env.KORE_STREAM || 'st-a26d2d94-7296-534b-ba83-b80aaf937136';
export const USER_ID = process.env.KORE_USER || 'u-7294aa15-9290-55a1-8b27-c45802448cde';

const BASE = 'https://platform.kore.ai/api/1.1';

/**
 * Runs `fn` with a `kore` helper bound to the live page.
 *
 * The builder authenticates with headers the Angular app attaches to its own
 * requests. Those headers are captured inside the page and reused in page scope
 * so that API calls are indistinguishable from the UI's own traffic. No header
 * value is ever read, returned, logged, or written to disk by Node: `withAuth`
 * captures, and the helper below only ever exposes the resulting response.
 */
export async function withApi(page, fn, { withAuth = true } = {}) {
  return page.evaluate(
    async (options) => {
      const { base, streamId, userId, source, useAuth } = options;

      const captured = { bags: null };

      // Different builder APIs accept different header sets. Rather than guess,
      // try each set the builder itself used and keep the one that is accepted.
      const bags = async () => {
        if (captured.bags) return captured.bags;
        for (let attempt = 0; attempt < 40 && !captured.bags; attempt += 1) {
          if (window.__koreBags && window.__koreBags.length) {
            captured.bags = window.__koreBags.map((entry) => entry.headers);
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        if (!captured.bags) throw new Error('No authenticated request observed; cannot build API client.');
        return captured.bags;
      };

      const once = async (method, path, payload, headers) => {
        const init = { method, headers: { ...headers }, credentials: 'include' };
        if (payload !== undefined) {
          init.headers['Content-Type'] = 'application/json';
          init.body = JSON.stringify(payload);
        }
        const response = await fetch(base + path, init);
        const text = await response.text();
        let parsed = null;
        try {
          parsed = text ? JSON.parse(text) : null;
        } catch {
          parsed = text;
        }
        return { status: response.status, ok: response.ok, body: parsed };
      };

      const call = async (method, path, payload) => {
        const candidates = useAuth ? await bags() : [{}];
        let last = null;
        for (const headers of candidates) {
          // eslint-disable-next-line no-await-in-loop
          const result = await once(method, path, payload, headers);
          last = result;
          if (result.status !== 401 && result.status !== 403) return result;
        }
        return last;
      };

      const kore = {
        base,
        streamId,
        userId,
        get: (path) => call('GET', path),
        post: (path, payload) => call('POST', path, payload),
        put: (path, payload) => call('PUT', path, payload),
        del: (path) => call('DELETE', path),
        dialogs: () => call('GET', `/builder/streams/${streamId}/dialogs`),
        dialog: (id) => call('GET', `/builder/streams/${streamId}/dialogs/${id}`),
        components: (id) => call('GET', `/builder/streams/${streamId}/dialogs/${id}/components?sendEntityRules=true`),
      };

      return new Function('kore', 'return (' + source + ')(kore);')(kore);
    },
    { base: BASE, streamId: STREAM_ID, userId: USER_ID, source: fn.toString(), useAuth: withAuth },
  );
}

/**
 * Installs the in-page observer that mirrors the builder's own request headers.
 *
 * Different builder APIs authenticate differently: the Dialog builder sends
 * `_zitok`/`session-id`, while the Flows API sends `authorization` + `accountid`.
 * The observer therefore records several complete header sets and keeps the
 * richest. Every value stays inside the page; Node never receives one.
 */
export async function installAuthObserver(page) {
  await page.evaluateOnNewDocument(() => {
    const score = (bag) => {
      let value = 0;
      if (bag.authorization) value += 8;
      if (bag.accountid) value += 4;
      if (bag._zitok) value += 2;
      if (bag['session-id'] || bag.sessionid) value += 2;
      if (bag.iid) value += 1;
      return value;
    };

    const adopt = (bag) => {
      if (!bag || !Object.keys(bag).length) return;
      window.__koreBags = window.__koreBags || [];
      const key = JSON.stringify(Object.keys(bag).sort());
      if (!window.__koreBags.some((entry) => entry.key === key)) {
        window.__koreBags.push({ key, headers: bag, score: score(bag) });
        window.__koreBags.sort((left, right) => right.score - left.score);
      }
    };

    // fetch
    const originalFetch = window.fetch;
    window.fetch = function patchedFetch(input, init) {
      try {
        const bag = {};
        new Request(input, init).headers.forEach((value, name) => {
          bag[String(name).toLowerCase()] = value;
        });
        adopt(bag);
      } catch {
        /* ignore */
      }
      return originalFetch.apply(this, arguments);
    };

    // XMLHttpRequest
    const pending = new WeakMap();
    const originalSet = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function patchedSet(name, value) {
      const key = String(name).toLowerCase();
      const bag = pending.get(this) || {};
      bag[key] = value;
      pending.set(this, bag);
      return originalSet.apply(this, arguments);
    };
    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function patchedSend(body) {
      try {
        adopt(pending.get(this));
      } catch {
        /* ignore */
      }
      return originalSend.apply(this, arguments);
    };
  });
}

export function dialogSummary(dialogs) {
  return (dialogs || []).map((dialog) => ({
    id: dialog._id,
    name: dialog.name,
    status: dialog.status || dialog.dialogStatus,
    nodeCount: (dialog.nodes || []).length,
    lMod: dialog.lMod,
  }));
}