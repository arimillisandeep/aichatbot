/** Apply required copy inside the User Login dialog task. */
import { installAuthObserver } from '../kore-api.mjs';
import { openDialogTask, setDialogMessage } from '../kore-ui-dialog.mjs';

const SUCCESS = 'Hello {{entities.email}}! You have successfully logged in.';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);

  const opened = await openDialogTask(page, h, 'User Login');
  if (!opened) {
    const screen = await h.dump(1500);
    return JSON.stringify({ stage: 'dialog-not-open', screen: screen.slice(0, 900) }, null, 1);
  }

  const result = await setDialogMessage(page, 'Message0002', SUCCESS);

  return JSON.stringify({ result, screen: (await h.dump(1200)).slice(0, 700) }, null, 1);
}