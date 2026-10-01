/** Inspect the Welcome Chat Flow editor and report how nodes are configured. */
export default async function run(page, h) {
  await h.enterApp();
  await h.clickText('Flows & Channels');
  await h.wait(5000);
  await h.clickText('Start Flows', { exact: true });
  await h.wait(4000);

  const opened = await h.clickText('Welcome Chat Flow');
  await h.wait(6000);

  const out = [];
  out.push('url: ' + (await h.url()));
  out.push('opened: ' + opened);
  out.push(await h.dump(5000));

  // What interactive affordances does the flow editor expose?
  const controls = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')].map((n) => n.innerText.trim()).filter(Boolean);
    const inputs = [...document.querySelectorAll('input, textarea')].map((n) => ({
      tag: n.tagName,
      placeholder: n.placeholder || '',
      value: (n.value || '').slice(0, 60),
      type: n.type || '',
    }));
    const roles = [...document.querySelectorAll('[role]')]
      .map((n) => n.getAttribute('role') + ':' + (n.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40))
      .filter((v) => v.length > 5)
      .slice(0, 40);
    return { buttons: [...new Set(buttons)].slice(0, 60), inputs, roles };
  });

  out.push('\n===== buttons =====');
  out.push(JSON.stringify(controls.buttons, null, 1));
  out.push('\n===== inputs =====');
  out.push(JSON.stringify(controls.inputs, null, 1));
  out.push('\n===== roles =====');
  out.push(JSON.stringify(controls.roles, null, 1));

  return out.join('\n');
}