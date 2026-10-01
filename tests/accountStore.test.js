import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeEmail } from '../src/lib/accountStore.js';

const ENDPOINT = 'https://example.mockapi.io/api/v1/users';

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function loadStore(endpoint) {
  vi.resetModules();
  vi.stubEnv('VITE_MOCKAPI_USERS_URL', endpoint);
  return import('../src/lib/accountStore.js');
}

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Maya@Pronix.Demo ')).toBe('maya@pronix.demo');
  });
});

describe('local demo store', () => {
  const load = () => loadStore('');

  it('reports remote store as disabled without an endpoint', async () => {
    const store = await load();
    expect(store.isRemoteStoreEnabled()).toBe(false);
  });

  it('seeds a reviewable account on first read', async () => {
    const store = await load();
    const user = await store.findUserByEmail('maya@pronix.demo');
    expect(user.username).toBe('Maya Patel');
  });

  it('creates, updates and deletes a user', async () => {
    const store = await load();
    const created = await store.createUser({ username: 'Ravi', email: 'Ravi@Pronix.Demo', phone: '+1 609 555 0111', password: 'Pronix@2026' });
    expect(created.email).toBe('ravi@pronix.demo');

    const found = await store.findUserByEmail('RAVI@pronix.demo');
    expect(found.id).toBe(created.id);

    const updated = await store.updateUser(created.id, { ...created, phone: '+1 609 555 0222' });
    expect(updated.phone).toBe('+1 609 555 0222');

    await store.removeUser(created.id);
    expect(await store.findUserByEmail('ravi@pronix.demo')).toBeNull();
  });

  it('returns null for an unregistered email', async () => {
    const store = await load();
    expect(await store.findUserByEmail('nobody@pronix.demo')).toBeNull();
  });
});

describe('MockAPI REST store', () => {
  const load = () => loadStore(ENDPOINT);

  it('reports remote store as enabled when an endpoint is set', async () => {
    const store = await load();
    expect(store.isRemoteStoreEnabled()).toBe(true);
  });

  it('GETs the users resource and matches an email case-insensitively', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([{ id: '1', email: 'Maya@Pronix.Demo', username: 'Maya' }]));
    vi.stubGlobal('fetch', fetchMock);
    const store = await load();

    const user = await store.findUserByEmail('maya@pronix.demo');
    expect(fetchMock).toHaveBeenCalledWith(ENDPOINT, expect.objectContaining({ headers: expect.any(Object) }));
    expect(fetchMock.mock.calls[0][1].method).toBeUndefined();
    expect(user.username).toBe('Maya');
  });

  it('POSTs a registration with a normalized email', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: '9' }, 201));
    vi.stubGlobal('fetch', fetchMock);
    const store = await load();

    await store.createUser({ username: 'Ravi', email: ' Ravi@Pronix.Demo ', phone: '1234567890', password: 'Pronix@2026' });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body).email).toBe('ravi@pronix.demo');
  });

  it('PUTs to the record URL on modify', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: '9' }));
    vi.stubGlobal('fetch', fetchMock);
    const store = await load();

    await store.updateUser('9', { username: 'Ravi', email: 'ravi@pronix.demo', phone: '1234567890' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(ENDPOINT + '/9');
    expect(init.method).toBe('PUT');
  });

  it('DELETEs the record URL on account removal', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, 204));
    vi.stubGlobal('fetch', fetchMock);
    const store = await load();

    expect(await store.removeUser('9')).toBeNull();
    expect(fetchMock.mock.calls[0][0]).toBe(ENDPOINT + '/9');
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });

  it('throws on a non-OK status so the UI can show the failure message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 500)));
    const store = await load();
    await expect(store.findUserByEmail('maya@pronix.demo')).rejects.toThrow('status 500');
  });
});