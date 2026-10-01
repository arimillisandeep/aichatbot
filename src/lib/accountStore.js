const LOCAL_USERS_KEY = 'pronix-demo-users';

const seededUsers = [
  {
    id: 'pronix-demo-maya',
    username: 'Maya Patel',
    email: 'maya@pronix.demo',
    phone: '+1 609 555 0184',
    password: 'Pronix@2026',
  },
];

// Resolved per call rather than at module load so the endpoint can be changed
// at runtime and stubbed in tests.
function remoteUsersUrl() {
  return (import.meta.env?.VITE_MOCKAPI_USERS_URL || '').trim().replace(/\/$/, '');
}

export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function readLocalUsers() {
  const saved = localStorage.getItem(LOCAL_USERS_KEY);

  if (!saved) {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(seededUsers));
    return seededUsers;
  }

  try {
    return JSON.parse(saved);
  } catch {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(seededUsers));
    return seededUsers;
  }
}

function writeLocalUsers(users) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error('Mock API request failed with status ' + response.status);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function isRemoteStoreEnabled() {
  return Boolean(remoteUsersUrl());
}

export async function findUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  if (remoteUsersUrl()) {
    const users = await request(remoteUsersUrl());
    const found = users.find((user) => normalizeEmail(user.email || '') === normalizedEmail);
    return found || null;
  }

  return readLocalUsers().find((user) => normalizeEmail(user.email) === normalizedEmail) || null;
}

export async function createUser(input) {
  const payload = {
    ...input,
    email: normalizeEmail(input.email),
  };

  if (remoteUsersUrl()) {
    return request(remoteUsersUrl(), {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  const users = readLocalUsers();
  const user = {
    id: 'local-' + crypto.randomUUID(),
    ...payload,
  };

  writeLocalUsers([...users, user]);
  return user;
}

export async function updateUser(id, input) {
  const payload = {
    ...input,
    email: normalizeEmail(input.email),
  };

  if (remoteUsersUrl()) {
    return request(remoteUsersUrl() + '/' + id, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  const users = readLocalUsers();
  const user = {
    ...users.find((item) => item.id === id),
    ...payload,
    id,
  };

  writeLocalUsers(users.map((item) => (item.id === id ? user : item)));
  return user;
}

export async function removeUser(id) {
  if (remoteUsersUrl()) {
    return request(remoteUsersUrl() + '/' + id, {
      method: 'DELETE',
    });
  }

  writeLocalUsers(readLocalUsers().filter((item) => item.id !== id));
  return null;
}
