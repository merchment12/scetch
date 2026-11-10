import React from 'react';
import { expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildCoupeMesh, projectMesh, projectPoint } from '../frontend/src/car/geometry';
import { coupePaths, coupeProportions } from '../frontend/src/car/reference';
import { films } from '../frontend/src/films/lessons';
import CarVolume from '../frontend/src/components/CarVolume';
import ReferenceProject from '../frontend/src/components/ReferenceProject';

it('progresses from wheels to body, cabin and details with valid 3D geometry from every view', () => {
  const counts = [0, 1, 2, 3].map(stage => buildCoupeMesh(stage).length);
  expect(counts[1]).toBeGreaterThan(counts[0]);
  expect(counts[2]).toBeGreaterThan(counts[1]);
  expect(counts[3]).toBeGreaterThan(counts[2]);
  expect(buildCoupeMesh(0).every(face => ['wheel', 'tyre'].includes(face.part))).toBe(true);
  expect(buildCoupeMesh(1).some(face => face.part === 'glass')).toBe(false);
  expect(buildCoupeMesh(2).some(face => face.part === 'glass')).toBe(true);
  const mesh = buildCoupeMesh(3);
  expect(mesh.filter(face => face.part === 'spoke')).toHaveLength(24);
  for (const yaw of [-Math.PI, -Math.PI / 2, -.55, 0, Math.PI / 2, Math.PI]) {
    const projected = projectMesh(mesh, { yaw, pitch: .23, zoom: 1 });
    for (let i = 0; i < projected.length; i++) {
      expect(Number.isFinite(projected[i].depth)).toBe(true);
      expect(projected[i].points).not.toMatch(/NaN|Infinity/);
      if (i) expect(projected[i].depth).toBeGreaterThanOrEqual(projected[i - 1].depth);
    }
  }
  const side = { yaw: 0, pitch: 0, zoom: 1, orthographic: true };
  expect(projectPoint([2, .59, -1], side).x).toBe(projectPoint([2, .59, 1], side).x);
});

it('teaches the supplied coupe orientation, proportion and detailed finish throughout the last film', () => {
  const film = films.car;
  expect(film.revision).toBe('reference-coupe-v1');
  expect(film.actions.length).toBeGreaterThan(70);
  expect(coupeProportions.frontWheel.x).toBeGreaterThan(coupeProportions.rearWheel.x);
  expect(coupeProportions.wheelbase / (coupeProportions.frontWheel.rx * 2)).toBeCloseTo(3.63, 1);
  for (const d of [coupePaths.roof, coupePaths.hood, coupePaths.glass, coupePaths.door, coupePaths.frontIntake, coupePaths.sill, coupePaths.shadow]) expect(film.actions.some(action => action.d === d)).toBe(true);
  expect(film.actions.some(action => action.fill)).toBe(true);
});

it('rotates the model with presets and keyboard, and synchronizes construction with the chapter', async () => {
  const user = userEvent.setup();
  const { container, rerender } = render(<CarVolume chapter={0} />);
  expect(container.querySelector('[data-part=body]')).toBeNull();
  rerender(<CarVolume chapter={2} />);
  expect(container.querySelector('[data-part=body]')).toBeTruthy();
  expect(container.querySelector('[data-part=glass]')).toBeTruthy();
  const before = container.querySelector('[data-part=body]').getAttribute('points');
  await user.click(screen.getByRole('button', { name: 'Спереди' }));
  expect(container.querySelector('[data-part=body]').getAttribute('points')).not.toBe(before);
  const front = container.querySelector('[data-part=body]').getAttribute('points');
  fireEvent.keyDown(screen.getByRole('img', { name: 'Вращаемая 3D-схема спортивного купе' }), { key: 'ArrowRight' });
  expect(container.querySelector('[data-part=body]').getAttribute('points')).not.toBe(front);
  await user.selectOptions(screen.getByRole('combobox', { name: 'Этап объёмной схемы' }), '0');
  expect(container.querySelector('[data-part=body]')).toBeNull();
  await user.selectOptions(screen.getByRole('combobox', { name: 'Этап объёмной схемы' }), 'auto');
  expect(container.querySelector('[data-part=glass]')).toBeTruthy();
});

it('shows the project target and provides an optional rotatable volume view without replacing the lesson', async () => {
  const user = userEvent.setup();
  const onChapter = vi.fn();
  render(<ReferenceProject chapter={1} onChapter={onChapter} />);
  expect(screen.getByRole('img', { name: /Учебная интерпретация присланного референса/ })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Повернуть в 3D' }));
  expect(screen.getByRole('img', { name: 'Вращаемая 3D-схема спортивного купе' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: /03 Остекление и детали/ }));
  expect(onChapter).toHaveBeenCalledWith(2);
});
