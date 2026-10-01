/**
 * Drives the running prototype in a real browser and reports what the user
 * actually sees, so behaviour is verified end to end rather than only in jsdom.
 *
 * Usage: node scripts/smoke.mjs [baseUrl]
 */
import puppeteer from 'puppeteer-core';

const BASE = process.argv[2] || 'http://localhost:5173/';
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });

const failures = [];

  const stamp = Date.now();

function check(label, condition, detail = '') {
  const status = condition ? 'PASS' : 'FAIL';
  if (!condition) failures.push(label);
  console.log('  [' + status + '] ' + label + (detail ? '  ' + detail : ''));
}

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 950 });

  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push('console: ' + message.text());
  });

  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(1200);

  console.log('\n== greeting ==');
  const greeting = await page.evaluate(() => document.body.innerText);
  check('welcome copy matches the assignment', greeting.includes('Hello! Welcome to our Virtual Assistant.'));
  check('login and register offered', greeting.includes('Login') && greeting.includes('Register'));

  const clickButton = (label) => page.evaluate((text) => {
    const button = [...document.querySelectorAll('button')]
      .find((node) => node.textContent.trim().startsWith(text));
    if (!button) return false;
    button.click();
    return true;
  }, label);

  const typeInto = (labelText, value) => page.evaluate((label, text) => {
    const field = [...document.querySelectorAll('label')]
      .find((node) => node.textContent.includes(label))
      ?.querySelector('input');
    if (!field) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(field, text);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, labelText, value);

  const submitAuth = () => page.evaluate(() => {
    const form = document.querySelector('form.auth-form');
    if (!form) return false;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    return true;
  });

  const settle = async () => {
    for (let i = 0; i < 6; i += 1) {
      await page.evaluate(async () => {
        for (let t = 0; t < 5; t += 1) await Promise.resolve();
      });
      await wait(150);
    }
  };

  console.log('\n== login flow ==');
  await clickButton('Login');
  await wait(600);
  await typeInto('Registered email', 'not-an-email');
  await submitAuth();
  await settle();
  check('invalid email rejected', (await page.evaluate(() => document.body.innerText)).includes('Enter a valid email address'));

  await typeInto('Registered email', 'nobody-' + stamp + '@pronix.demo');
  await submitAuth();
  await settle();
  let text = await page.evaluate(() => document.body.innerText);
  check('not-registered copy', text.includes('This email is not registered. Would you like to create a new account?'));
  check('register/retry/cancel offered', text.includes('Register now') && text.includes('Retry') && text.includes('Cancel'));
  await clickButton('Cancel');
  await wait(700);
  check('cancel copy', (await page.evaluate(() => document.body.innerText)).includes('No problem! Have a great day.'));

  console.log('\n== registration ==');
  await page.evaluate(() => {
    const restart = [...document.querySelectorAll('button')].find((node) => node.querySelector('svg'));
    if (restart) restart.click();
  });
  await wait(900);
  await clickButton('Register');
  await wait(700);
  await submitAuth();
  await settle();
  check('username validation fires', (await page.evaluate(() => document.body.innerText)).includes('at least 2 characters'));

  // Register a unique account, then log in with it. This exercises a real
  // POST/GET round trip against whichever store is configured.
  const email = 'smoke' + stamp + '@pronix.demo';
  await typeInto('Username', 'Smoke Tester');
  await typeInto('Email', email);
  await typeInto('Phone number', '+1 609 555 0177');
  await typeInto('Password', 'Pronix@2026');
  await submitAuth();
  await settle();
  text = await page.evaluate(() => document.body.innerText);
  check('registration success copy', text.includes('Registration successful! Would you like to continue?'));
  await clickButton('Yes, continue');
  await wait(800);
  text = await page.evaluate(() => document.body.innerText);
  check('continue reveals account options', text.includes('Modify account') && text.includes('Delete account'));

  console.log('\n== login with the registered account ==');
  await page.evaluate(() => {
    const restart = [...document.querySelectorAll('button')].find((node) => node.querySelector('svg'));
    if (restart) restart.click();
  });
  await wait(900);
  await clickButton('Login');
  await wait(700);
  await typeInto('Registered email', email.toUpperCase());
  await submitAuth();
  await settle();
  text = await page.evaluate(() => document.body.innerText);
  check('login greets by username', text.includes('Hello Smoke Tester! You have successfully logged in.'));
  check('account options shown after login', text.includes('Modify account') && text.includes('Delete account'));

  console.log('\n== search ==');
  const ask = async (question) => {
    await page.evaluate(() => {
      const input = document.querySelector('.message-form input');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, '');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.evaluate((text2) => {
      const input = document.querySelector('.message-form input');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, text2);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, question);
    await page.evaluate(() => {
      const form = document.querySelector('.message-form');
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await settle();
    return page.evaluate(() => {
      const bubbles = [...document.querySelectorAll('.bubble-row.bot .bubble')];
      const last = bubbles[bubbles.length - 1];
      return {
        body: last ? last.innerText : '',
        source: last && last.querySelector('.source-tag') ? last.querySelector('.source-tag').innerText : null,
        fallback: !!(last && last.querySelector('a[href^="https://pronix.ai"]')),
      };
    });
  };

  let answer = await ask('what services do you offer');
  check('services question answered', !!answer.source, answer.source || answer.body.slice(0, 60));

  answer = await ask('what is AI unit economics');
  check('unit economics answered', !!answer.source, answer.source || '');

  answer = await ask('what time do you open');
  check('out-of-domain question falls back', answer.fallback && answer.body.includes('could not find a precise answer'));

  answer = await ask('what is the best recipe for tiramisu');
  check('unrelated question falls back', answer.fallback);

  console.log('\n== handoff routing ==');
  const handoff = await ask('can I speak to a human');
  check('handoff routed to support, not search', handoff.body.includes('info@pronix.ai'), handoff.body.slice(0, 60));

  console.log('\n== monitoring ==');
  const events = await page.evaluate(() => JSON.parse(localStorage.getItem('pronix-assistant-events') || '[]'));
  check('events recorded', events.length > 0, events.length + ' events');
  check('intent events recorded', events.some((event) => event.type === 'intent'));
  check('fallback events recorded', events.some((event) => event.type === 'fallback'));

  console.log('\n== console health ==');
  check('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  console.log('\n' + (failures.length ? 'FAILURES: ' + JSON.stringify(failures) : 'ALL CHECKS PASSED'));
} finally {
  await browser.close();
}

process.exit(failures.length ? 1 : 0);