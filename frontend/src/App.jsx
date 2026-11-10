import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, Check, CheckCircle, Circle, CloudCheck, Images, Moon, PencilSimple, Sun, WarningCircle, SignOut } from '@phosphor-icons/react';
import { api, bootstrapSession, logoutAccount, putProgress } from './api';
import AuthScreen from './components/AuthScreen';
import Gallery from './components/Gallery';
import Practice from './components/Practice';
import SketchPlayer from './components/SketchPlayer';
import UploadModal from './components/UploadModal';

const blankProgress = () => ({ seen_steps: [], checks: [false, false, false], completed: false });

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const bootstrap = useCallback(async () => {
    setReady(false); setError('');
    try { setUser(await bootstrapSession()); } catch (e) { setError(e.message); }
    finally { setReady(true); }
  }, []);
  useEffect(() => { bootstrap(); }, [bootstrap]);
  useEffect(() => {
    const changed = event => { setUser(event.detail); setReady(true); };
    window.addEventListener('techno-auth-change', changed);
    return () => window.removeEventListener('techno-auth-change', changed);
  }, []);
  if (!ready) return <main className="auth-loading" aria-busy="true"><div className="skeleton" /><p>Открываем твою мастерскую…</p></main>;
  if (error && !user) return <main className="auth-loading"><p role="alert">{error}</p><button className="secondary-button" onClick={bootstrap}>Повторить подключение</button></main>;
  if (!user) return <AuthScreen />;
  return <Workshop key={user.id} user={user} />;
}

