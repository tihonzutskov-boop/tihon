// Top-view drawings of machines, as the owner sketched them: what each machine
// looks like from the ceiling, with its long side upright and its front (the
// console, the weights) at the top.
//
// Each drawing is a list of parts with a role (a pad, the frame, a bar…) in its
// own units; `u` is how many of those units make a centimetre, so lines come
// out equally thick on every machine. The zone's colour decides how a role
// looks, in three shades of it, so a machine reads as part of its zone.

export type Role = 'pad' | 'plate' | 'frame' | 'soft' | 'rail' | 'bar' | 'deck' | 'step';
export type Part = [Role, 'rect' | 'path' | 'circle' | 'ellipse', Record<string, number | string>];
export interface Drawing { size: [number, number]; u: number; parts: Part[] }

export type DrawnKind =
  | 'treadmill' | 'bike' | 'rower' | 'elliptical' | 'stairs' | 'rack' | 'bench' | 'dumbbells'
  | 'benchStation' | 'legPress' | 'smith' | 'functionalTrainer' | 'pulldown' | 'cableStation';

export const DRAWINGS: Record<Exclude<DrawnKind, 'dumbbells' | 'cableStation'>, Drawing> = {
  // The owner's sketch: the bar along the long side with a plate at each end,
  // two hooks, the bench under the bar.
  benchStation: { size: [234, 395], u: 1.75, parts: [
    ['pad', 'rect', { x: 26, y: 153, width: 67, height: 91, rx: 26 }],
    ['pad', 'rect', { x: 94, y: 164, width: 135, height: 68, rx: 22 }],
    ['bar', 'path', { d: 'M48 5V390' }],
    ['soft', 'rect', { x: 48, y: 75, width: 21, height: 22, rx: 3 }],
    ['soft', 'rect', { x: 48, y: 300, width: 21, height: 22, rx: 3 }],
    ['plate', 'rect', { x: 1, y: 8, width: 94, height: 24, rx: 10 }],
    ['plate', 'rect', { x: 1, y: 363, width: 94, height: 24, rx: 10 }]] },
  // The owner's sketch: four posts, two safety arms, a back rail, the bar with
  // its plates a little in from the ends so the bar shows past them.
  rack: { size: [245, 380], u: 1.75, parts: [
    ['rail', 'path', { d: 'M55 98H190M55 304H190' }],
    ['frame', 'rect', { x: 7, y: 74, width: 48, height: 48, rx: 4 }],
    ['frame', 'rect', { x: 190, y: 74, width: 48, height: 48, rx: 4 }],
    ['frame', 'rect', { x: 7, y: 280, width: 48, height: 48, rx: 4 }],
    ['frame', 'rect', { x: 190, y: 280, width: 48, height: 48, rx: 4 }],
    ['rail', 'path', { d: 'M30 93V311' }],
    ['bar', 'path', { d: 'M122 8V372' }],
    ['plate', 'rect', { x: 75, y: 30, width: 94, height: 24, rx: 10 }],
    ['plate', 'rect', { x: 75, y: 326, width: 94, height: 24, rx: 10 }]] },
  // The owner's sketch of the RPM Power Renegade: a station at each end with
  // two racks for the bar and two pull-up bars across, plate storage between.
  functionalTrainer: { size: [354, 922], u: 2.23, parts: [
    ['rail', 'path', { d: 'M73 6V276M281 6V276M73 646V916M281 646V916' }],
    ['bar', 'path', { d: 'M19 46H335M19 236H335M19 686H335M19 876H335' }],
    ...[46, 236, 686, 876].flatMap((y): Part[] => [3, 319].map((x): Part =>
      ['frame', 'rect', { x, y: y - 16, width: 32, height: 32, rx: 5 }])),
    ['frame', 'rect', { x: 124, y: 236, width: 106, height: 450, rx: 4 }],
    ...[305, 409, 513, 617].map((cy): Part => ['plate', 'circle', { cx: 177, cy, r: 35 }])] },
  legPress: { size: [180, 230], u: 1, parts: [
    ['rail', 'path', { d: 'M62 12V214M118 12V214' }],
    // The horns stick out past the plates, so the metal shows on both sides.
    ['bar', 'path', { d: 'M6 50H50M130 50H174' }],
    ['plate', 'rect', { x: 18, y: 24, width: 21, height: 52, rx: 6 }],
    ['plate', 'rect', { x: 141, y: 24, width: 21, height: 52, rx: 6 }],
    ['pad', 'rect', { x: 48, y: 16, width: 84, height: 66, rx: 10 }],
    ['pad', 'rect', { x: 56, y: 128, width: 68, height: 40, rx: 12 }],
    ['pad', 'rect', { x: 56, y: 172, width: 68, height: 52, rx: 14 }],
    ['bar', 'path', { d: 'M44 136V172M136 136V172' }]] },
  smith: { size: [140, 220], u: 1, parts: [
    ['rail', 'path', { d: 'M17 47H123V173H17Z' }],
    ...[[8, 38], [114, 38], [8, 164], [114, 164]].map(([x, y]): Part => ['frame', 'rect', { x, y, width: 18, height: 18, rx: 3 }]),
    ['soft', 'circle', { cx: 70, cy: 47, r: 8 }],
    ['soft', 'circle', { cx: 70, cy: 173, r: 8 }],
    ['bar', 'path', { d: 'M70 20V200' }],
    ['plate', 'rect', { x: 40, y: 6, width: 60, height: 16, rx: 6 }],
    ['plate', 'rect', { x: 40, y: 198, width: 60, height: 16, rx: 6 }]] },
  pulldown: { size: [120, 180], u: 1, parts: [
    ['rail', 'path', { d: 'M60 50V160' }],
    ['frame', 'rect', { x: 34, y: 6, width: 52, height: 44, rx: 6 }],
    ['pad', 'rect', { x: 44, y: 13, width: 32, height: 30, rx: 3 }],
    ['bar', 'path', { d: 'M8 66H112' }],
    ['pad', 'rect', { x: 28, y: 94, width: 64, height: 16, rx: 8 }],
    ['pad', 'rect', { x: 36, y: 122, width: 48, height: 46, rx: 12 }]] },
  treadmill: { size: [90, 210], u: 1, parts: [
    ['pad', 'rect', { x: 6, y: 22, width: 78, height: 184, rx: 10 }],
    ['deck', 'rect', { x: 18, y: 42, width: 54, height: 154, rx: 4 }],
    ['step', 'path', { d: 'M18 64H72M18 86H72M18 108H72M18 130H72M18 152H72M18 174H72' }],
    ['bar', 'path', { d: 'M10 26V84M80 26V84' }],
    ['frame', 'rect', { x: 3, y: 4, width: 84, height: 26, rx: 8 }],
    ['soft', 'rect', { x: 30, y: 10, width: 30, height: 12, rx: 3 }]] },
  // The owner's sketch: crank and pedals across, the handlebar's curve, the
  // saddle near the back.
  bike: { size: [293, 562], u: 4.68, parts: [
    ['bar', 'path', { d: 'M5 290H288' }],
    ['bar', 'path', { d: 'M18 90Q145 4 273 90' }],
    ['frame', 'rect', { x: 100, y: 5, width: 92, height: 55, rx: 12 }],
    ['pad', 'rect', { x: 82, y: 92, width: 131, height: 465, rx: 65 }],
    ['frame', 'ellipse', { cx: 146, cy: 467, rx: 57, ry: 85 }],
    ['pad', 'rect', { x: 29, y: 252, width: 32, height: 90, rx: 6 }],
    ['pad', 'rect', { x: 232, y: 252, width: 32, height: 90, rx: 6 }]] },
  rower: { size: [60, 240], u: 1, parts: [
    ['frame', 'rect', { x: 24, y: 40, width: 12, height: 194, rx: 6 }],
    ['pad', 'circle', { cx: 30, cy: 24, r: 22 }],
    ['soft', 'circle', { cx: 30, cy: 24, r: 9 }],
    ['pad', 'rect', { x: 4, y: 54, width: 18, height: 24, rx: 5 }],
    ['pad', 'rect', { x: 38, y: 54, width: 18, height: 24, rx: 5 }],
    ['bar', 'path', { d: 'M8 88H52' }],
    ['pad', 'rect', { x: 16, y: 134, width: 28, height: 28, rx: 8 }]] },
  // The owner's sketch: console up front, the body, the pedals and arms one
  // forward and one back, as they are mid-stride.
  elliptical: { size: [240, 557], u: 3.48, parts: [
    ['frame', 'rect', { x: 70, y: 91, width: 100, height: 460, rx: 45 }],
    ['frame', 'rect', { x: 60, y: 6, width: 120, height: 85, rx: 8 }],
    ['soft', 'rect', { x: 77, y: 46, width: 86, height: 42, rx: 6 }],
    ['pad', 'rect', { x: 5, y: 370, width: 65, height: 150, rx: 25 }],
    ['bar', 'path', { d: 'M33 250V372' }],
    ['pad', 'rect', { x: 18, y: 204, width: 47, height: 46, rx: 6 }],
    ['pad', 'rect', { x: 170, y: 300, width: 65, height: 150, rx: 25 }],
    ['bar', 'path', { d: 'M192 180V380' }],
    ['pad', 'rect', { x: 163, y: 136, width: 47, height: 44, rx: 6 }]] },
  stairs: { size: [90, 160], u: 1, parts: [
    ['pad', 'rect', { x: 6, y: 26, width: 78, height: 130, rx: 10 }],
    ['deck', 'rect', { x: 18, y: 44, width: 54, height: 102, rx: 4 }],
    ['step', 'path', { d: 'M18 64H72M18 84H72M18 104H72M18 124H72' }],
    ['bar', 'path', { d: 'M10 28V100M80 28V100' }],
    ['frame', 'rect', { x: 14, y: 4, width: 62, height: 26, rx: 8 }],
    ['soft', 'rect', { x: 32, y: 10, width: 26, height: 12, rx: 3 }]] },
  bench: { size: [60, 140], u: 1, parts: [
    ['pad', 'rect', { x: 8, y: 4, width: 44, height: 84, rx: 14 }],
    ['pad', 'rect', { x: 8, y: 92, width: 44, height: 44, rx: 14 }]] },
};

