import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import lessons from '../backend/data/lessons.json';
import Gallery from '../frontend/src/components/Gallery';

vi.mock('../frontend/src/api', () => ({ api: vi.fn(async () => ({})), loadPrivateImage: vi.fn(async () => 'blob:work') }));
const items = Array.from({ length: 5 }, (_, i) => ({ id: `example-${i}`, title: `Эскиз транспорта ${i + 1}`, lesson_id: 'car', image_url: `/sketches/study-${i}.svg`, description: 'Транспортный скетч', kind: 'example', author: 'Учебный пример', favorite: false }));
beforeEach(() => localStorage.clear());

it('hangs the whole collection in framed rooms and navigates between rooms', async () => {
  const user = userEvent.setup();
  const { container } = render(<Gallery items={items} lessons={lessons} onUpload={vi.fn()} onChange={vi.fn()} onLesson={vi.fn()} notify={vi.fn()} />);
  expect(screen.getByRole('region', { name: 'Выставочный зал 1' })).toBeTruthy();
  expect(container.querySelectorAll('.framed-artwork .museum-frame')).toHaveLength(4);
  await user.click(screen.getByRole('button', { name: 'Следующий зал' }));
  expect(screen.getByRole('region', { name: 'Выставочный зал 2' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Открыть рисунок: Эскиз транспорта 5' })).toBeTruthy();
  expect(container.querySelectorAll('.framed-artwork .museum-frame')).toHaveLength(1);
});

it('opens a framed picture, zooms, and browses the collection with buttons and arrow keys', async () => {
  const user = userEvent.setup();
  render(<Gallery items={items} lessons={lessons} onUpload={vi.fn()} onChange={vi.fn()} onLesson={vi.fn()} notify={vi.fn()} />);
  await user.click(screen.getByRole('button', { name: 'Открыть рисунок: Эскиз транспорта 2' }));
  const dialog = screen.getByRole('dialog');
  expect(dialog.classList.contains('exhibition-viewer')).toBe(true);
  expect(dialog.querySelector('.museum-frame.large')).toBeTruthy();
  expect(within(dialog).getByRole('img', { name: 'Эскиз транспорта 2' })).toBeTruthy();
  await user.click(within(dialog).getByRole('button', { name: 'Увеличить рисунок' }));
  expect(dialog.querySelector('.framed-viewer.zoomed')).toBeTruthy();
  await user.click(within(dialog).getByRole('button', { name: 'Следующая работа' }));
  expect(within(dialog).getByRole('heading', { name: 'Эскиз транспорта 3' })).toBeTruthy();
  expect(dialog.querySelector('.framed-viewer.zoomed')).toBeNull();
  await user.keyboard('{ArrowLeft}');
  expect(within(dialog).getByRole('heading', { name: 'Эскиз транспорта 2' })).toBeTruthy();
  fireEvent(dialog, new Event('cancel', { bubbles: true }));
  expect(screen.queryByRole('dialog')).toBeNull();
});
