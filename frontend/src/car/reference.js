// A teaching interpretation of the supplied side-view sketch. Front points right.
export const coupeProportions = {
  rearWheel: { x: 128, y: 244, rx: 54, ry: 55 },
  frontWheel: { x: 520, y: 242, rx: 54, ry: 53 },
  ground: 298,
  wheelbase: 392,
};

export const ellipsePath = (x, y, rx, ry) => `M${x + rx} ${y}a${rx} ${ry} 0 1 0 ${-2 * rx} 0a${rx} ${ry} 0 1 0 ${2 * rx} 0`;

export const coupePaths = {
  roof: 'M18 175C96 157 157 118 246 111C308 102 359 120 410 157',
  hood: 'M405 158C491 150 579 158 628 196L645 208',
  nose: 'M645 208L639 232L640 267Q625 277 579 278',
  tail: 'M18 175L21 201Q10 215 21 232L16 249L72 273',
  shoulder: 'M24 180C141 156 278 175 405 163C485 155 578 165 630 201',
  rocker: 'M184 274Q321 267 461 278',
  rearArch: 'M69 255C65 214 83 181 126 181C165 181 190 214 186 255',
  frontArch: 'M462 254C459 212 479 181 520 181C563 181 583 213 579 257',
  glass: 'M153 151C198 125 254 113 289 117C334 119 366 143 394 160L215 158Z',
  glassPillar: 'M221 121L211 157',
  roofInner: 'M146 147C205 113 262 106 304 115C345 124 380 144 403 160',
  mirror: 'M351 156Q351 144 364 143L388 151L397 161Q373 166 355 163Z',
  door: 'M212 176Q204 215 231 264Q315 254 402 267L408 187',
  doorHandle: 'M231 187L253 188',
  sideSculpture: 'M231 248C305 247 367 249 452 265',
  sideVent: 'M410 197L454 197L465 192L446 205L415 205Z',
  frontLamp: 'M596 197L633 205L629 211L609 206Z',
  rearLamp: 'M19 179L56 181L73 189L23 185Z',
  frontIntake: 'M611 229L634 226L630 252L622 257Z',
  rearIntake: 'M21 237L40 246L47 262L18 254Z',
  frontLip: 'M579 278Q619 277 642 267',
  rearLip: 'M17 253L71 272',
  sill: 'M185 278C280 274 370 274 463 281',
  shadow: 'M26 284Q291 308 630 282Q548 302 306 304Q128 303 26 290Z',
};

export function spokePath(wheel, index, count = 6) {
  const angle = -Math.PI / 2 + index * Math.PI * 2 / count;
  const p = (radius, offset = 0) => [wheel.x + Math.cos(angle + offset) * radius, wheel.y + Math.sin(angle + offset) * radius];
  const [ax, ay] = p(8, -.13);
  const [bx, by] = p(43, -.065);
  const [cx, cy] = p(41, .11);
  const [dx, dy] = p(9, .22);
  return `M${ax.toFixed(2)} ${ay.toFixed(2)}L${bx.toFixed(2)} ${by.toFixed(2)}L${cx.toFixed(2)} ${cy.toFixed(2)}L${dx.toFixed(2)} ${dy.toFixed(2)}Z`;
}

export const coupeMilestones = [
  { title: 'Пропорции и колёса', description: 'Отмечаем землю, диаметр колеса и базу. Перед автомобиля — справа.' },
  { title: 'Масса и силуэт', description: 'Длинный капот, низкая крыша и сдвинутая назад кабина задают характер купе.' },
  { title: 'Остекление и детали', description: 'Уточняем стёкла, зеркало, арки, дверь и вентиляцию, сохраняя большую форму.' },
  { title: 'Диски, тон и подача', description: 'Прорабатываем колёса, тёмные акценты, боковую поверхность и опору на землю.' },
];
