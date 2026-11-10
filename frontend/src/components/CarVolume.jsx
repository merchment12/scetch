import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowClockwise, Cube, Hand, Minus, Plus } from '@phosphor-icons/react';
import { buildCoupeMesh, projectMesh, projectPoint } from '../car/geometry';
import { coupeMilestones } from '../car/reference';

const DEFAULT = { yaw: -.55, pitch: .23, zoom: 1 };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const presets = [
  ['Профиль', { yaw: 0, pitch: 0, zoom: 1, orthographic: true }],
  ['Три четверти', DEFAULT],
  ['Спереди', { yaw: -Math.PI / 2, pitch: .1, zoom: 1.15 }],
  ['Сверху', { yaw: 0, pitch: 1.45, zoom: 1 }],
];

export default function CarVolume({ chapter }) {
  const [camera, setCamera] = useState(DEFAULT);
  const [override, setOverride] = useState(null);
  const [wireframe, setWireframe] = useState(false);
  const drag = useRef(null);
  const frame = useRef(null);
  const pending = useRef(null);
  const stage = override ?? chapter;
  const mesh = useMemo(() => buildCoupeMesh(stage), [stage]);
  const faces = useMemo(() => projectMesh(mesh, camera), [mesh, camera]);
  useEffect(() => () => { if (frame.current) cancelAnimationFrame(frame.current); }, []);
  const point = p => projectPoint(p, camera);
  const grid = Array.from({ length: 9 }, (_, i) => i - 4).flatMap(i => [
    [point([i, 0, -3]), point([i, 0, 3])],
    [point([-4, 0, i * .7]), point([4, 0, i * .7])],
  ]);
  const nose = point([3.65, .08, 0]);

  return <div className="car-volume">
    <div className="car-orbit-presets" aria-label="Ракурс объёмной схемы">{presets.map(([label, view]) => <button key={label} onClick={() => setCamera(view)}>{label}</button>)}<button className={wireframe ? 'active' : ''} onClick={() => setWireframe(value => !value)} aria-pressed={wireframe}>Каркас</button></div>
    <svg viewBox="0 0 760 440" role="img" aria-label="Вращаемая 3D-схема спортивного купе" className="car-volume-canvas" tabIndex={0} onKeyDown={event => {
      const direction = { ArrowLeft: -.12, ArrowRight: .12 }[event.key];
      if (direction) { event.preventDefault(); setCamera(c => ({ ...c, yaw: c.yaw + direction, orthographic: false })); }
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); setCamera(c => ({ ...c, pitch: clamp(c.pitch + (event.key === 'ArrowUp' ? .1 : -.1), -.1, 1.45) })); }
    }} onPointerDown={event => {
      if (event.button !== 0 || drag.current) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, camera };
    }} onPointerMove={event => {
      if (!drag.current || drag.current.id !== event.pointerId) return;
      const rect = event.currentTarget.getBoundingClientRect();
      pending.current = { ...drag.current.camera, orthographic: false, yaw: drag.current.camera.yaw + (event.clientX - drag.current.x) / Math.max(rect.width, 1) * 5, pitch: clamp(drag.current.camera.pitch + (event.clientY - drag.current.y) / Math.max(rect.height, 1) * 2.3, -.1, 1.45) };
      if (!frame.current) frame.current = requestAnimationFrame(() => { setCamera(pending.current); frame.current = null; });
    }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
      <defs><radialGradient id="car-ground-shadow"><stop stopColor="#39313f" stopOpacity=".17" /><stop offset="1" stopColor="#39313f" stopOpacity="0" /></radialGradient></defs>
      <rect width="760" height="440" fill="#f3f0e9" />
      {grid.map(([a, b], i) => <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#d6d0c5" strokeWidth=".7" />)}
      <ellipse cx="380" cy="310" rx="260" ry="64" fill="url(#car-ground-shadow)" />
      {faces.map(face => <polygon key={face.id} data-part={face.part} points={face.points} fill={wireframe ? '#b8aaa31a' : face.fill} stroke={wireframe ? '#9a899a' : face.fill} strokeWidth={wireframe ? '.65' : '.35'} strokeLinejoin="round" />)}
      <text x={nose.x} y={nose.y + 17} textAnchor="middle" className="volume-front-label">ПЕРЕД</text>
      <text x="24" y="29" className="film-paper-label">3D / УЧЕБНАЯ ОБЪЁМНАЯ СХЕМА</text>
      <text x="736" y="415" textAnchor="end" className="film-paper-label">ЭТАП 0{stage + 1} / {coupeMilestones[stage].title.toUpperCase()}</text>
    </svg>
    <div className="car-volume-tools"><span><Hand /> Потяни, чтобы повернуть · стрелки — с клавиатуры</span><div><button className="icon-button" aria-label="Отдалить 3D-схему" disabled={camera.zoom <= .7} onClick={() => setCamera(c => ({ ...c, zoom: Math.max(.7, c.zoom - .15) }))}><Minus /></button><button className="icon-button" aria-label="Приблизить 3D-схему" disabled={camera.zoom >= 1.45} onClick={() => setCamera(c => ({ ...c, zoom: Math.min(1.45, c.zoom + .15) }))}><Plus /></button><button className="icon-button" aria-label="Сбросить ракурс" onClick={() => setCamera(DEFAULT)}><ArrowClockwise /></button></div></div>
    <label className="volume-stage-label"><Cube /> Объёмы по этапам<select aria-label="Этап объёмной схемы" value={override === null ? 'auto' : override} onChange={event => setOverride(event.target.value === 'auto' ? null : Number(event.target.value))}><option value="auto">По ходу урока</option>{coupeMilestones.map((item, index) => <option key={item.title} value={index}>{index + 1}. {item.title}</option>)}</select></label>
    <p className="volume-note">Условная модель из простых объёмов помогает понять базу, свесы и кабину. По одному боковому рисунку нельзя точно восстановить ширину, поверхности и невидимые детали.</p>
  </div>;
}
