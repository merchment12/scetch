import { useEffect, useRef, useState } from 'react';
import { ImageSquare, UploadSimple } from '@phosphor-icons/react';
import { api } from '../api';
import Modal from './Modal';

export default function UploadModal({ lessons, initialLesson, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef(null);
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function chooseFile(next) {
    setError('');
    if (!next) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type)) { setError('Выбери изображение в формате JPG, PNG или WebP.'); return; }
    if (next.size > 10 * 1024 * 1024) { setError('Файл больше 10 МБ. Уменьши изображение и попробуй ещё раз.'); return; }
    setFile(next);
  }
  async function submit(event) {
    event.preventDefault();
    if (!file) { setError('Сначала выбери рисунок.'); return; }
    setBusy(true); setError('');
    const data = new FormData(event.currentTarget); data.set('file', file);
    try { const artwork = await api('/artworks', { method: 'POST', body: data }); onSuccess(artwork); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <Modal title="Добавить рисунок" onClose={() => { if (!busy) onClose(); }}>
    <p className="modal-intro">Собирай свой путь от первой линии до автомобильного концепта.</p>
    <form onSubmit={submit} className="upload-form">
      <button type="button" className={`dropzone ${dragging ? 'dragging' : ''}`} onClick={() => input.current.click()} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0]); }} disabled={busy}>
        {preview ? <img src={preview} alt="Предпросмотр выбранного рисунка" /> : <><ImageSquare size={36} /><strong>Перетащи фото или выбери файл</strong><span>JPG, PNG, WebP · до 10 МБ · до 20 Мп</span></>}
        {preview && <span className="change-file">Выбрать другое изображение</span>}
      </button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => chooseFile(event.target.files[0])} hidden />
      {file && <span className="helper file-name">{file.name}</span>}
      <label>Название работы<input name="title" placeholder="Например, городской автомобиль / попытка 01" maxLength={100} required disabled={busy} /></label>
      <label>Урок<select name="lesson_id" defaultValue={initialLesson} disabled={busy}>{lessons.map(lesson => <option key={lesson.id} value={lesson.id}>0{lesson.number} · {lesson.short_title}</option>)}</select></label>
      <label>Заметка к рисунку <span className="muted">(необязательно)</span><textarea name="description" placeholder="Что получилось и что хочешь улучшить?" maxLength={1000} rows={3} disabled={busy} /></label>
      {error && <div className="error-message" role="alert">{error}</div>}
      <button className="cta" type="submit" disabled={busy}><UploadSimple />{busy ? 'Сохраняем рисунок…' : 'Сохранить в мои работы'}</button>
      <p className="helper">Работа видна только в твоём аккаунте. Автоматическая оценка пока не выполняется.</p>
    </form>
  </Modal>;
}
