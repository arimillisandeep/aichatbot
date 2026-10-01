/** Open Welcome Chat Flow, click a node, and report its configuration panel. */
export default async function run(page, h) {
  await h.enterApp();
  await h.clickText('Flows & Channels');
  await h.wait(5000);
  await h.clickText('Start Flows', { exact: true });
  await h.wait(3500);
  await h.clickText('Welcome Chat Flow');
  await h.wait(6000);

  const target = process.env.KORE_NODE || 'MessagePrompt0002';

  const clicked = await page.evaluate((name) => {
    const node = [...document.querySelectorAll('*')].find(
      (el) => el.children.length === 0 && el.textContent.trim() === name,
    );
    if (!node) return false;
    (node.closest('[class*="node"], [data-node], [class*="Node"]') || node.parentElement).click();
    return true;
  }, target);
  await h.wait(4000);

  const out = ['url: ' + (await h.url()), 'clicked ' + target + ': ' + clicked];
  out.push(await h.dump(4000));

  const detail = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('input, textarea, [contenteditable="true"]')].map((n) => ({
      tag: n.tagName,
      type: n.type || '',
      placeholder: n.placeholder || '',
      value: (n.value || n.textContent || '').slice(0, 200),
      aria: n.getAttribute('aria-label') || '',
    }));
    const buttons = [...new Set([...document.querySelectorAll('button')].map((n) => n.innerText.trim()).filter(Boolean))];
    return { inputs, buttons: buttons.slice(0, 60) };
  });

  out.push('\n===== inputs =====');
  out.push(JSON.stringify(detail.inputs, null, 1));
  out.push('\n===== buttons =====');
  out.push(JSON.stringify(detail.buttons, null, 1));

  return out.join('\n');
}