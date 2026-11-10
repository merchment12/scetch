import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import lessons from '../backend/data/lessons.json';
import { actionAt, chapterAt, compileFilm, films, formatTime, strokeProgress } from '../frontend/src/films/lessons';
import useFilmClock from '../frontend/src/hooks/useFilmClock';
import FilmScene from '../frontend/src/components/FilmScene';
import SketchPlayer from '../frontend/src/components/SketchPlayer';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(0);
  vi.stubGlobal('requestAnimationFrame', callback => setTimeout(() => callback(Date.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', id => clearTimeout(id));
  window.SVGElement.prototype.getTotalLength = () => 100;
  window.SVGElement.prototype.getPointAtLength = length => ({ x: 10 + length, y: 10 });
  window.SVGElement.prototype.getBBox = () => ({ x: 10, y: 10, width: 100, height: 20 });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('provides a detailed continuous film for each of the five lessons', () => {
  for (const lesson of lessons) {
    const film = films[lesson.id];
    expect(film.chapters).toHaveLength(4);
    expect(film.duration).toBeGreaterThan(230);
    expect(film.actions.length).toBeGreaterThanOrEqual(30);
    expect(film.actions.filter(action => action.d).length).toBeGreaterThan(20);
    for (let index = 1; index < film.actions.length; index++) expect(film.actions[index].start).toBe(film.actions[index - 1].end);
    expect(film.actions.at(-1).end).toBe(film.duration);
    for (const action of film.actions.filter(action => action.d)) expect(action.d.match(/M/g)).toHaveLength(1);
  }
});

it('uses exact chapter boundaries and clamps drawing to the current stroke', () => {
  const film = films.car;
  expect(chapterAt(film, film.chapters[1].start - .1)).toBe(0);
  expect(chapterAt(film, film.chapters[1].start)).toBe(1);
  expect(chapterAt(film, film.duration)).toBe(3);
  const action = film.actions.find(item => item.kind === 'stroke');
  expect(strokeProgress(action, action.start)).toBe(0);
  expect(strokeProgress(action, action.end)).toBe(1);
  expect(strokeProgress(action, action.end + 30)).toBe(1);
  expect(actionAt(film, action.start)).toBe(action);
});

describe('film clock', () => {
  it('supports play, pause, speed, seeking, replay at the end and resuming after unmount', () => {
    const { result, unmount } = renderHook(() => useFilmClock('clock-test', 120));
    act(() => { result.current.toggle(); });
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.playhead.current).toBeCloseTo(1.98, 1);
    act(() => { result.current.pause(); });
    const paused = result.current.playhead.current;
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.playhead.current).toBe(paused);
    act(() => { result.current.setSpeed(2); result.current.seek(30); result.current.toggle(); });
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.playhead.current).toBeCloseTo(33.96, 1);
    act(() => { result.current.seek(999); });
    expect(result.current.playhead.current).toBe(120);
    act(() => { vi.advanceTimersByTime(32); });
    expect(result.current.playing).toBe(false);
    act(() => { result.current.toggle(); });
    expect(result.current.playhead.current).toBe(0);
    act(() => { result.current.pause(); result.current.seek(47); });
    unmount();
    const resumed = renderHook(() => useFilmClock('clock-test', 120));
    expect(resumed.result.current.time).toBe(47);
    expect(resumed.result.current.playing).toBe(false);
  });
});

it('reveals strokes and moves the pencil to the same position after forward and backward seeks', () => {
  const film = compileFilm([[{ d: 'M10 10L110 10', duration: 10, caption: 'Из А в Б' }]]);
  const playhead = { current: 0 };
  const { container } = render(<FilmScene film={film} playhead={playhead} poster={false} showDirections closeup={false} />);
  const reveal = container.querySelector('[data-mask-for]');
  const pencil = container.querySelector('.film-pencil');
  expect(Number(reveal.style.strokeDashoffset)).toBe(100);
  playhead.current = 5;
  act(() => { vi.advanceTimersByTime(16); });
  const progress = strokeProgress(film.actions[0], 5);
  expect(Number(reveal.style.strokeDashoffset)).toBeCloseTo(100 * (1 - progress));
  const middle = pencil.getAttribute('transform');
  expect(middle).not.toBe('translate(10 10)');
  playhead.current = 10;
  act(() => { vi.advanceTimersByTime(16); });
  expect(Number(reveal.style.strokeDashoffset)).toBe(0);
  expect(pencil.getAttribute('transform')).toBe('translate(110 10)');
  playhead.current = 5;
  act(() => { vi.advanceTimersByTime(16); });
  expect(pencil.getAttribute('transform')).toBe(middle);
});

it('offers timecodes and keeps the diagram and transcript synchronized with the timeline', () => {
  const onStep = vi.fn();
  render(<SketchPlayer lesson={lessons[4]} onStep={onStep} />);
  const timeline = screen.getByRole('slider', { name: 'Таймлайн видеоурока' });
  expect(screen.getByRole('button', { name: 'Смотреть видеоурок' })).toBeTruthy();
  fireEvent.change(timeline, { target: { value: films.car.chapters[2].start + 3 } });
  expect(onStep).toHaveBeenLastCalledWith(2);
  expect(screen.getByRole('heading', { name: lessons[4].steps[2].title })).toBeTruthy();
  expect(timeline.getAttribute('aria-valuetext')).toContain(formatTime(films.car.chapters[2].start + 3));
  fireEvent.click(screen.getByRole('button', { name: 'Повторить главу' }));
  expect(Number(timeline.value)).toBe(films.car.chapters[2].start);
  fireEvent.click(screen.getByRole('button', { name: 'Вперёд на 10 секунд' }));
  expect(Number(timeline.value)).toBe(films.car.chapters[2].start + 10);
  fireEvent.click(screen.getByRole('button', { name: 'Назад на 10 секунд' }));
  expect(Number(timeline.value)).toBe(films.car.chapters[2].start);
});
