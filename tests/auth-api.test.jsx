import { beforeEach, afterEach, expect, it, vi } from 'vitest';

const user = { id: 'account-1', email: 'designer@example.com', display_name: 'Дизайнер' };
const response = (status, data) => ({ status, ok: status >= 200 && status < 300, json: async () => data, blob: async () => new Blob(['image']) });
let client;
beforeEach(async () => {
  localStorage.clear();
  vi.resetModules();
  vi.stubGlobal('fetch', vi.fn());
  client = await import('../frontend/src/api');
});
afterEach(() => vi.unstubAllGlobals());

it('saves only access and account information, and sends Authorization Bearer for private endpoints', async () => {
  fetch.mockResolvedValueOnce(response(201, { access_token: 'signed-access', user })).mockResolvedValueOnce(response(200, { progress: {} }));
  await client.authenticate('register', { email: user.email, password: 'long-enough-password', display_name: user.display_name });
  expect(localStorage.getItem(client.ACCESS_KEY)).toBe('signed-access');
  expect(localStorage.getItem('refresh_token')).toBeNull();
  await client.api('/profile');
  expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer signed-access');
  expect(fetch.mock.calls[1][1].headers['X-Learner-ID']).toBeUndefined();
  expect(fetch.mock.calls[0][1].credentials).toBe('same-origin');
});

it('rotates once for simultaneous expired requests and retries both with the new token', async () => {
  localStorage.setItem(client.ACCESS_KEY, 'expired');
  fetch.mockImplementation(async (path, options) => {
    if (path === '/api/auth/refresh') return response(200, { access_token: 'fresh', user });
    if (options.headers.Authorization === 'Bearer expired') return response(401, { detail: 'expired' });
    return response(200, { ok: true });
  });
  const result = await Promise.all([client.api('/profile'), client.api('/gallery')]);
  expect(result).toEqual([{ ok: true }, { ok: true }]);
  expect(fetch.mock.calls.filter(([path]) => path === '/api/auth/refresh')).toHaveLength(1);
  expect(fetch.mock.calls.filter(([, options]) => options.headers.Authorization === 'Bearer fresh')).toHaveLength(2);
  const refresh = fetch.mock.calls.find(([path]) => path === '/api/auth/refresh');
  expect(refresh[1].headers['X-Requested-With']).toBe('techno-web');
});

it('restores a session from an HttpOnly cookie when localStorage has no access token', async () => {
  fetch.mockResolvedValueOnce(response(200, { access_token: 'restored', user }));
  expect(await client.bootstrapSession()).toEqual(user);
  expect(fetch.mock.calls[0][0]).toBe('/api/auth/refresh');
  expect(client.getAccessToken()).toBe('restored');
});

it('clears an invalid session instead of entering an infinite retry loop', async () => {
  localStorage.setItem(client.ACCESS_KEY, 'expired');
  fetch.mockResolvedValueOnce(response(401, {})).mockResolvedValueOnce(response(401, {}));
  await expect(client.api('/profile')).rejects.toMatchObject({ status: 401 });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(client.getAccessToken()).toBeNull();
});

it('does not resurrect a session when an in-flight refresh completes after logout', async () => {
  localStorage.setItem(client.ACCESS_KEY, 'expired');
  let release;
  const refreshPending = new Promise(resolve => { release = resolve; });
  fetch.mockImplementation(async path => {
    if (path === '/api/auth/refresh') return refreshPending;
    if (path === '/api/auth/logout') return response(204, null);
    return response(401, {});
  });
  const pending = client.api('/profile');
  while (!fetch.mock.calls.some(([path]) => path === '/api/auth/refresh')) await Promise.resolve();
  await client.logoutAccount();
  release(response(200, { access_token: 'must-not-be-saved', user }));
  await expect(pending).rejects.toMatchObject({ status: 401 });
  expect(client.getAccessToken()).toBeNull();
});

it('never retries an old account write using a newly signed-in account token', async () => {
  fetch.mockResolvedValueOnce(response(200, { access_token: 'account-a', user }));
  await client.authenticate('login', { email: user.email, password: 'password-a' });
  let release;
  const delayed = new Promise(resolve => { release = resolve; });
  fetch.mockImplementation(async path => path === '/api/auth/login'
    ? response(200, { access_token: 'account-b', user: { ...user, id: 'account-2' } })
    : delayed);
  const pending = client.api('/progress/line', { method: 'PUT', body: '{}' });
  await client.authenticate('login', { email: 'another@example.com', password: 'password-b' });
  release(response(401, {}));
  await expect(pending).rejects.toMatchObject({ status: 409 });
  expect(client.getAccessToken()).toBe('account-b');
  expect(fetch.mock.calls.filter(([path]) => path === '/api/progress/line')).toHaveLength(1);
});
