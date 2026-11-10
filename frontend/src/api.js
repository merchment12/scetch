export const ACCESS_KEY = 'techno-access-token';
const USER_KEY = 'techno-auth-user';
let refreshFlight = null;
let generation = 0;

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}
export const getAccessToken = () => localStorage.getItem(ACCESS_KEY);
export function getAuthUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
}
function announce() { window.dispatchEvent(new CustomEvent('techno-auth-change', { detail: getAuthUser() })); }
export function clearSession() {
  generation++;
  localStorage.removeItem(ACCESS_KEY); localStorage.removeItem(USER_KEY); announce();
}
function saveSession(data) {
  generation++;
  localStorage.setItem(ACCESS_KEY, data.access_token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  announce();
  return data.user;
}
window.addEventListener('storage', event => {
  if (event.key === ACCESS_KEY || event.key === null) generation++;
  if (event.key === USER_KEY || event.key === null) announce();
});

async function send(path, options = {}) {
  try { return await fetch(path, { credentials: 'same-origin', ...options }); }
  catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Нет связи с сервером. Проверь подключение и попробуй ещё раз.', 0);
  }
}
async function checked(response) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(typeof body.detail === 'string' ? body.detail : response.status === 422 ? 'Проверь заполненные поля и требования к паролю.' : 'Не удалось выполнить запрос. Попробуй ещё раз.', response.status);
  }
  return response;
}

async function refreshAccess(previousToken = getAccessToken()) {
  if (refreshFlight) return refreshFlight;
  const refresh = async () => {
    const current = getAccessToken();
    if (current && current !== previousToken) return current;
    const version = generation;
    const response = await send('/api/auth/refresh', { method: 'POST', headers: { 'X-Requested-With': 'techno-web' }, cache: 'no-store' });
    if (response.status === 401) {
      if (generation === version) clearSession();
      throw new ApiError('Сессия истекла. Войди снова.', 401);
    }
    await checked(response);
    const data = await response.json();
    if (generation !== version) throw new ApiError('Сессия изменилась. Повтори запрос.', 401);
    saveSession(data);
    return data.access_token;
  };
  // Serializes cookie rotation between tabs where the Web Locks API is available.
  refreshFlight = (navigator.locks?.request ? navigator.locks.request('techno-refresh', refresh) : refresh()).finally(() => { refreshFlight = null; });
  return refreshFlight;
}

async function authorizedFetch(path, options = {}) {
  const token = getAccessToken();
  const owner = getAuthUser()?.id;
  const request = access => send(path, { ...options, headers: { ...options.headers, ...(access ? { Authorization: `Bearer ${access}` } : {}) } });
  let response = await request(token);
  if (response.status === 401) {
    const access = await refreshAccess(token);
    if (owner && getAuthUser()?.id !== owner) throw new ApiError('Аккаунт изменился. Повтори действие в текущем аккаунте.', 409);
    response = await request(access);
    if (response.status === 401 && getAccessToken() === access) { clearSession(); }
  }
  return checked(response);
}

export async function api(path, options = {}) {
  const response = path === '/lessons' || path.startsWith('/lessons/')
    ? await checked(await send(`/api${path}`, options))
    : await authorizedFetch(`/api${path}`, options);
  return response.status === 204 ? null : response.json();
}

export async function authenticate(mode, payload) {
  const response = await checked(await send(`/api/auth/${mode}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'techno-web' }, body: JSON.stringify(payload), cache: 'no-store',
  }));
  const data = await response.json();
  saveSession(data);
  if (mode === 'register' && payload.legacy_profile_id) localStorage.removeItem('techno-learner-v1');
  return data;
}
export async function bootstrapSession() {
  try {
    if (!getAccessToken()) { await refreshAccess(null); return getAuthUser(); }
    const user = await api('/auth/me');
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  } catch (error) {
    if (error.status === 401) return null;
    throw error;
  }
}
export async function logoutAccount() {
  const owner = getAuthUser()?.id;
  await checked(await send('/api/auth/logout', { method: 'POST', headers: { 'X-Requested-With': 'techno-web' }, cache: 'no-store' }));
  if (getAuthUser()?.id === owner) clearSession();
}
export async function loadPrivateImage(path, signal) {
  if (!path.startsWith('/api/artworks/')) throw new ApiError('Некорректный адрес рисунка.', 400);
  const response = await authorizedFetch(path, { signal, cache: 'no-store' });
  return URL.createObjectURL(await response.blob());
}
export function putProgress(id, progress) {
  return api(`/progress/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(progress) });
}
