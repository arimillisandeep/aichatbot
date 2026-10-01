/**
 * Opens Kore.ai XO in a Chrome window so the user can complete the Google
 * sign-in themselves.
 *
 * This script never reads, decrypts, or replays session cookies. It uses a
 * dedicated Chrome profile (not the user's everyday profile) and keeps a remote
 * debugging port open so that later automation can attach to the live,
 * authenticated browser over CDP while the signed-in window stays open.
 *
 * Usage:
 *   node scripts/kore-login.mjs
 *   node scripts/kore-session-check.mjs   (after signing in)
 */
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const LOGIN_URL = 'https://platform.kore.ai/auth/login';
const DEBUG_PORT = Number(process.env.KORE_CDP_PORT || 9222);

export const PROFILE_DIR = process.env.KORE_PROFILE_DIR
  || mkdtempSync(join(tmpdir(), 'kore-chrome-'));

export const CDP_URL = 'http://127.0.0.1:' + DEBUG_PORT;

export const CHROME_OPTIONS = {
  executablePath: CHROME,
  headless: false,
  userDataDir: PROFILE_DIR,
  defaultViewport: null,
  args: ['--remote-debugging-port=' + DEBUG_PORT, '--start-maximized'],
};

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (!existsSync(CHROME)) {
    console.error('Chrome not found at ' + CHROME + '. Set CHROME_PATH to override.');
    process.exit(1);
  }

  const browser = await puppeteer.launch(CHROME_OPTIONS);
  const page = (await browser.pages())[0] || (await browser.newPage());
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

  console.log('Opened ' + LOGIN_URL);
  console.log('Profile directory: ' + PROFILE_DIR);
  console.log('Sign in with your personal Google account in that window.');
  console.log('Then run: node scripts/kore-session-check.mjs');

  const shutdown = async () => {
    await browser.close().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  await new Promise(() => {});
}