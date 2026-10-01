/** Confirm Welcome Chat Flow and the login dialog are unchanged. */
export default async function run(page, h) {
  const out = [];

  await h.enterApp();
  await h.clickText('Flows & Channels');
  await h.wait(5000);
  await h.clickText('Start Flows', { exact: true });
  await h.wait(3500);
  await h.clickText('Welcome Chat Flow');
  await h.wait(6000);

  const flow = await page.evaluate(() => {
    const el = [...document.querySelectorAll('*')].find((n) => n.children.length === 0 && n.textContent.trim().startsWith('MessagePrompt'));
    const root = el ? el.closest('[class*="canvas"], [class*="flow"], section') || document.body : document.body;
    return root.innerText.replace(/\n{2,}/g, '\n').slice(0, 900);
  });
  out.push('===== Welcome Chat Flow =====');
  out.push(flow);

  await h.clickText('Back to Quick Start');
  await h.wait(2500);
  await h.clickText('Virtual Assistant');
  await h.wait(6000);
  await h.clickText('Dialogs');
  await h.wait(5000);

  const dialogs = await page.evaluate(() => document.body.innerText.replace(/\n{2,}/g, '\n').slice(0, 1600));
  out.push('\n===== Dialogs =====');
  out.push(dialogs);

  return out.join('\n');
}