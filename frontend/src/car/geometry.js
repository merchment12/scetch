// Lightweight original 3D teaching mesh, not a reconstruction of the unseen surfaces.
const TAU = Math.PI * 2;
const mix = (a, b, t) => a + (b - a) * t;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

const profile = [
  [-3.16, 1.02, .68], [-2.7, 1.25, .82], [-2, 1.4, .93],
  [-1.1, 1.43, .91], [0, 1.39, .89], [1.1, 1.42, .91],
  [2, 1.36, .94], [2.75, 1.14, .82], [3.15, .9, .67],
];

function section(x) {
  const index = Math.max(0, profile.findLastIndex(row => row[0] <= x));
  const a = profile[index];
  const b = profile[Math.min(index + 1, profile.length - 1)];
  const t = a === b ? 0 : (x - a[0]) / (b[0] - a[0]);
  return { height: mix(a[1], b[1], t), width: mix(a[2], b[2], t) };
}

function sideBottom(x) {
  let y = .27;
  for (const center of [-2, 2]) {
    const dx = x - center;
    if (Math.abs(dx) < .69) y = Math.max(y, .59 + Math.sqrt(.69 ** 2 - dx ** 2));
  }
  return y;
}

export function buildCoupeMesh(stage = 3) {
  const faces = [];
  const face = (points, color, part, line = false) => faces.push({ points, color, part, line });
  for (const x of [-2, 2]) for (const side of [-1, 1]) {
    const firstFace = faces.length;
    const near = side * 1.065;
    const far = side * .81;
    const circlePoint = (angle, radius, z) => [x + Math.cos(angle) * radius, .59 + Math.sin(angle) * radius, z];
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * TAU;
      const b = (i + 1) / 24 * TAU;
      face([circlePoint(a, .59, near), circlePoint(b, .59, near), circlePoint(b, .59, far), circlePoint(a, .59, far)], '#34333a', 'tyre');
      face([circlePoint(a, .59, near), circlePoint(b, .59, near), circlePoint(b, .44, near), circlePoint(a, .44, near)], '#29282e', 'tyre');
      face([[x, .59, near], circlePoint(a, .44, near), circlePoint(b, .44, near)], '#74747c', 'wheel');
    }
    if (stage >= 3) for (let i = 0; i < 6; i++) {
      const angle = i / 6 * TAU;
      const z = near + side * .008;
      face([circlePoint(angle - .11, .07, z), circlePoint(angle - .06, .43, z), circlePoint(angle + .1, .42, z), circlePoint(angle + .25, .08, z)], '#e1dfd9', 'spoke');
    }
    for (const wheelFace of faces.slice(firstFace)) {
      wheelFace.sortAnchor = [x, .59, side * .96];
      wheelFace.layer = wheelFace.part === 'spoke' ? 3 : wheelFace.part === 'wheel' ? 2 : 1;
    }
  }
  if (stage >= 1) {
    const count = 64;
    for (let i = 0; i < count; i++) {
      const x1 = mix(-3.16, 3.15, i / count);
      const x2 = mix(-3.16, 3.15, (i + 1) / count);
      const a = section(x1); const b = section(x2);
      for (const side of [-1, 1]) {
        face([[x1, sideBottom(x1), side * a.width], [x2, sideBottom(x2), side * b.width], [x2, b.height, side * b.width], [x1, a.height, side * a.width]], '#d0ccc5', 'body');
      }
      const cuts = [-1, -.7, 0, .7, 1];
      for (let j = 0; j < cuts.length - 1; j++) {
        const k1 = cuts[j]; const k2 = cuts[j + 1];
        const point = (x, row, k) => [x, row.height + .07 * (1 - k * k), k * row.width];
        face([point(x1, a, k1), point(x2, b, k1), point(x2, b, k2), point(x1, a, k2)], '#e7e3db', 'body');
      }
    }
    for (const x of [-3.16, 3.15]) {
      const s = section(x);
      face([[x, .29, -s.width], [x, .29, s.width], [x, s.height, s.width], [x, s.height, -s.width]], '#b7b2ad', 'body');
    }
  }
  if (stage >= 2) {
    const cabin = [[-2.15, 1.43, .78], [-1.15, 2.02, .66], [-.3, 2.04, .64], [.7, 1.44, .78]];
    for (let i = 0; i < cabin.length - 1; i++) {
      const [x1, y1, w1] = cabin[i];
      const [x2, y2, w2] = cabin[i + 1];
      for (const side of [-1, 1]) {
        face([[x1, section(x1).height, side * .81], [x2, section(x2).height, side * .81], [x2, y2, side * w2], [x1, y1, side * w1]], '#777780', 'glass');
      }
      face([[x1, y1, -w1], [x2, y2, -w2], [x2, y2, w2], [x1, y1, w1]], i === 1 ? '#dedad3' : '#6c6d77', i === 1 ? 'roof' : 'glass');
    }
    for (const side of [-1, 1]) {
      face([[-1.12, 1.45, side * .82], [-1.08, 1.45, side * .82], [-1.08, 2.02, side * .665], [-1.12, 2.02, side * .665]], '#49464c', 'pillar');
      face([[.34, 1.46, side * .81], [.53, 1.5, side * 1.06], [.31, 1.59, side * 1.04], [.16, 1.56, side * .87]], '#c7c3be', 'mirror');
    }
  }
  if (stage >= 3) {
    for (const side of [-1, 1]) {
      face([[.83, .98, side * .916], [1.27, .98, side * .93], [1.16, .9, side * .93], [.87, .91, side * .919]], '#424047', 'vent');
      face([[-1.28, .4, side * .92], [1.28, .4, side * .92], [1.35, .31, side * .9], [-1.32, .31, side * .9]], '#69636b', 'sill');
      face([[2.8, 1.09, side * .81], [3.12, .96, side * .67], [3.12, .91, side * .67], [2.84, 1.03, side * .8]], '#4e4c55', 'lamp');
    }
    face([[3.154, .42, -.43], [3.154, .42, .43], [3.154, .69, .48], [3.154, .69, -.48]], '#38363d', 'intake');
  }
  return faces;
}

