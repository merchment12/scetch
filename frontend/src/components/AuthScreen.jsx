import { useState } from 'react';
import { ArrowRight, Check, PencilSimple } from '@phosphor-icons/react';
import { authenticate } from '../api';
import '../auth.css';

export default function AuthScreen({ initialError = '' }) {
  const [mode, setMode] = useState('login');
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  const legacy = localStorage.getItem('techno-learner-v1');
  async function submit(event) {
    event.preventDefault(); setError('');
    const form = new FormData(event.currentTarget);
    const data = { email: form.get('email'), password: form.get('password') };
    if (mode === 'register') {
      if (data.password !== form.get('confirmation')) { setError('Пароли не совпадают.'); return; }
      data.display_name = form.get('display_name');
      if (form.get('import_guest') && legacy) data.legacy_profile_id = legacy;
    }
    setBusy(true);
    try { await authenticate(mode, data); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <main className="auth-page"><a className="logo" href="#">техно<span> / </span>скетчинг<span className="pink">.</span></a><div className="auth-layout"><section className="auth-intro"><span className="eyebrow">МАСТЕРСКАЯ ТРАНСПОРТНОГО ДИЗАЙНА</span><h1>Твои идеи.<br />Твой <span className="pink">маршрут.</span></h1><p>Войди, чтобы сохранять практику, собирать коллекцию рисунков и продолжать уроки с любого устройства.</p><img src="/sketches/coupe.svg" alt="Учебный скетч спортивного купе" /><div className="auth-features"><span><Check /> Пять подробных уроков</span><span><Check /> Личная галерея</span><span><Check /> Прогресс в аккаунте</span></div></section><section className="auth-card" aria-label={mode === 'login' ? 'Вход в аккаунт' : 'Регистрация аккаунта'}><div className="auth-mark"><PencilSimple /></div><h2>{mode === 'login' ? 'С возвращением' : 'Начнём с первой линии'}</h2><p>{mode === 'login' ? 'Войди в свою мастерскую.' : 'Создай аккаунт для уроков и рисунков.'}</p><div className="auth-tabs"><button type="button" aria-pressed={mode === 'login'} disabled={busy} onClick={() => { setMode('login'); setError(''); }}>Вход</button><button type="button" aria-pressed={mode === 'register'} disabled={busy} onClick={() => { setMode('register'); setError(''); }}>Регистрация</button></div><form className="auth-form" onSubmit={submit}>
    {mode === 'register' && <label>Имя<input name="display_name" autoComplete="name" maxLength={60} required disabled={busy} /></label>}
    <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required disabled={busy} /></label>
    <label>Пароль<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? 8 : 1} maxLength={128} required disabled={busy} />{mode === 'register' && <small>От 8 до 128 символов.</small>}</label>
    {mode === 'register' && <label>Повтори пароль<input name="confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={128} required disabled={busy} /></label>}
    {mode === 'register' && legacy && <label className="auth-import"><input type="checkbox" name="import_guest" defaultChecked disabled={busy} /><span>Перенести прежний прогресс и работы этого браузера</span></label>}
    {error && <div className="error-message" role="alert">{error}</div>}
    <button className="cta" disabled={busy}>{busy ? 'Подождём немного…' : mode === 'login' ? 'Войти в мастерскую' : 'Создать аккаунт'} {!busy && <ArrowRight />}</button>
    </form></section></div><p className="auth-foot">Транспортный дизайн начинается с линии.</p></main>;
}
