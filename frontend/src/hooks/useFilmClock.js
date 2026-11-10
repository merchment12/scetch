import { useCallback, useEffect, useRef, useState } from 'react';

export default function useFilmClock(id, duration, revision) {
  const key = `techno-film-${id}${revision ? `-${revision}` : ''}`;
  const [time, setTime] = useState(() => {
    const saved = Number(localStorage.getItem(key));
    return Number.isFinite(saved) ? Math.max(0, Math.min(duration, saved)) : 0;
  });
  const playhead = useRef(time);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [started, setStarted] = useState(time > 0);

  const seek = useCallback(value => {
    playhead.current = Math.max(0, Math.min(duration, value));
    setTime(playhead.current);
    setStarted(true);
    localStorage.setItem(key, String(playhead.current));
  }, [duration, key]);

  useEffect(() => {
    if (!playing) return;
    let frame;
    let last;
    let lastDisplay = 0;
    const tick = now => {
      if (last !== undefined) playhead.current = Math.min(duration, playhead.current + Math.min((now - last) / 1000, .25) * speed);
      last = now;
      if (now - lastDisplay >= 120 || playhead.current === duration) {
        setTime(playhead.current);
        lastDisplay = now;
      }
      if (playhead.current >= duration) { setPlaying(false); return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const onVisibility = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', onVisibility); setTime(playhead.current); };
  }, [playing, speed, duration]);

  useEffect(() => {
    const save = () => localStorage.setItem(key, String(playhead.current));
    const interval = setInterval(save, 4000);
    window.addEventListener('pagehide', save);
    return () => { clearInterval(interval); window.removeEventListener('pagehide', save); save(); };
  }, [key]);

  const pause = useCallback(() => setPlaying(false), []);

  function toggle() {
    if (!playing && playhead.current >= duration) seek(0);
    setStarted(true);
    setPlaying(value => !value);
  }

  return { time, playhead, playing, speed, started, seek, toggle, setSpeed, pause };
}
