import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../src/App.jsx';
import { API_FAILURE, NOT_REGISTERED, REGISTRATION_SUCCESS, WELCOME } from '../src/lib/dialog.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

function render() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(createElement(App)));
}

function text() {
  return container.textContent;
}

function buttons(label, { exact = false } = {}) {
  return [...container.querySelectorAll('button')].filter((button) => {
    const value = button.textContent.trim();
    return exact ? value === label : value.startsWith(label);
  });
}

function click(element) {
  act(() => element.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
}

function composer() {
  return container.querySelector('.message-form input');
}

async function flush() {
  // Async dialog handlers resolve on their own microtask queue; the submit
  // event listener's promise is not observable, so drain explicitly.
  await act(async () => {
    for (let tick = 0; tick < 5; tick += 1) await Promise.resolve();
  });
}

async function send(message) {
  const input = composer();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  act(() => setter.call(input, message));
  act(() => input.dispatchEvent(new window.Event('input', { bubbles: true })));
  const form = container.querySelector('.message-form');
  await act(async () => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
  await flush();
}

function setField(label, value) {
  const field = [...container.querySelectorAll('label')].find((item) => item.textContent.includes(label))?.querySelector('input');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  act(() => setter.call(field, value));
  act(() => field.dispatchEvent(new window.Event('input', { bubbles: true })));
  return field;
}

async function submitForm() {
  const form = container.querySelector('form.auth-form');
  await act(async () => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
  await flush();
}

beforeEach(() => {
  localStorage.clear();
  // Force the local demo store so UI behaviour does not depend on the
  // developer's own .env.local endpoint.
  vi.stubEnv('VITE_MOCKAPI_USERS_URL', '');
  render();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('greeting', () => {
  it('greets the visitor with login and register choices', () => {
    expect(text()).toContain(WELCOME);
    expect(buttons('Login')).toHaveLength(1);
    expect(buttons('Register')).toHaveLength(1);
  });
});

describe('login flow', () => {
  it('rejects an invalid email before calling the API', async () => {
    click(buttons('Login')[0]);
    setField('Registered email', 'not-an-email');
    await submitForm();
    expect(text()).toContain('Enter a valid email address');
  });

  it('logs in a known account and offers account options', async () => {
    click(buttons('Login')[0]);
    setField('Registered email', 'MAYA@pronix.demo');
    await submitForm();
    expect(text()).toContain('Hello Maya Patel! You have successfully logged in.');
    expect(buttons('Modify account')).toHaveLength(1);
    expect(buttons('Delete account')).toHaveLength(1);
  });

  it('offers register, retry, and cancel for an unknown email', async () => {
    click(buttons('Login')[0]);
    setField('Registered email', 'nobody@pronix.demo');
    await submitForm();
    expect(text()).toContain(NOT_REGISTERED);
    expect(buttons('Register now')).toHaveLength(1);
    expect(buttons('Retry')).toHaveLength(1);
    expect(buttons('Cancel')).toHaveLength(1);
  });

  it('ends the conversation on cancel', async () => {
    click(buttons('Login')[0]);
    setField('Registered email', 'nobody@pronix.demo');
    await submitForm();
    click(buttons('Cancel')[0]);
    expect(text()).toContain('No problem! Have a great day.');
  });

  it('shows the API failure message when the store throws', async () => {
    vi.stubEnv('VITE_MOCKAPI_USERS_URL', 'https://unreachable.mockapi.io/api/v1/users');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    click(buttons('Login')[0]);
    setField('Registered email', 'maya@pronix.demo');
    await submitForm();
    expect(text()).toContain(API_FAILURE);
  });
});

describe('signup flow', () => {
  it('validates every field before posting', async () => {
    click(buttons('Register')[0]);
    await submitForm();
    expect(text()).toContain('Enter a username with at least 2 characters.');
  });

  it('registers a valid profile and asks whether to continue', async () => {
    click(buttons('Register')[0]);
    setField('Username', 'Ravi Kumar');
    setField('Email', 'ravi@pronix.demo');
    setField('Phone number', '+1 609 555 0142');
    setField('Password', 'Pronix@2026');
    await submitForm();
    expect(text()).toContain(REGISTRATION_SUCCESS);
    expect(buttons('Yes, continue')).toHaveLength(1);
  });

  it('reveals account options when continuing', async () => {
    click(buttons('Register')[0]);
    setField('Username', 'Ravi Kumar');
    setField('Email', 'ravi2@pronix.demo');
    setField('Phone number', '+1 609 555 0143');
    setField('Password', 'Pronix@2026');
    await submitForm();
    click(buttons('Yes, continue')[0]);
    expect(buttons('Modify account')).toHaveLength(1);
    expect(buttons('Delete account')).toHaveLength(1);
  });

  it('declines and says goodbye when not continuing', async () => {
    click(buttons('Register')[0]);
    setField('Username', 'Ravi Kumar');
    setField('Email', 'ravi3@pronix.demo');
    setField('Phone number', '+1 609 555 0144');
    setField('Password', 'Pronix@2026');
    await submitForm();
    click(buttons('No, thanks')[0]);
    expect(text()).toContain('Thank you! Have a great day.');
  });
});

describe('account options', () => {
  async function login() {
    click(buttons('Login')[0]);
    setField('Registered email', 'maya@pronix.demo');
    await submitForm();
  }

  it('updates profile details', async () => {
    await login();
    click(buttons('Modify account')[0]);
    setField('Phone number', '+1 609 555 0999');
    await submitForm();
    expect(text()).toContain('Your account details have been updated.');
  });

  it('asks for confirmation before deleting', async () => {
    await login();
    click(buttons('Delete account')[0]);
    expect(text()).toContain('Are you sure you want to permanently delete this account?');
    expect(buttons('Keep account')).toHaveLength(1);
  });

  it('deletes the account on confirmation', async () => {
    await login();
    click(buttons('Delete account')[0]);
    click(buttons('Delete', { exact: true })[0]);
    await flush();
    expect(text()).toContain('Your account has been deleted.');
  });
});

describe('search and fallback', () => {
  it('answers a services question from the crawled corpus', async () => {
    await send('what services do you offer');
    expect(text()).toContain('Services');
    expect(container.querySelector('.source-tag')).not.toBeNull();
  });

  it('answers a pricing question', async () => {
    await send('what does contact center AI cost to run?');
    expect(container.querySelector('.source-tag')).not.toBeNull();
  });

  it('shows the related-options fallback for an unrelated question', async () => {
    await send('what is the best recipe for tiramisu');
    expect(text()).toContain('I could not find a precise answer');
    expect(buttons('Email support').length).toBeGreaterThan(0);
    expect(buttons('Visit Pronix').length).toBeGreaterThan(0);
  });

  it('logs an event for every question', async () => {
    await send('what services do you offer');
    const events = JSON.parse(localStorage.getItem('pronix-assistant-events'));
    expect(events.some((event) => event.type === 'question')).toBe(true);
    expect(events.some((event) => event.type === 'intent')).toBe(true);
  });

  it('acknowledges negative sentiment', async () => {
    await send('this is really frustrating, the login is broken');
    expect(text()).toContain('I am sorry this has been frustrating');
  });
});

describe('intent routing from free text', () => {
  it('routes login text to the login form', async () => {
    await send('I want to log into my account');
    expect(container.querySelector('form.auth-form')).not.toBeNull();
  });

  it('routes registration text to the register form', async () => {
    await send('I am a new user, sign up');
    expect(text()).toContain('Create your account with the details below.');
  });

  it('asks for login before account management when signed out', async () => {
    await send('delete my account');
    expect(text()).toContain('Please log in first');
  });

  it('offers support details for a handoff request', async () => {
    await send('I need to talk to a person');
    expect(text()).toContain('info@pronix.ai');
  });
});