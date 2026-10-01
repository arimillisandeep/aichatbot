/**
 * Test whether intents and Search AI are writable.
 *
 * These are the two remaining deliverables. Probe read shapes first, then try
 * the most likely write routes with a harmless, self-identifying change that
 * can be reverted.
 */
import { installAuthObserver } from '../kore-api.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);

  const result = await page.evaluate(
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
          const raw = await response.text();
          let parsed = raw;
          try {
            parsed = JSON.parse(raw);
          } catch {
            /* raw */
          }
          if (response.status === 401 || response.status === 403) continue;
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

      const out = {};

      // Intents
      const intents = (await send('GET', '/intents', undefined)).body || [];
      out.intentCount = Array.isArray(intents) ? intents.length : 0;
      if (Array.isArray(intents) && intents.length) {
        const sample = intents[0];
        out.intentShape = Object.keys(sample).slice(0, 24);
        out.intentNames = intents.map((intent) => intent.name).slice(0, 20);
        out.sampleUtterances = sample.utterances || sample.trainingData || null;

        // Try writing the sample intent back unchanged, then with one utterance added.
        const target = intents.find((intent) => /greet|hello|hi/i.test(intent.name || '')) || sample;
        out.intentTarget = target.name;

        const noop = await send('PUT', `/intents/${target._id}`, target);
        out.intentWriteNoop = { status: noop.status, detail: noop.detail };

        if (noop.status >= 200 && noop.status < 300) {
          const patched = JSON.parse(JSON.stringify(target));
          patched.utterances = [...(patched.utterances || []), { utterance: 'probe utterance for kore write test' }];
          const withOne = await send('PUT', `/intents/${target._id}`, patched);
          out.intentWritePatched = { status: withOne.status, detail: withOne.detail };
          const after = (await send('GET', '/intents', undefined)).body || [];
          const now = Array.isArray(after) ? after.find((item) => item && item._id === target._id) : null;
          out.intentVerified = ((now || {}).utterances || []).map((entry) => entry.utterance);
        }
      }

      // Search AI
      const components = (await send('GET', '/components', undefined)).body || [];
      const searchai = Array.isArray(components) ? components.filter((item) => item && item.type === 'searchai') : [];
      out.searchaiCount = searchai.length;
      out.searchaiNames = searchai.map((item) => item.name);
      if (searchai.length) {
        const node = searchai[0];
        out.searchaiShape = Object.keys(node).slice(0, 24);
        const noop = await send('PUT', `/components/${node._id}`, node);
        out.searchaiWriteNoop = { status: noop.status, detail: noop.detail };
      }

      // Collections route
      for (const path of ['/searchai', '/searchaicollections', '/collections', '/knowledgebase', '/search']) {
        // eslint-disable-next-line no-await-in-loop
        const probe = await send('GET', path, undefined);
        out[`route ${path}`] = { status: probe.status, detail: probe.detail };
      }

      return out;
    },
    STREAM,
  );

  mkdirSync('output/kore', { recursive: true });
  writeFileSync('output/kore/intent-search-write-probe.json', JSON.stringify(result, null, 2));

  return JSON.stringify(result, null, 1).slice(0, 5000);
}