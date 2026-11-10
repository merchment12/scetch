import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowsOut, ArrowClockwise, CaretLeft, CaretRight, ClosedCaptioning, Crosshair, MagnifyingGlassPlus, Pause, Play, SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react';
import { actionAt, chapterAt, films, formatTime } from '../films/lessons';
import useFilmClock from '../hooks/useFilmClock';
import FilmScene from './FilmScene';
import ReferenceProject from './ReferenceProject';
import '../film.css';

export default function SketchPlayer({ lesson, onStep, userId }) {
  const film = films[lesson.id];
  const clock = useFilmClock(userId ? `${userId}:${lesson.id}` : lesson.id, film.duration, film.revision);
  const { time, playing, speed, started, playhead, seek, toggle, pause } = clock;
  const chapter = chapterAt(film, time);
  const action = actionAt(film, time);
  const [directions, setDirections] = useState(true);
  const [subtitles, setSubtitles] = useState(true);
  const [closeup, setCloseup] = useState(false);
  const [narration, setNarration] = useState(false);
  const [notice, setNotice] = useState('');
  const container = useRef(null);
  const spoken = useRef(null);
  const canNarrate = typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
  const chapterActions = film.actions.filter(item => item.chapter === chapter);
  const motionNumber = chapterActions.findIndex(item => item.id === action.id) + 1;

  useEffect(() => { onStep(chapter); }, [chapter, onStep]);
  useEffect(() => {
    if (!canNarrate || !narration || !playing) return;
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(action.caption);
    utterance.lang = 'ru-RU';
    utterance.rate = Math.max(.6, Math.min(1.8, speed));
    const voice = synth.getVoices().find(item => item.lang.startsWith('ru'));
    if (voice) utterance.voice = voice;
    utterance.onerror = event => { if (!['canceled', 'interrupted'].includes(event.error)) setNotice('Озвучка недоступна. Продолжай с субтитрами или выбери русский голос в настройках устройства.'); };
    spoken.current = utterance;
    synth.speak(utterance);
    return () => { if (spoken.current === utterance) { synth.cancel(); spoken.current = null; } };
  }, [action.id, action.caption, narration, playing, speed, canNarrate]);

  function jump(value) { seek(value); }
  const goChapter = useCallback(index => { pause(); seek(film.chapters[index].start); }, [film, pause, seek]);
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (container.current.requestFullscreen) await container.current.requestFullscreen();
      else setNotice('Этот браузер не поддерживает полноэкранный просмотр. Можно увеличить масштаб страницы.');
    } catch { setNotice('Браузер не разрешил полноэкранный просмотр. Ролик доступен в обычном окне.'); }
  }

  return <>
    {lesson.id === 'car' && <ReferenceProject chapter={chapter} onChapter={goChapter} />}
    <section className="lesson-film" ref={container} aria-label="Видеоурок по скетчингу" tabIndex={0} onKeyDown={event => {
      if (event.target !== event.currentTarget) return;
      if (event.code === 'Space') { event.preventDefault(); toggle(); }
      if (event.key === 'ArrowRight') { event.preventDefault(); jump(playhead.current + 10); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); jump(playhead.current - 10); }
    }}>
      <div className="film-topbar"><span><span className={`film-status-dot ${playing ? 'playing' : ''}`} /> АНИМИРОВАННЫЙ ВИДЕОУРОК</span><span className="mono">0{chapter + 1} / 04 · {formatTime(film.duration)}</span></div>
      <div className="film-screen">
        <FilmScene film={film} playhead={playhead} poster={!started} showDirections={directions} closeup={closeup} />
        {!started && <div className="film-poster"><span className="film-poster-label">ОТ ПУСТОГО ЛИСТА ДО ПОСТРОЕНИЯ</span><button className="film-big-play" onClick={toggle} aria-label="Смотреть видеоурок"><Play weight="fill" /></button><strong>{lesson.short_title}</strong><span>{formatTime(film.duration)} · 4 главы · движения карандаша</span></div>}
        {started && !playing && <button className="film-paused" onClick={toggle} aria-label={time >= film.duration ? 'Пересмотреть видеоурок' : 'Продолжить видеоурок'}>{time >= film.duration ? <ArrowClockwise /> : <Play weight="fill" />}</button>}
        <div className={`film-subtitles ${started && subtitles ? '' : 'hidden'}`} aria-hidden={!started || !subtitles} aria-live="off"><span className="mono">{action.kind === 'pause' ? 'ПАУЗА / ОБЪЯСНЕНИЕ' : action.kind === 'ghost' ? 'РЕПЕТИЦИЯ ДВИЖЕНИЯ' : `ДВИЖЕНИЕ ${String(motionNumber).padStart(2, '0')}`}</span><p>{action.caption}</p></div>
      </div>
      <div className="film-console">
        <div className="film-timeline"><div className="film-chapter-segments" aria-hidden="true">{film.chapters.map((item, index) => <div key={index} style={{ flex: item.duration }}><span style={{ transform: `scaleX(${Math.max(0, Math.min(1, (time - item.start) / item.duration))})` }} /></div>)}</div><input type="range" min={0} max={film.duration} step="0.1" value={time} onChange={event => jump(Number(event.target.value))} aria-label="Таймлайн видеоурока" aria-valuetext={`${formatTime(time)} из ${formatTime(film.duration)}`} /></div>
        <div className="film-controls"><div className="film-transport"><button className="film-control main" onClick={toggle} aria-label={playing ? 'Пауза видеоурока' : 'Воспроизвести видеоурок'}>{playing ? <Pause weight="fill" /> : <Play weight="fill" />}</button><button className="film-control skip" onClick={() => jump(playhead.current - 10)} aria-label="Назад на 10 секунд">−10</button><button className="film-control skip" onClick={() => jump(playhead.current + 10)} aria-label="Вперёд на 10 секунд">+10</button><span className="film-time mono">{formatTime(time)} <span>/ {formatTime(film.duration)}</span></span></div><div className="film-settings"><label className="film-speed"><span className="sr-only">Скорость воспроизведения</span><select value={speed} onChange={event => clock.setSpeed(Number(event.target.value))}>{[.5, .75, 1, 1.25, 1.5, 2].map(value => <option key={value} value={value}>{value}×</option>)}</select></label><button className={`film-control ${subtitles ? 'on' : ''}`} aria-label="Субтитры" aria-pressed={subtitles} onClick={() => setSubtitles(value => !value)}><ClosedCaptioning /></button><button className={`film-control ${narration ? 'on' : ''}`} aria-label="Озвучка устройства" title={canNarrate ? 'Озвучка средствами устройства' : 'Озвучка не поддерживается браузером'} aria-pressed={narration} disabled={!canNarrate} onClick={() => setNarration(value => !value)}>{narration ? <SpeakerHigh /> : <SpeakerSlash />}</button><button className="film-control" aria-label="Полноэкранный просмотр" onClick={fullscreen}><ArrowsOut /></button></div></div>
        <div className="film-assist"><button className={directions ? 'on' : ''} onClick={() => setDirections(value => !value)} aria-pressed={directions}><Crosshair /> Начало и цель штриха</button><button className={closeup ? 'on' : ''} onClick={() => setCloseup(value => !value)} aria-pressed={closeup}><MagnifyingGlassPlus /> Крупный план</button><button onClick={() => { pause(); jump(film.chapters[chapter].start); }}><ArrowClockwise /> Повторить главу</button></div>
      </div>
      {notice && <p className="film-notice" role="status">{notice}</p>}
    </section>
    <div className="film-chapters-heading"><span className="eyebrow">СОДЕРЖАНИЕ ВИДЕОУРОКА</span><span className="mono muted">ВЫБЕРИ ТАЙМКОД</span></div>
    <nav className="film-chapters" aria-label="Таймкоды видеоурока">{lesson.steps.map((item, index) => <button key={item.title} className={index === chapter ? 'active' : ''} onClick={() => goChapter(index)} aria-current={index === chapter ? 'step' : undefined}><span className="film-chapter-number mono">0{index + 1}</span><div><strong>{item.title}</strong><span className="mono">{formatTime(film.chapters[index].start)} <span>— {formatTime(film.chapters[index].end)}</span></span></div><Play weight={index === chapter ? 'fill' : 'regular'} /></button>)}</nav>
    <div className="theory film-theory" aria-live="polite"><span className="eyebrow">ГЛАВА 0{chapter + 1} · {formatTime(film.chapters[chapter].start)}</span><h3>{lesson.steps[chapter].title}</h3><p>{lesson.steps[chapter].text}</p><div className="tip"><span className="tip-line" />{lesson.steps[chapter].hint}</div><details className="film-transcript"><summary>Все движения этой главы <span className="mono">{chapterActions.length}</span></summary><ol>{chapterActions.map(item => <li key={item.id}><button onClick={() => { pause(); jump(item.start); }} aria-current={item.id === action.id ? 'true' : undefined}><time className="mono">{formatTime(item.start)}</time><span>{item.caption}</span></button></li>)}</ol></details><div className="step-navigation"><button className="text-button" disabled={chapter === 0} onClick={() => goChapter(chapter - 1)}><CaretLeft /> Предыдущая глава</button><button className="text-button" onClick={() => { if (chapter < 3) goChapter(chapter + 1); else { pause(); document.getElementById('practice')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }}>{chapter < 3 ? 'Следующий шаг' : 'К практике'} <CaretRight /></button></div></div>
  </>;
}