export function projectPoint(point, { yaw, pitch, zoom = 1, orthographic = false }) {
  const [x, y, z] = point;
  const rx = x * Math.cos(yaw) + z * Math.sin(yaw);
  const rz = -x * Math.sin(yaw) + z * Math.cos(yaw);
  const ry = (y - .85) * Math.cos(pitch) - rz * Math.sin(pitch);
  const depth = (y - .85) * Math.sin(pitch) + rz * Math.cos(pitch);
  const factor = (orthographic ? 1 : 9.5 / (9.5 - depth)) * 85 * zoom;
  return { x: 380 + rx * factor, y: 245 - ry * factor, depth };
}

function shade(color, points) {
  const a = points[0]; const b = points[1]; const c = points[2];
  const u = b.map((v, i) => v - a[i]); const v = c.map((n, i) => n - a[i]);
  const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const length = Math.hypot(...normal) || 1;
  const light = Math.abs((normal[0] * -.25 + normal[1] * .85 + normal[2] * .45) / length);
  const intensity = .73 + light * .28;
  const rgb = [1, 3, 5].map(i => clamp(Math.round(parseInt(color.slice(i, i + 2), 16) * intensity), 0, 255));
  return `rgb(${rgb.join(',')})`;
}

export function projectMesh(mesh, camera) {
  return mesh.map((face, id) => {
    const projected = face.points.map(point => projectPoint(point, camera));
    const depth = face.sortAnchor ? projectPoint(face.sortAnchor, camera).depth + face.layer * .00001 : projected.reduce((sum, p) => sum + p.depth, 0) / projected.length;
    return { id, part: face.part, points: projected.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '), depth, fill: shade(face.color, face.points) };
  }).sort((a, b) => a.depth - b.depth);
}
