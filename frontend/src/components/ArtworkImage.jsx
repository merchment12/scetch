import { useEffect, useState } from 'react';
import { loadPrivateImage } from '../api';

export default function ArtworkImage({ item, className = '', interactive = false }) {
  const [loaded, setLoaded] = useState(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setError(false);
    if (item.kind === 'example') return;
    const controller = new AbortController();
    let url;
    loadPrivateImage(item.image_url, controller.signal).then(value => {
      url = value;
      if (!controller.signal.aborted) setLoaded({ path: item.image_url, url: value });
      else URL.revokeObjectURL(value);
    }).catch(e => { if (e.name !== 'AbortError') setError(true); });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [item.image_url, item.kind, attempt]);
  const source = item.kind === 'example' ? item.image_url + (attempt ? `?retry=${attempt}` : '') : loaded?.path === item.image_url ? loaded.url : '';
  if (error) return <span className={`image-placeholder ${className}`} role="img" aria-label={`Не удалось загрузить: ${item.title}`}><span>Рисунок не загрузился</span>{interactive ? <button className="text-button" onClick={() => { setError(false); setAttempt(value => value + 1); }}>Повторить</button> : <small>Открой работу, чтобы повторить</small>}</span>;
  if (!source) return <span className={`image-placeholder skeleton ${className}`} role="img" aria-label="Загружаем рисунок" />;
  return <img className={className} src={source} alt={item.title} loading={interactive ? 'eager' : 'lazy'} onError={() => setError(true)} />;
}
