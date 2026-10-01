/** Map the builder's in-app routes so the dialog editor can be opened directly. */
import { installAuthObserver } from '../kore-api.mjs';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3000);

  const navRoutes = await page.evaluate(() =>
    [...new Set(
      [...document.querySelectorAll('a[href]')]
        .map((node) => node.getAttribute('href'))
        .filter((href) => href && href.includes('/builder/')),
    )],
  );

  const appUrl = await h.url();

  await h.clickText('Dialogs');
  await h.wait(5000);
  const dialogsUrl = await h.url();

  const rowRoutes = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('tr, [role="row"], li')];
    return rows
      .map((row) => {
        const link = row.querySelector('a[href]');
        const clickable = row.querySelector('[class*="click"], button');
        return {
          text: (row.innerText || '').trim().slice(0, 40),
          href: link ? link.getAttribute('href') : null,
          clickable: !!clickable,
        };
      })
      .filter((row) => row.text);
  });

  return JSON.stringify({ appUrl, dialogsUrl, navRoutes, rowRoutes: rowRoutes.slice(0, 12) }, null, 1);
}