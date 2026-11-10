import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthScreen from '../frontend/src/components/AuthScreen';
import { authenticate } from '../frontend/src/api';

vi.mock('../frontend/src/api', () => ({ authenticate: vi.fn() }));
beforeEach(() => { localStorage.clear(); authenticate.mockReset(); });

it('logs in with email and password and reports server errors inline', async () => {
  authenticate.mockRejectedValueOnce(new Error('Неверный email или пароль.'));
  const user = userEvent.setup(); render(<AuthScreen />);
  await user.type(screen.getByLabelText('Email'), 'designer@example.com');
  await user.type(screen.getByLabelText('Пароль'), 'my-password');
  await user.click(screen.getByRole('button', { name: 'Войти в мастерскую' }));
  expect(authenticate).toHaveBeenCalledWith('login', { email: 'designer@example.com', password: 'my-password' });
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Неверный email или пароль.');
});

it('checks confirmation before registration and optionally transfers the browser guest profile', async () => {
  localStorage.setItem('techno-learner-v1', '83e37af5-5864-4b48-a4bc-e409146198ff');
  authenticate.mockResolvedValue({ user: { id: 'registered' } });
  const user = userEvent.setup(); render(<AuthScreen />);
  await user.click(screen.getByRole('button', { name: 'Регистрация', exact: true }));
  await user.type(screen.getByLabelText('Имя'), 'Автодизайнер');
  await user.type(screen.getByLabelText('Email'), 'designer@example.com');
  await user.type(screen.getByLabelText(/^Пароль/), 'drawing-2026');
  await user.type(screen.getByLabelText('Повтори пароль'), 'another-pass');
  await user.click(screen.getByRole('button', { name: 'Создать аккаунт' }));
  expect(screen.getByRole('alert').textContent).toContain('Пароли не совпадают');
  expect(authenticate).not.toHaveBeenCalled();
  await user.clear(screen.getByLabelText('Повтори пароль'));
  await user.type(screen.getByLabelText('Повтори пароль'), 'drawing-2026');
  await user.click(screen.getByRole('button', { name: 'Создать аккаунт' }));
  expect(authenticate).toHaveBeenCalledWith('register', expect.objectContaining({ display_name: 'Автодизайнер', legacy_profile_id: '83e37af5-5864-4b48-a4bc-e409146198ff' }));
});
