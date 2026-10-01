/**
 * Runs a conversation against the signed-in Kore.ai XO app's Playground and
 * reports exactly what the bot replies, which is the only reliable evidence that
 * the published dialog tasks work end to end.
 *
 * Usage: node scripts/kore-playground.mjs "log in"
 */
import puppeteer from 'puppeteer-core';

import { CDP_URL } from './kore-login.mjs';

const APP_NAME = process.env.KORE_APP || 'Conversation_AI_ChatBot_Pronix';
const HOME = 'https://platform.kore.ai/builder/home';
const UTTERANCE = process.argv.slice(2).join(' ') || 'hello';

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

const browser = await puppeteer.connect({ browserURL: CDP_URL, defaultViewport: null });

try {
  const pages = await browser.pages();
  const page = pages.find((candidate) => candidate.url().includes('platform.kore.ai'));
  if (!page) throw new Error('No Kore.ai tab found');
  await page.setViewport({ width: 1680, height: 1050 });

  const clickExact = (text) => page.evaluate((label) => {
    const target = label.trim().toLowerCase();
    const nodes = [...document.querySelectorAll('*')].filter(
      (node) => node.children.length === 0 && (node.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase() === target,
    );
    const node = nodes[0];
    if (!node) return false;
    (node.closest('a') || node).click();
    return true;
  }, text);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(HOME, { waitUntil: 'networkidle2', timeout: 60000 });
    await wait(4000);
    if (await clickExact(APP_NAME)) {
      await wait(7000);
      if (page.url().includes('/builder/app/')) break;
    }
  }
  console.log('app: ' + page.url());

  await clickExact('Playground');
  await wait(6000);
  const chatOpened = await clickExact('Chat');
  await wait(8000);
  console.log('chat conversation ' + (chatOpened ? 'opened' : 'NOT FOUND') + ' -> ' + page.url());

  // The Playground is usually an embedded web-widget iframe.
  const frames = page.frames();
  console.log('frames: ' + frames.length);
  for (const frame of frames) console.log('  frame: ' + frame.url().slice(0, 140));

  const target = frames.find((frame) => frame !== page.mainFrame() && frame.url().includes('kore')) || page.mainFrame();

  const typed = await target.evaluate((text) => {
    const input = document.querySelector('input[type="text"], textarea, [contenteditable="true"]');
    if (!input) return false;
    input.focus();
    if (input.isContentEditable) input.textContent = text;
    else {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(input, text);
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const form = input.closest('form');
    if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    return true;
  }, UTTERANCE);

  console.log('typed: ' + typed);
  await wait(9000);

  const conversation = await target.evaluate(() => document.body.innerText.replace(/\n{2,}/g, '\n'));
  console.log('\n===== Playground transcript =====');
  console.log(conversation.slice(-4000));
} finally {
  browser.disconnect();
}