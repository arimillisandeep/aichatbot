/** Re-open Welcome Chat Flow and report each Message Prompt node's text. */
export default async function run(page, h) {
  await h.enterApp();
  await h.clickText('Flows & Channels');
  await h.wait(5000);
  await h.clickText('Start Flows', { exact: true });
  await h.wait(3500);
  await h.clickText('Welcome Chat Flow');
  await h.wait(6500);

  const nodes = await page.evaluate(() => {
    const wanted = ['MessagePrompt0001', 'MessagePrompt0002', 'MessagePrompt0003'];
    return wanted.map((id) => {
      const el = [...document.querySelectorAll('*')].find((n) => n.children.length === 0 && n.textContent.trim() === id);
      if (!el) return { id, found: false };
      const group = el.closest('[class*="node"]') || el.parentElement.parentElement;
      return { id, found: true, groupClass: (group.className || '').toString().slice(0, 80) };
    });
  });

  const out = ['nodes: ' + JSON.stringify(nodes)];

  // Read the visible canvas labels, which show each prompt's current text.
  const canvas = await page.evaluate(() => {
    const el = [...document.querySelectorAll('*')].find(
      (n) => n.children.length === 0 && n.textContent.trim().startsWith('MessagePrompt'),
    );
    if (!el) return '(canvas not found)';
    const root = el.closest('[class*="canvas"], [class*="flow"], section') || document.body;
    return root.innerText.replace(/\n{2,}/g, '\n').slice(0, 1200);
  });
  out.push('\n===== canvas =====');
  out.push(canvas);

  return out.join('\n');
}