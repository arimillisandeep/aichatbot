/** Open a node panel and enumerate every clickable control with its labels. */
export default async function run(page, h) {
  const node = process.env.KORE_NODE || 'MessagePrompt0002';

  await h.enterApp();
  await h.clickText('Flows & Channels');
  await h.wait(5000);
  await h.clickText('Start Flows', { exact: true });
  await h.wait(3500);
  await h.clickText('Welcome Chat Flow');
  await h.wait(6500);

  await page.evaluate((name) => {
    const el = [...document.querySelectorAll('*')].find((n) => n.children.length === 0 && n.textContent.trim() === name);
    if (!el) return;
    (el.closest('[class*="node"]') || el.parentElement.parentElement).click();
  }, node);
  await h.wait(4000);

  const controls = await page.evaluate(() => {
    const visible = (el) => el.offsetParent !== null || el.getClientRects().length > 0;
    const describe = (el) => ({
      tag: el.tagName,
      text: (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40),
      aria: el.getAttribute('aria-label') || '',
      title: el.getAttribute('title') || '',
      type: el.getAttribute('type') || '',
      cls: (el.className || '').toString().slice(0, 70),
      disabled: el.disabled === true,
    });

    const clickables = [...document.querySelectorAll('button, [role="button"], a, input[type="submit"]')]
      .filter(visible)
      .map(describe)
      .filter((c) => c.text || c.aria || c.title);

    const panelButtons = clickables.filter((c) =>
      /save|update|apply|ok|confirm|done|cancel|close|next/i.test(c.text + c.aria + c.title),
    );

    return { panelButtons, allCount: clickables.length, sample: clickables.slice(-45) };
  });

  return JSON.stringify(controls, null, 1);
}