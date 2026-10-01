/**
 * Interactive inspector for the Kore.ai builder. Runs a small snippet in the
 * live signed-in page and prints the result, so builder screens can be mapped
 * without editing files for every probe.
 *
 * Usage: node scripts/kore-eval.mjs <file-with-snippet.mjs>
 * The snippet may export `default` an async function (page, helpers).
 */
import puppeteer from 'puppeteer-core';

import { CDP_URL } from './kore-login.mjs';

const snippetPath = process.argv[2];
if (!snippetPath) {
  console.error('Pass a snippet file path.');
  process.exit(1);
}

const { default: run } = await import(new URL(snippetPath, import.meta.url).href);

const browser = await puppeteer.connect({ browserURL: CDP_URL, defaultViewport: null });

try {
  const pages = await browser.pages();
  const page = pages.find((candidate) => candidate.url().includes('platform.kore.ai'));
  if (!page) throw new Error('No Kore.ai tab found');

  const helpers = {
    wait: (ms) => new Promise((done) => setTimeout(done, ms)),

    clickText: (text, { exact = false } = {}) => page.evaluate((label, isExact) => {
      const normalize = (value) => value.replace(/\s+/g, ' ').trim().toLowerCase();
      const target = normalize(label);
      const nodes = [...document.querySelectorAll('*')].filter((node) => {
        if (node.children.length) return false;
        const value = normalize(node.innerText || node.textContent);
        return isExact ? value === target : value.startsWith(target);
      });
      const node = nodes[0];
      if (!node) return false;
      (node.closest('a') || node.closest('button') || node).click();
      return true;
    }, text, exact),

    enterApp: async (name = process.env.KORE_APP || 'Conversation_AI_ChatBot_Pronix') => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await page.goto('https://platform.kore.ai/builder/home', { waitUntil: 'networkidle2', timeout: 60000 });
        await helpers.wait(4000);
        if (await helpers.clickText(name, { exact: true })) {
          await helpers.wait(7000);
          if (page.url().includes('/builder/app/')) return true;
        }
      }
      return false;
    },

    dump: async (limit = 6000) => {
      const text = await page.evaluate(() => document.body.innerText.replace(/\n{2,}/g, '\n'));
      return text.slice(0, limit);
    },

    url: () => page.url(),
    page,
    frames: () => page.frames().map((frame) => frame.url()),
  };

  const result = await run(page, helpers);
  if (result !== undefined) console.log(result);
} finally {
  browser.disconnect();
}