/**
 * A dumbbell rack holds as many pairs as its length fits, rather than a fixed
 * six stretched to whatever length it was placed at. `length` is in the
 * rack's own units, 80 across.
 */
export const dumbbellRack = (length: number): Drawing => {
  const L = Math.max(120, length);
  const room = L - 28 - 26;
  const pairs = Math.max(2, Math.floor(room / 39) + 1);
  const gap = room / (pairs - 1);
  const parts: Part[] = [['frame', 'rect', { x: 4, y: 4, width: 72, height: L - 8, rx: 8 }]];
  for (let i = 0; i < pairs; i++) {
    const y = 14 + i * gap;
    parts.push(['pad', 'rect', { x: 12, y, width: 16, height: 26, rx: 4 }]);
    parts.push(['pad', 'rect', { x: 52, y, width: 16, height: 26, rx: 4 }]);
    parts.push(['bar', 'path', { d: `M28 ${y + 13}H52` }]);
  }
  return { size: [80, L], u: 1, parts };
};

// ---- Colour: three shades of the zone's colour ----

export interface Palette { solid: string; frame: string; edge: string; soft: string }

const hexToHsl = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
};

/**
 * The machine's shades from its zone's colour: a mid shade for pads, a darker
 * one for the frame, near-black edges and a pale one for bars. Weak colours
 * are brought up so the shades stay apart; a grey zone stays grey.
 */