function Workshop({ user }) {
  const [lessons, setLessons] = useState([]);
  const [progress, setProgress] = useState({});
  const [gallery, setGallery] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [sync, setSync] = useState('saved');
  const [syncError, setSyncError] = useState('');
  const [view, setView] = useState(location.hash === '#gallery' ? 'gallery' : 'lessons');
  const [selected, setSelected] = useState(() => localStorage.getItem(`techno-current-lesson:${user.id}`) || 'line');
  const [upload, setUpload] = useState(false);
  const [toast, setToast] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('techno-theme') || 'dark');
  const progressRef = useRef({});
  const queue = useRef(Promise.resolve());
  const generation = useRef(0);
  const dirty = useRef(new Map());
  const mounted = useRef(true);
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => { document.body.classList.toggle('light', theme === 'light'); localStorage.setItem('techno-theme', theme); }, [theme]);
  useEffect(() => { const onHash = () => setView(location.hash === '#gallery' ? 'gallery' : 'lessons'); window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash); }, []);
  useEffect(() => {
    const handler = e => { if (dirty.current.size) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler);
  }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4500); return () => clearTimeout(timer); }, [toast]);

  const fetchData = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const [lessonData, profile, artworks] = await Promise.all([api('/lessons'), api('/profile'), api('/gallery')]);
      setLessons(lessonData); setGallery(artworks); setProgress(profile.progress); progressRef.current = profile.progress;
      const saved = localStorage.getItem(`techno-current-lesson:${user.id}`);
      setSelected(lessonData.some(l => l.id === saved) ? saved : (lessonData.find(l => !profile.progress[l.id]?.completed) || lessonData[0]).id);
    } catch (e) { setLoadError(e.message); }
    finally { setLoading(false); }
  }, [user.id]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const persist = useCallback((id, value) => {
    const version = ++generation.current;
    dirty.current.set(id, value); setSync('saving'); setSyncError('');
    queue.current = queue.current.catch(() => {}).then(async () => {
      if (!mounted.current) return;
      try {
        await putProgress(id, value);
        if (dirty.current.get(id) === value) dirty.current.delete(id);
        if (version === generation.current) { setSync(dirty.current.size ? 'error' : 'saved'); }
      } catch (e) { setSync('error'); setSyncError(e.message); }
    });
  }, []);

  const updateProgress = useCallback((id, change) => {
    const current = progressRef.current[id] || blankProgress();
    const next = { ...current, ...change };
    progressRef.current = { ...progressRef.current, [id]: next };
    setProgress(progressRef.current); persist(id, next);
  }, [persist]);

  const markStep = useCallback(next => {
    const current = progressRef.current[selected] || blankProgress();
    if (!current.seen_steps.includes(next)) updateProgress(selected, { seen_steps: [...current.seen_steps, next].sort() });
  }, [selected, updateProgress]);

  useEffect(() => {
    if (loading || loadError || view !== 'lessons' || !lessons.some(l => l.id === selected)) return;
    localStorage.setItem(`techno-current-lesson:${user.id}`, selected);
  }, [selected, loading, loadError, view, lessons, updateProgress, user.id]);

  async function signOut() {
    setSigningOut(true);
    try {
      await queue.current;
      if (dirty.current.size) { setToast('Сначала повтори сохранение прогресса, затем выйди.'); return; }
      await logoutAccount();
    }
    catch (e) { setToast(e.message); }
    finally { setSigningOut(false); }
  }
  function changeView(next) { setView(next); location.hash = next === 'gallery' ? 'gallery' : 'lessons'; }
  function selectLesson(id, scroll = false) {
    setSelected(id); changeView('lessons');
    if (scroll) requestAnimationFrame(() => document.getElementById('lesson-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  const lesson = lessons.find(l => l.id === selected);
  const current = progress[selected] || blankProgress();
  const completed = lessons.filter(l => progress[l.id]?.completed).length;
  const percent = lessons.length ? Math.round(completed / lessons.length * 100) : 0;
  const mineCount = gallery.filter(i => i.kind === 'mine').length;

  return <>
    <a className="skip-link" href="#main">Перейти к содержанию</a>
    <header className="site-header"><a href="#lessons" className="logo" onClick={() => changeView('lessons')}>техно<span> / </span>скетчинг<span className="logo-dot">.</span></a><nav className="main-nav" aria-label="Главная навигация"><button className={view === 'lessons' ? 'active' : ''} onClick={() => changeView('lessons')}><BookOpen /> <span>Мастерская</span></button><button className={view === 'gallery' ? 'active' : ''} onClick={() => changeView('gallery')}><Images /> <span>Галерея</span>{' '}{mineCount > 0 && <span className="nav-count mono">{mineCount}</span>}</button></nav><div className="account-control"><span title={user.email}>{user.display_name}</span><button onClick={signOut} disabled={signingOut} aria-label="Выйти из аккаунта"><SignOut /><span>{signingOut ? 'Выходим…' : 'Выйти'}</span></button></div><button className="theme" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}>{theme === 'dark' ? <Sun /> : <Moon />}<span>{theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}</span></button></header>
    <main id="main">
      {loading ? <div className="loading-layout" aria-busy="true" aria-label="Загружаем мастерскую"><div className="skeleton loading-title" /><div className="skeleton loading-subtitle" /><div className="loading-grid"><div className="skeleton loading-side" /><div className="skeleton loading-card" /></div></div> : loadError ? <div className="empty-state"><WarningCircle size={40} /><h1>Мастерская пока недоступна</h1><p>{loadError}</p><p className="helper">Для локального запуска должны работать React и FastAPI. Команды есть в README проекта.</p><button className="cta compact" onClick={fetchData}>Попробовать ещё раз</button></div> : <>
        {sync === 'error' && <div className="sync-error" role="alert"><WarningCircle /><span>Изменения пока не сохранены. {syncError}</span><button onClick={() => { for (const [id, value] of dirty.current) persist(id, value); }}>Повторить</button></div>}
        {view === 'gallery' ? <Gallery items={gallery} lessons={lessons} onUpload={() => setUpload(true)} onChange={setGallery} onLesson={id => selectLesson(id, true)} notify={setToast} /> : lesson && <>
          <section className="intro-section"><div><div className="eyebrow"><span className="status-dot" /> МАСТЕРСКАЯ ТРАНСПОРТНОГО ДИЗАЙНА</div><h1>От первой линии<br />к своему <span className="pink">концепту.</span></h1><p className="intro">Учись видеть объём, управлять пропорциями и рисовать транспорт. Пять уроков, один скетчбук — и твои идеи в движении.</p><div className="intro-tags"><span>С нуля</span><span>На бумаге и в цифре</span><span>В своём темпе</span></div></div><div className="intro-sketch" aria-hidden="true"><img src="/sketches/coupe.svg" alt="" /><span className="mono">IDEA → FORM → MOTION</span></div></section>
          <section className="progress-strip" aria-label="Прогресс курса"><div className="progress-label"><span className="progress-icon"><PencilSimple /></span><div><strong>{completed === lessons.length ? 'Первый маршрут пройден' : 'Твой маршрут в дизайне'}</strong><span>{completed} из {lessons.length} уроков завершено</span></div></div><div className="course-progress"><div className="progress-track" role="progressbar" aria-label="Завершение курса" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ transform: `scaleX(${percent / 100})` }} /></div><strong className="mono">{percent}%</strong></div><span className={`save-status ${sync === 'error' ? 'pink' : ''}`} aria-live="polite"><CloudCheck />{sync === 'saving' ? 'Сохраняем…' : sync === 'error' ? 'Не сохранено' : 'Прогресс сохранён'}</span></section>
          {completed === lessons.length && <div className="course-complete"><CheckCircle size={28} /><div><strong>Отличное начало. Все пять уроков пройдены.</strong><p>Повтори профиль автомобиля и сравни с первой попыткой. Теперь у тебя есть основа для собственного проекта.</p></div><button className="text-button" onClick={() => changeView('gallery')}>Мои рисунки <ArrowRight /></button></div>}
          <div className="layout"><aside className="sidebar"><div className="sidebar-heading"><span className="eyebrow">ПРОГРАММА КУРСА</span><span className="mono muted">01—05</span></div><nav className="lesson-nav" aria-label="Уроки курса">{lessons.map(item => { const p = progress[item.id]; return <button key={item.id} className={`lesson ${selected === item.id ? 'active' : ''}`} onClick={() => selectLesson(item.id)} aria-current={selected === item.id ? 'page' : undefined}><div className="lesson-top"><span className="num mono">0{item.number} / {item.category.split(' / ')[0]}</span>{p?.completed ? <CheckCircle className="lesson-check" weight="fill" size={19} /> : p?.seen_steps.length ? <span className="started-dot" /> : <Circle size={15} className="muted" />}</div><strong>{item.short_title}</strong><small>4 шага <span>·</span> {item.duration} минут</small><div className="lesson-mini-progress">{[0, 1, 2, 3].map(i => <span key={i} className={p?.seen_steps.includes(i) ? 'seen' : ''} />)}</div></button>; })}</nav><div className="sidebar-note"><span className="pink">/</span><p>Сначала большая форма.<br />Детали подождут.</p></div><button className="gallery-link" onClick={() => changeView('gallery')}><Images size={25} /><div><strong>Насмотренность — тоже навык</strong><p>Открой примеры и сохрани свои попытки.</p></div><ArrowUpRight /></button><p className="profile-note">Прогресс и рисунки привязаны к твоему аккаунту. Продолжай обучение с любого устройства после входа.</p></aside>
            <section className="lesson-content" id="lesson-content" aria-label={lesson.title}><div className="card"><div className="heading"><div className="section-line"><span className="eyebrow">{lesson.category}</span><span className="lesson-label mono">УРОК 0{lesson.number}</span></div><h2>{lesson.title}</h2><p>{lesson.description}</p></div><SketchPlayer key={lesson.id} lesson={lesson} onStep={markStep} userId={user.id} /><div className="outcome"><Check size={18} /><span><strong>На выходе:</strong> {lesson.outcome}</span></div><Practice key={`practice-${lesson.id}`} lesson={lesson} progress={current} onCheck={(index, checked) => { const checks = [...current.checks]; checks[index] = checked; updateProgress(lesson.id, { checks, completed: checked ? current.completed : false }); }} onComplete={() => { updateProgress(lesson.id, { completed: true }); setToast(`Урок ${lesson.number} завершён. Ещё одна идея стала ближе.`); }} onUpload={() => setUpload(true)} onNext={() => selectLesson(lessons[lesson.number].id, true)} last={lesson.number === lessons.length} /></div></section>
          </div>
          <section className="bottom-invitation"><div><span className="eyebrow">НЕ ПРЯЧЬ ПЕРВЫЕ ПОПЫТКИ</span><h2>Прогресс видно в рисунках.</h2><p>Добавляй работы после практики. Через пять уроков сравни свою первую и последнюю линию.</p></div><button className="secondary-button" onClick={() => changeView('gallery')}>Открыть галерею <ArrowUpRight /></button></section>
        </>}
      </>}
      <footer><span className="logo small">техно<span> / </span>скетчинг</span><p>Транспортный дизайн начинается с линии.</p><span className="mono">МАСТЕРСКАЯ · MVP</span></footer>
    </main>
    {upload && <UploadModal lessons={lessons} initialLesson={selected} onClose={() => setUpload(false)} onSuccess={artwork => { setGallery(items => [artwork, ...items]); setUpload(false); setToast('Рисунок сохранён в «Мои работы».'); }} />}
    {toast && <div className="toast" role="status"><CheckCircle weight="fill" /><span>{toast}</span></div>}
  </>;
}
