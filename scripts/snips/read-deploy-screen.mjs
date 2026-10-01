/**
 * Read the Deploy section to collect the published client links.
 *
 * Read-only: it visits the screen and extracts links and embed snippets.
 */
import { installAuthObserver } from '../kore-api.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3500);

  const clicked = await page.evaluate(() => {
    const leaf = [...document.querySelectorAll('*')].find((node) => {
      if (node.children.length) return false;
      return (node.innerText || '').trim() === 'Deploy';
    });
    if (!leaf) return false;
    (leaf.closest('a') || leaf.closest('button') || leaf.parentElement || leaf).click();
    return true;
  });
  await h.wait(8000);

  const extracted = await page.evaluate(() => {
    const links = [...new Set(
      [...document.querySelectorAll('a[href]')]
        .map((node) => node.href)
        .filter((href) => /^https?:\/\//i.test(href))
        .filter((href) => !/google|doubleclick|linkedin|zoominfo|analytics|googletagmanager|ccm\/collect/i.test(href)),
    )];

    // Embed snippets live in textareas, code blocks, or readonly inputs.
    const snippets = [...document.querySelectorAll('textarea, input[readonly], pre, code')]
      .map((node) => (node.value || node.textContent || '').trim())
      .filter((value) => value && value.length > 40 && /script|clientId|token|kore|iframe/i.test(value))
      .slice(0, 10);

    return { links, snippets };
  });

  const screen = await h.dump(3000);

  mkdirSync('output/kore', { recursive: true });
  writeFileSync('output/kore/deploy-screen.json', JSON.stringify({ url: await h.url(), ...extracted }, null, 2));

  return [
    'clickedDeploy: ' + clicked,
    'URL: ' + (await h.url()),
    '',
    '--- LINKS ---',
    extracted.links.join('\n'),
    '',
    '--- SNIPPETS ---',
    extracted.snippets.join('\n---\n'),
    '',
    '--- SCREEN ---',
    screen.slice(0, 1800),
  ].join('\n');
}