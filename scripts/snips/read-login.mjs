/**
 * Read the full User Login dialog model over the builder API and snapshot it.
 *
 * The snapshot is the recovery point for any later mutation.
 */
import { withApi, installAuthObserver } from '../kore-api.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3000);

  const raw = await withApi(page, async (kore) => {
    const list = await kore.dialogs();
    const dialogs = Array.isArray(list.body)
      ? list.body
      : (list.body && (list.body.dialogs || list.body.data)) || [];

    const target = dialogs.find((item) => /user login/i.test(item.name || ''));
    if (!target) return { error: 'User Login dialog not found', names: dialogs.map((d) => d.name) };

    const full = await kore.dialog(target._id);
    const components = await kore.components(target._id);
    return {
      summaries: dialogs.map((dialog) => ({
        id: dialog._id,
        name: dialog.name,
        status: dialog.status || dialog.dialogStatus || dialog.state,
        nodes: (dialog.nodes || []).length,
      })),
      target: { id: target._id, name: target.name },
      dialog: full,
      components,
    };
  });

  if (raw.error) return JSON.stringify(raw, null, 1);

  mkdirSync('output/kore', { recursive: true });
  writeFileSync('output/kore/dialogs.json', JSON.stringify(raw.summaries, null, 2));
  writeFileSync('output/kore/user-login.dialog.json', JSON.stringify(raw.dialog.body, null, 2));
  writeFileSync('output/kore/user-login.components.json', JSON.stringify(raw.components.body, null, 2));

  const dialog = raw.dialog.body || {};
  const nodes = (dialog.nodes || []).map((node) => ({
    nodeId: node.nodeId,
    type: node.type,
    name: node.name || node.componentName,
    transitions: (node.transitions || []).map((transition) => ({
      condition: transition.condition,
      default: transition.default,
      next: transition.nextNode || transition.next || transition.to,
    })),
  }));

  return [
    'getStatus: ' + raw.dialog.status,
    'target: ' + JSON.stringify(raw.target),
    '',
    'summaries: ' + JSON.stringify(raw.summaries, null, 1),
    '',
    'nodes: ' + JSON.stringify(nodes, null, 1),
  ].join('\n');
}