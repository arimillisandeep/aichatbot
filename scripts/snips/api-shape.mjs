/** Inspect raw shapes of the dialogs endpoints. */
import { withApi } from '../kore-api.mjs';

export default async function run(page, h) {
  await h.enterApp();

  return JSON.stringify(
    await withApi(page, async (kore) => {
      const list = await kore.dialogs();
      const shape = (value) => {
        if (Array.isArray(value)) return 'array[' + value.length + ']';
        if (value && typeof value === 'object') return 'object{' + Object.keys(value).slice(0, 12).join(',') + '}';
        return typeof value + ':' + String(value).slice(0, 80);
      };
      const out = { listStatus: list.status, listShape: shape(list.body) };
      if (Array.isArray(list.body)) {
        out.count = list.body.length;
        out.first = {
          id: list.body[0]._id,
          name: list.body[0].name,
          keys: Object.keys(list.body[0]).slice(0, 30),
        };
        out.names = list.body.map((d) => d.name);
      }
      return out;
    }),
    null,
    1,
  );
}