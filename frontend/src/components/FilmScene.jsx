import { memo, useEffect, useId, useRef } from 'react';
import { actionAt, chapterAt, strokeProgress } from '../films/lessons';

function FilmScene({ film, playhead, poster, showDirections, closeup }) {
  const prefix = useId().replace(/:/g, '');
  const scene = useRef(null);
  const cursor = useRef(null);
  const startPoint = useRef(null);
  const endPoint = useRef(null);
  const preview = useRef(null);
  const direction = useRef(null);
  const camera = useRef(null);
  const movementLabel = useRef(null);

  useEffect(() => {
    const groups = [...scene.current.querySelectorAll('[data-film-stroke]')].map(group => {
      const path = group.querySelector('[data-geometry]');
      const action = film.actions[Number(group.dataset.filmStroke)];
      const reveal = scene.current.querySelector(`[data-mask-for="${action.id}"]`);
      let length = 1;
      try { length = path.getTotalLength(); } catch { /* Geometry is unavailable in DOM-only renderers. */ }
      if (reveal) { reveal.style.strokeDasharray = `${length} ${length}`; reveal.style.strokeDashoffset = String(length); }
      return { group, path, reveal, length, action, last: null };
    });
    let frame;
    let previousTime = -1;
    let previousAction;
    const paint = () => {
      const time = playhead.current;
      if (time !== previousTime) {
        previousTime = time;
        const chapter = chapterAt(film, time);
        const active = actionAt(film, time);
        const visibleChapter = poster ? film.chapters.length - 1 : chapter;
        let activeGeometry;
        for (const entry of groups) {
          const { action, group, reveal, length } = entry;
          let progress = poster ? 1 : strokeProgress(action, time);
          const chapterHidden = film.resetEachChapter && action.chapter !== visibleChapter;
          const ghostHidden = action.kind === 'ghost' && (poster || active !== action);
          if (chapterHidden || ghostHidden) progress = 0;
          let opacity = progress > 0 ? (poster ? .2 : (action.opacity ?? 1)) : 0;
          if (!poster && chapter === 3 && action.style === 'guide') opacity *= .32;
          if (entry.last !== `${progress}-${opacity}`) {
            group.style.opacity = String(opacity);
            if (reveal) reveal.style.strokeDashoffset = String(length * (1 - progress));
            entry.last = `${progress}-${opacity}`;
          }
          if (!poster && active === action && action.d && !action.fill) activeGeometry = entry;
        }
        const moving = activeGeometry && showDirections;
        movementLabel.current.textContent = !poster && active?.d ? (active.kind === 'ghost' ? 'РЕПЕТИЦИЯ НАД БУМАГОЙ · БЕЗ КАСАНИЯ' : 'ШТРИХ НА БУМАГЕ · ПОВТОРИ НА СВОЁМ ЛИСТЕ') : 'ПАУЗА · ПРОЧИТАЙ ПОЯСНЕНИЕ И ПОПРАКТИКУЙСЯ';
        cursor.current.style.opacity = moving ? '1' : '0';
        startPoint.current.style.opacity = moving ? '1' : '0';
        endPoint.current.style.opacity = moving ? '1' : '0';
        preview.current.style.opacity = moving ? '.27' : '0';
        direction.current.style.opacity = moving ? '.8' : '0';
        if (activeGeometry) {
          const { path, length, action } = activeGeometry;
          const amount = strokeProgress(action, time);
          try {
            const start = path.getPointAtLength(0);
            const end = path.getPointAtLength(length);
            if (Math.hypot(end.x - start.x, end.y - start.y) < 16) {
              startPoint.current.style.opacity = '0';
              endPoint.current.style.opacity = '0';
            }
            let tip = path.getPointAtLength(length * amount);
            const next = path.getPointAtLength(Math.min(length, length * amount + 14));
            const lead = Math.min(1.2, action.duration * .15);
            const previous = groups.findLast(entry => entry.action.start < action.start && (!film.resetEachChapter || entry.action.chapter === action.chapter));
            if (time < action.start + lead && previous) {
              const from = previous.path.getPointAtLength(previous.length);
              const travel = Math.max(0, (time - action.start) / lead);
              const eased = travel * travel * (3 - 2 * travel);
              tip = { x: from.x + (start.x - from.x) * eased, y: from.y + (start.y - from.y) * eased - Math.sin(travel * Math.PI) * 14 };
              cursor.current.style.opacity = showDirections ? '.55' : '0';
              direction.current.style.opacity = '0';
            }
            cursor.current.setAttribute('transform', `translate(${tip.x} ${tip.y})`);
            startPoint.current.setAttribute('transform', `translate(${start.x} ${start.y})`);
            endPoint.current.setAttribute('transform', `translate(${end.x} ${end.y})`);
            direction.current.setAttribute('d', `M${tip.x} ${tip.y}L${next.x} ${next.y}`);
            if (previousAction !== action.id) {
              preview.current.setAttribute('d', action.d);
              if (closeup) {
                const box = path.getBBox();
                const scale = Math.min(1.7, 540 / Math.max(box.width, 100), 295 / Math.max(box.height, 80));
                camera.current.setAttribute('transform', `translate(330 175) scale(${scale}) translate(${-box.x - box.width / 2} ${-box.y - box.height / 2})`);
              } else camera.current.removeAttribute('transform');
              previousAction = action.id;
            }
          } catch { /* Keep subtitles and controls usable when SVG geometry is unavailable. */ }
        } else if (!closeup || poster) camera.current.removeAttribute('transform');
      }
      frame = requestAnimationFrame(paint);
    };
    paint();
    return () => cancelAnimationFrame(frame);
  }, [film, playhead, poster, showDirections, closeup]);

  return <svg ref={scene} className="film-canvas" viewBox="0 0 760 470" role="img" aria-label="Пошаговый рисунок: карандаш движется от начала штриха к его цели">
    <defs>
      <pattern id={`${prefix}-grid`} width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".6" fill="#d9d6ce" /></pattern>
      <marker id={`${prefix}-arrow`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M1 1L9 5L1 9" fill="none" stroke="#d63883" strokeWidth="1.5" /></marker>
      {film.actions.map(action => action.d && !action.fill && <mask key={action.id} id={`${prefix}-${action.id}`} maskUnits="userSpaceOnUse" x="-50" y="-50" width="760" height="470"><path data-mask-for={action.id} d={action.d} fill="none" stroke="white" strokeWidth={(action.width || 2.2) + 5} strokeLinecap="round" strokeLinejoin="round" /></mask>)}
    </defs>
    <rect width="760" height="470" fill="#faf9f5" />
    <rect width="760" height="470" fill={`url(#${prefix}-grid)`} opacity=".65" />
    <text x="29" y="32" className="film-paper-label">TECHNO / SKETCHBOOK</text>
    <text ref={movementLabel} x="380" y="416" textAnchor="middle" className="film-paper-label" />
    <text x="731" y="32" textAnchor="end" className="film-paper-label">FORM · PROPORTION · MOTION</text>
    <g transform="translate(50 60)"><g ref={camera} className="film-camera">
      {film.actions.map((action, index) => action.d && <g key={action.id} data-film-stroke={index} style={{ opacity: 0 }}>
        <path data-geometry d={action.d} className={`film-stroke ${action.style || 'ink'} ${action.kind === 'ghost' ? 'ghost' : ''}`} style={{ fill: action.fill || 'none', strokeWidth: action.width || (action.style === 'guide' ? 1 : 2.2) }} mask={!action.fill ? `url(#${prefix}-${action.id})` : undefined} />
      </g>)}
      <path ref={preview} fill="none" stroke="#d63883" strokeWidth="1.2" strokeDasharray="4 5" opacity="0" />
      <g ref={startPoint} opacity="0"><circle r="6" fill="#faf9f5" stroke="#d63883" strokeWidth="1.5" /><text x="-12" y="-12" className="film-point-label">А</text></g>
      <g ref={endPoint} opacity="0"><circle r="7" fill="#d6388315" stroke="#d63883" strokeWidth="1.5" strokeDasharray="2 3" /><text x="10" y="-10" className="film-point-label">Б</text></g>
      <path ref={direction} fill="none" stroke="#d63883" strokeWidth="2.5" markerEnd={`url(#${prefix}-arrow)`} opacity="0" />
      <g ref={cursor} opacity="0" className="film-pencil">
        <ellipse cx="24" cy="-4" rx="27" ry="5" fill="#34313b12" transform="rotate(-50)" />
        <g transform="rotate(-42)"><path d="M0 0L10 -5L78 -5Q84 0 78 5H10Z" fill="#f4ddae" stroke="#9b8264" strokeWidth=".8" /><path d="M0 0L6 -3V3Z" fill="#34343e" /><path d="M13 -5H73V5H13Z" fill="#d63883" /><path d="M16 -2H71" stroke="#f9a0c9" strokeWidth="1.5" /><path d="M73 -5V5" stroke="#8c7b83" strokeWidth="2" /></g>
      </g>
    </g></g>
    <path d="M29 434H731" stroke="#dfdcd4" strokeWidth="1" />
    <text x="29" y="451" className="film-paper-label">А — НАЧАЛО ШТРИХА</text><text x="731" y="451" textAnchor="end" className="film-paper-label">Б — ЦЕЛЬ ДВИЖЕНИЯ</text>
  </svg>;
}

export default memo(FilmScene);
