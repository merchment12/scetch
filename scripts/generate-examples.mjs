import { writeFileSync } from 'node:fs';
import { illustrations } from '../frontend/src/illustrations.js';
import { coupeChapters } from '../frontend/src/films/coupe.js';

const city = [
  { d: 'M65 281H600', guide: true },
  { d: 'M215 251a30 30 0 1 0 -60 0a30 30 0 1 0 60 0 M455 251a30 30 0 1 0 -60 0a30 30 0 1 0 60 0' },
  { d: 'M116 251V219L150 204L202 123Q209 111 226 111H369Q390 111 405 137L444 203L492 215L513 239V257H463 M386 257H222 M147 257H116V251 M219 200L237 126H367L410 200Z M311 126V200 M311 210V247H236', accent: true },
  { d: 'M146 251a39 39 0 0 1 78 0 M386 251a39 39 0 0 1 78 0 M162 217H203 M459 221H488 M100 289Q300 307 535 287', light: true },
];
const coupe = coupeChapters.flat().filter(action => action.d && action.kind !== 'ghost' && action.style !== 'guide');
const examples = { coupe, city, volume: illustrations.perspective.flat(), charge: illustrations.form.flat() };

for (const [name, paths] of Object.entries(examples)) {
  const content = paths.map(p => {
    const color = p.fill ? 'none' : p.style === 'marker' ? '#68616b' : p.style === 'light' || p.light ? '#a19aa4' : p.accent ? '#d63883' : p.guide ? '#bbb8c3' : '#454149';
    return `<path d="${p.d}" fill="${p.fill || 'none'}" stroke="${color}" stroke-width="${p.width || (p.guide ? 1 : name === 'coupe' ? 1.7 : 2.2)}" opacity="${p.opacity ?? 1}" ${p.guide ? 'stroke-dasharray="5 6"' : ''} stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 350"><rect width="660" height="350" fill="#faf9f5"/><defs><pattern id="g" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".6" fill="#e0dde1"/></pattern></defs><rect width="660" height="350" fill="url(#g)"/>${content}<text x="25" y="32" fill="#96909b" font-family="monospace" font-size="8" letter-spacing="2">TECHNO / DESIGN STUDY</text><text x="25" y="328" fill="#a09ba6" font-family="monospace" font-size="7" letter-spacing="1">FORM BEFORE DETAIL</text></svg>`;
  writeFileSync(new URL(`../frontend/public/sketches/${name}.svg`, import.meta.url), svg);
}