export const paletteOf = (zoneColor: string | undefined): Palette => {
  let hex = (zoneColor || '').trim();
  if (/^#[0-9a-f]{3}$/i.test(hex)) hex = '#' + hex.slice(1).split('').map(c => c + c).join('');
  if (!/^#[0-9a-f]{6}$/i.test(hex)) hex = '#64748b';
  const [h, s0] = hexToHsl(hex);
  const s = s0 < 25 ? s0 : Math.max(s0, 60);
  const hsl = (sat: number, l: number) => `hsl(${h.toFixed(0)} ${sat.toFixed(0)}% ${l}%)`;
  return { solid: hsl(s, 58), frame: hsl(s, 42), edge: hsl(s, 15), soft: hsl(Math.min(s, 95), 86) };
};

const line = (color: string, width: number) =>
  ({ fill: 'none', stroke: color, strokeWidth: width, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

/** How a part of each role is painted; `u` keeps line widths in centimetres. */
export const lookOf = (role: Role, p: Palette, u: number) => {
  switch (role) {
    case 'pad': case 'plate': return { fill: p.solid, stroke: p.edge, strokeWidth: 2.2 * u };
    case 'frame': return { fill: p.frame, stroke: p.edge, strokeWidth: 2.2 * u };
    case 'soft': return { fill: p.soft };
    case 'rail': return line(p.frame, 4.2 * u);
    case 'bar': return line(p.soft, 4.6 * u);
    case 'deck': return { fill: p.edge };
    case 'step': return { ...line(p.soft, 1.4 * u), strokeOpacity: 0.5 };
  }
};
