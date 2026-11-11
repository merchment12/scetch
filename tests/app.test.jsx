import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import lessons from '../backend/data/lessons.json';
import App from '../frontend/src/App';
import { api, putProgress } from '../frontend/src/api';

vi.mock('../frontend/src/api', () => ({ api: vi.fn(), putProgress: vi.fn(), loadPrivateImage: vi.fn(async () => 'blob:test-image'), bootstrapSession: vi.fn(async () => ({ id: 'test-user', email: 'designer@example.com', display_name: 'Дизайнер' })), logoutAccount: vi.fn(async () => {}) }));

const examples = [{ id: 'demo-coupe', title: 'Купе / поиск силуэта', lesson_id: 'car', image_url: '/sketches/coupe.svg', description: 'Учебный профиль', author: 'Учебный пример', kind: 'example', favorite: false }];
let stored;
beforeEach(() => {
  localStorage.clear(); location.hash = ''; stored = {};
  putProgress.mockImplementation(async (id, value) => { stored[id] = value; return value; });
  api.mockImplementation(async (path, options) => {
    if (path === '/lessons') return lessons;
    if (path === '/profile') return { progress: structuredClone(stored) };
    if (path === '/gallery') return structuredClone(examples);
    if (path.endsWith('/favorite')) return { favorite: true };
    if (path === '/artworks' && options?.method === 'POST') return { id: 'mine-01', title: options.body.get('title'), lesson_id: options.body.get('lesson_id'), image_url: '/api/artworks/mine-01/image', kind: 'mine', description: '', favorite: false };
    throw new Error(`Unexpected request: ${path}`);
  });
});

async function openApp() {
  const result = render(<App />);
  await screen.findByRole('heading', { name: 'Постановка руки и живая линия', level: 2 });
  return result;
}

describe('learning flow', () => {
  it('requires all teaching steps and self-checks, then restores completed progress after reopening', async () => {
    const user = userEvent.setup();
    const rendered = await openApp();
    const complete = screen.getByRole('button', { name: 'Завершить урок' });
    expect(complete.disabled).toBe(true);
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: /Следующий шаг/ }));
    for (const checkbox of screen.getAllByRole('checkbox')) await user.click(checkbox);
    expect(complete.disabled).toBe(false);
    await user.click(complete);
    await waitFor(() => expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(String(Math.round(100 / lessons.length))));
    await waitFor(() => expect(stored.line?.completed).toBe(true));
    rendered.unmount();
    await openApp();
    expect(screen.getByText('Урок пройден')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(String(Math.round(100 / lessons.length)));
  });

  it('switches lessons and saves their progress independently', async () => {
    const user = userEvent.setup(); await openApp();
    await user.click(screen.getByRole('button', { name: /Объём и перспектива/ }));
    await screen.findByRole('heading', { name: 'Геометрия и перспектива', level: 2 });
    await user.click(screen.getByRole('button', { name: /Следующий шаг/ }));
    await waitFor(() => expect(stored.perspective.seen_steps).toContain(1));
    expect(stored.line.seen_steps).toEqual([0]);
  });

  it('shows failed synchronization and retries the pending progress', async () => {
    putProgress.mockRejectedValueOnce(new Error('Сеть недоступна'));
    const user = userEvent.setup(); await openApp();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Сеть недоступна');
    await user.click(within(alert).getByRole('button', { name: 'Повторить' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(stored.line.seen_steps).toEqual([0]);
  });
});

describe('gallery flow', () => {
  it('opens examples, favorites them, and explains the empty personal gallery', async () => {
    const user = userEvent.setup(); await openApp();
    await user.click(screen.getByRole('button', { name: 'Галерея', exact: true }));
    await user.click(screen.getByRole('button', { name: 'Мои работы 0' }));
    expect(screen.getByText('Первый рисунок задаёт начало')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Примеры', exact: true }));
    await user.click(screen.getByRole('button', { name: 'В избранное: Купе / поиск силуэта' }));
    await user.click(screen.getByRole('button', { name: 'Избранное', exact: true }));
    expect(screen.getByRole('button', { name: 'Открыть рисунок: Купе / поиск силуэта' })).toBeTruthy();
  });

  it('uploads a sketch linked to a lesson and shows it in personal works', async () => {
    const user = userEvent.setup(); await openApp();
    await user.click(screen.getByRole('button', { name: 'Добавить работу', exact: true }));
    const dialog = screen.getByRole('dialog');
    const file = new File(['sample-image'], 'practice.png', { type: 'image/png' });
    await user.upload(dialog.querySelector('input[type=file]'), file);
    await user.type(within(dialog).getByLabelText('Название работы'), 'Моя первая линия');
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить в мои работы' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await user.click(screen.getByRole('button', { name: /Галерея 1/ }));
    await user.click(screen.getByRole('button', { name: 'Мои работы 1' }));
    expect(screen.getByRole('button', { name: 'Открыть рисунок: Моя первая линия' })).toBeTruthy();
    const call = api.mock.calls.find(([path, options]) => path === '/artworks' && options?.method === 'POST');
    expect(call[1].body.get('lesson_id')).toBe('line');
    expect(call[1].body.get('file')).toBe(file);
  });
});
