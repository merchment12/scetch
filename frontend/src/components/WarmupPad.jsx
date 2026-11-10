import { useEffect, useRef, useState } from 'react';
import { ArrowCounterClockwise, DownloadSimple, Eraser, Pause, PencilSimple, Play, Timer } from '@phosphor-icons/react';

export default function WarmupPad() {
  const canvas = useRef(null);
  const paths = useRef([]);
  const drawing = useRef(false);
  const [count, setCount] = useState(0);
  const [pink, setPink] = useState(false);
  const [remaining, setRemaining] = useState(300);
  const [running, setRunning] = useState(false);

  function redraw() {
    const element = canvas.current;
    if (!element) return;
    const box = element.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    element.width = Math.round(box.width * dpr);
    element.height = Math.round(box.height * dpr);
    const ctx = element.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#faf9f5';
    ctx.fillRect(0, 0, box.width, box.height);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 2;
    for (const path of paths.current) {
      ctx.strokeStyle = path.color; ctx.fillStyle = path.color;
      if (path.points.length === 1) {
        ctx.beginPath(); ctx.arc(path.points[0].x * box.width, path.points[0].y * box.height, 1, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath();
        path.points.forEach((p, i) => ctx[i === 0 ? 'moveTo' : 'lineTo'](p.x * box.width, p.y * box.height));
        ctx.stroke();
      }
    }
  }

  useEffect(() => {
    const observer = new ResizeObserver(redraw);
    observer.observe(canvas.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setRemaining(r => Math.max(0, r - 1)), 1000);
    return () => clearInterval(timer);
  }, [running]);
  useEffect(() => { if (!remaining) setRunning(false); }, [remaining]);

  function point(event) {
    const rect = canvas.current.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  }
  function finish() {
    if (!drawing.current) return;
    drawing.current = false;
    setCount(paths.current.length);
  }
  function download() {
    canvas.current.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = 'techno-warmup.png'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  return <div className="warmup">
    <div className="warmup-heading"><div><span className="eyebrow">РАЗМИНКА ПЕРЕД ЛИСТОМ</span><h3>Поймай движение</h3></div><PencilSimple size={26} /></div>
    <p>Проведи несколько линий мышью, стилусом или пальцем. Основную практику лучше выполнить на бумаге.</p>
    <div className="canvas-wrap"><canvas ref={canvas} aria-label="Свободный черновик для рисования линий" onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault(); canvas.current.setPointerCapture(event.pointerId); drawing.current = true;
      paths.current.push({ color: pink ? '#d83985' : '#34343f', points: [point(event)] }); redraw();
    }} onPointerMove={event => {
      if (!drawing.current) return;
      paths.current.at(-1).points.push(point(event)); redraw();
    }} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} />
      {count === 0 && <span className="canvas-placeholder">Здесь начинается твоя линия</span>}
    </div>
    <div className="warmup-tools">
      <div className="button-group"><button className={`icon-button ${pink ? 'selected' : ''}`} onClick={() => setPink(p => !p)} aria-label="Розовый карандаш" aria-pressed={pink}><PencilSimple /></button><button className="icon-button" disabled={!count} onClick={() => { paths.current.pop(); setCount(paths.current.length); redraw(); }} aria-label="Отменить последнюю линию"><ArrowCounterClockwise /></button><button className="icon-button" disabled={!count} onClick={() => { paths.current = []; setCount(0); redraw(); }} aria-label="Очистить черновик"><Eraser /></button><button className="icon-button" disabled={!count} onClick={download} aria-label="Скачать черновик"><DownloadSimple /></button></div>
      <div className="timer"><Timer /><span className="mono" aria-label="Осталось времени">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span><button className="icon-button" aria-label={running ? 'Приостановить таймер' : 'Запустить таймер на пять минут'} onClick={() => { if (!remaining) setRemaining(300); setRunning(r => !r); }}>{running ? <Pause /> : <Play />}</button><button className="icon-button" aria-label="Сбросить таймер" onClick={() => { setRunning(false); setRemaining(300); }}><ArrowCounterClockwise /></button></div>
    </div>
    {!remaining && <p role="status" className="success-text">Пять минут практики позади. Сделай паузу и посмотри на свои линии.</p>}
    <small className="muted">Черновик временный. Скачай его, чтобы сохранить или добавить в галерею.</small>
  </div>;
}
