import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowsOut, CaretLeft, CaretRight, Heart, Images, MagnifyingGlass, MagnifyingGlassMinus, MagnifyingGlassPlus, Trash, UploadSimple } from '@phosphor-icons/react';
import { api } from '../api';
import ArtworkImage from './ArtworkImage';
import Modal from './Modal';
import '../gallery.css';

function MuseumFrame({ item, large = false }) {
  return <span className={`museum-frame ${large ? 'large' : ''}`}><span className="frame-bevel"><span className="frame-mat"><span className="frame-window"><ArtworkImage key={item.id} item={item} className="museum-image" interactive={large} /></span></span></span></span>;
}

export default function Gallery({ items, lessons, onUpload, onChange, onLesson, notify }) {
  const [filter, setFilter] = useState('all');
  const [lessonFilter, setLessonFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const [room, setRoom] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const wall = useRef(null);
  const visible = items.filter(item => (filter === 'all' || (filter === 'favorites' ? item.favorite : item.kind === filter)) && (lessonFilter === 'all' || item.lesson_id === lessonFilter) && `${item.title} ${item.description}`.toLowerCase().includes(search.toLowerCase()));
  const roomsCount = Math.max(1, Math.ceil(visible.length / 4));
  const currentRoom = Math.min(room, roomsCount - 1);
  const exhibits = visible.slice(currentRoom * 4, currentRoom * 4 + 4);
  const active = items.find(item => item.id === selected);
  const viewerItems = visible.some(item => item.id === selected) ? visible : items;
  const currentIndex = viewerItems.findIndex(item => item.id === selected);

  function open(id) { setSelected(id); setError(''); setConfirmDelete(false); setZoomed(false); }
  function moveViewer(direction) {
    if (busy || viewerItems.length < 2) return;
    open(viewerItems[(currentIndex + direction + viewerItems.length) % viewerItems.length].id);
  }
  useEffect(() => { setRoom(0); }, [filter, lessonFilter, search]);
  useEffect(() => { if (wall.current) wall.current.scrollLeft = 0; }, [currentRoom, filter, lessonFilter, search]);
  useEffect(() => {
    if (!active) return;
    const onKey = event => {
      if (event.key === 'ArrowRight') { event.preventDefault(); moveViewer(1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); moveViewer(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, currentIndex, viewerItems, busy]);

  async function favorite(item) {
    setBusy(item.id); setError('');
    try { const result = await api(`/gallery/${item.id}/favorite`, { method: 'POST' }); onChange(items.map(i => i.id === item.id ? { ...i, ...result } : i)); }
    catch (e) { setError(e.message); }
    finally { setBusy(null); }
  }
  async function remove(item) {
    setBusy(item.id); setError('');
    try { await api(`/artworks/${item.id}`, { method: 'DELETE' }); onChange(items.filter(i => i.id !== item.id)); setSelected(null); setConfirmDelete(false); notify('Работа удалена из галереи.'); }
    catch (e) { setError(e.message); }
    finally { setBusy(null); }
  }

  return <section className="gallery-page exhibition-page">
    <div className="page-heading"><div><span className="eyebrow">ЭКСПОЗИЦИЯ / ТРАНСПОРТНЫЙ ДИЗАЙН</span><h1>Галерейный зал<span className="pink">.</span></h1><p>Отойди на шаг, посмотри на форму целиком. Или подойди ближе к каждой линии.</p></div><button className="cta compact" onClick={onUpload}><UploadSimple /> Добавить работу</button></div>
    <div className="gallery-toolbar"><div className="filter-tabs" aria-label="Разделы галереи">{[['all', 'Все рисунки'], ['mine', 'Мои работы'], ['example', 'Примеры'], ['favorites', 'Избранное']].map(([id, label]) => <button key={id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)} aria-pressed={filter === id}>{label}{' '}{id === 'mine' && <span className="mono">{items.filter(i => i.kind === 'mine').length}</span>}</button>)}</div><div className="gallery-search"><label className="search"><MagnifyingGlass /><input placeholder="Найти рисунок" value={search} onChange={e => setSearch(e.target.value)} aria-label="Поиск рисунков" /></label><select value={lessonFilter} onChange={e => setLessonFilter(e.target.value)} aria-label="Фильтр по уроку"><option value="all">Все уроки</option>{lessons.map(l => <option key={l.id} value={l.id}>{l.short_title}</option>)}</select></div></div>
    {error && !active && <p role="alert" className="error-message">{error}</p>}
    <div className="exhibition-room" role="region" aria-label={`Выставочный зал ${currentRoom + 1}`}>
      <div className="room-ceiling" aria-hidden="true"><span /><span /><span /><span /></div>
      <div className="room-sign"><span className="room-sign-line" /><div><span className="mono">ЗАЛ / {String(currentRoom + 1).padStart(2, '0')}</span><strong>{filter === 'mine' ? 'Личная коллекция' : filter === 'favorites' ? 'Избранные работы' : 'Линия. Форма. Движение.'}</strong></div><span className="mono room-count">{visible.length} {visible.length === 1 ? 'РАБОТА' : visible.length > 1 && visible.length < 5 ? 'РАБОТЫ' : 'РАБОТ'}</span></div>
      {exhibits.length ? <div className="exhibition-wall" ref={wall} tabIndex={0} aria-label="Работы на стене. На узком экране прокручивай в сторону">{exhibits.map((item, index) => <article className="hanging-artwork" key={item.id} style={{ '--index': index }}>
        <div className="artwork-spotlight" aria-hidden="true" />
        <button className="framed-artwork" onClick={() => open(item.id)} aria-label={`Открыть рисунок: ${item.title}`}><MuseumFrame item={item} /><span className="approach-label"><ArrowsOut /> Рассмотреть</span></button>
        <div className="museum-plaque"><span className="plaque-number mono">{String(currentRoom * 4 + index + 1).padStart(2, '0')}</span><div><h3><button onClick={() => open(item.id)}>{item.title}</button></h3><span>{lessons.find(l => l.id === item.lesson_id)?.short_title}</span><small>{item.kind === 'example' ? 'УЧЕБНЫЙ ПРИМЕР' : 'ЛИЧНАЯ РАБОТА'}</small></div><button className={`icon-button favorite ${item.favorite ? 'selected' : ''}`} onClick={() => favorite(item)} aria-label={item.favorite ? `Убрать из избранного: ${item.title}` : `В избранное: ${item.title}`} aria-pressed={item.favorite} disabled={busy !== null}><Heart weight={item.favorite ? 'fill' : 'regular'} /></button></div>
      </article>)}</div> : <div className="empty-state gallery-empty"><Images size={44} /><h2>{filter === 'mine' && !search && lessonFilter === 'all' ? 'Первый рисунок задаёт начало' : 'Эта стена пока свободна'}</h2><p>{filter === 'favorites' ? 'Отметь понравившиеся работы сердцем — они появятся здесь.' : filter === 'mine' ? 'Сфотографируй практику и добавь её в зал. Каждый новый рисунок — часть твоей истории.' : 'Попробуй другой запрос или выбери все уроки.'}</p>{filter === 'mine' ? <button className="secondary-button" onClick={onUpload}><UploadSimple /> Добавить первый рисунок</button> : <button className="secondary-button" onClick={() => { setFilter('all'); setSearch(''); setLessonFilter('all'); }}>Вернуться к экспозиции</button>}</div>}
      <div className="room-floor" aria-hidden="true"><div /></div><span className="room-wall-corner left" aria-hidden="true" /><span className="room-wall-corner right" aria-hidden="true" />
    </div>
    <div className="room-navigation"><span><MagnifyingGlass /> Нажми на рисунок, чтобы рассмотреть его в раме</span><div><button className="icon-button" disabled={currentRoom === 0} aria-label="Предыдущий зал" onClick={() => setRoom(currentRoom - 1)}><CaretLeft /></button><span className="mono">{String(currentRoom + 1).padStart(2, '0')} <span>/ {String(roomsCount).padStart(2, '0')}</span></span><button className="icon-button" disabled={currentRoom >= roomsCount - 1} aria-label="Следующий зал" onClick={() => setRoom(currentRoom + 1)}><CaretRight /></button></div></div>
    <div className="gallery-note"><span className="pink">/</span><p>Примеры — оригинальные учебные схемы, а не работы участников. Твои рисунки доступны только в твоём аккаунте. Войди с другого устройства, чтобы продолжить.</p></div>
    {active && <Modal title={active.title} wide className="exhibition-viewer" onClose={() => { if (!busy) setSelected(null); }}>
      <div className="viewer-topline"><span className="eyebrow">{active.kind === 'mine' ? 'ЛИЧНАЯ КОЛЛЕКЦИЯ' : 'УЧЕБНАЯ КОЛЛЕКЦИЯ'}</span><span className="mono">{String(currentIndex + 1).padStart(2, '0')} / {String(viewerItems.length).padStart(2, '0')}</span></div>
      <div className={`framed-viewer ${zoomed ? 'zoomed' : ''}`}><div className="viewer-frame-position"><MuseumFrame item={active} large /></div></div>
      <div className="viewer-navigation"><button className="text-button" disabled={viewerItems.length < 2 || busy !== null} onClick={() => moveViewer(-1)}><CaretLeft /> Предыдущая работа</button><button className="icon-button" aria-label={zoomed ? 'Показать рисунок целиком' : 'Увеличить рисунок'} aria-pressed={zoomed} onClick={() => setZoomed(value => !value)}>{zoomed ? <MagnifyingGlassMinus /> : <MagnifyingGlassPlus />}</button><button className="text-button" disabled={viewerItems.length < 2 || busy !== null} onClick={() => moveViewer(1)}>Следующая работа <CaretRight /></button></div>
      <div className="lightbox-meta"><span className="eyebrow">{active.author}</span>{active.created_at && <time>{new Date(active.created_at).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long', year: 'numeric' })}</time>}</div><p className="artwork-description">{active.description || 'Сохранённая практика. Вернись к ней после следующего урока и сравни результат.'}</p><div className="modal-actions"><button className="secondary-button" onClick={() => favorite(active)} disabled={busy !== null}><Heart weight={active.favorite ? 'fill' : 'regular'} />{active.favorite ? 'В избранном' : 'В избранное'}</button><button className="text-button" onClick={() => { setSelected(null); onLesson(active.lesson_id); }}>Открыть урок <ArrowRight /></button>{active.kind === 'mine' && <button className="icon-button delete" aria-label="Удалить работу" onClick={() => setConfirmDelete(true)} disabled={busy !== null}><Trash /></button>}</div>{confirmDelete && <div className="delete-confirm"><p>Удалить этот рисунок? Восстановить его в галерее не получится.</p><button className="secondary-button" onClick={() => setConfirmDelete(false)} disabled={busy !== null}>Оставить</button><button className="secondary-button danger" onClick={() => remove(active)} disabled={busy !== null}>{busy ? 'Удаляем…' : 'Удалить рисунок'}</button></div>}{error && <div role="alert" className="error-message">{error}</div>}
    </Modal>}
  </section>;
}
