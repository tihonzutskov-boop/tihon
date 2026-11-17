// A cable station built from weight towers and seats, as the owner sketched it.
//
// A tower is a frame with a post at each corner and four weight stacks, one
// facing each side. Towers sit on a grid; every tower but the first hangs off
// another by a pull-up bar, so a station can run in a line or branch into an
// L, a T or a cross. Each free side of a tower can take a pulldown seat or a
// low-row bench, or a new tower. The station's real size follows from all
// that, so the map always shows it at the size it really is.
//
// Drawing units are 2.09 to the centimetre, the scale of the owner's sketch:
// a tower is 310 × 272 inside its posts and a pull-up bar 707 long.

import { CableLayout, CableSeat, CableSide, CableTower } from '../types';
import { Drawing, Part } from './machineDrawings';
import type { RealSize } from './machineSizes';

const U = 2.09;
const W = 310, H = 272, GAP = 707;
export const MAX_TOWERS = 6;

export const SIDES: CableSide[] = ['top', 'left', 'right', 'bottom'];
const STEP: Record<CableSide, [number, number]> = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE: Record<CableSide, CableSide> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

/** What a side of a tower can hold. */
export type SideChoice = '' | CableSeat | 'tower';

export const SEAT_NAMES: Record<CableSeat, string> = { pulldown: 'Pulldown seat', row: 'Row bench' };

/** The owner's sketch: two towers, the pulldown seat and the row bench at the second. */
export const DEFAULT_CABLE_LAYOUT: CableLayout = {
  towers: [{ id: 0, gx: 0, gy: 0 }, { id: 1, gx: 0, gy: 1, parent: 0, side: 'bottom' }],
  stations: { '1:left': 'pulldown', '1:right': 'row' },
};

type Box = { x: number; y: number; width: number; height: number };

const towerParts = (x: number, y: number): Part[] => [
  ['rail', 'path', { d: `M${x} ${y}H${x + W}V${y + H}H${x}Z` }],
  ...[[-17, -17], [293, -17], [-17, 255], [293, 255]].map(([dx, dy]): Part =>
    ['frame', 'rect', { x: x + dx, y: y + dy, width: 34, height: 34, rx: 5 }]),
  ['pad', 'rect', { x: x + 77, y: y + 20, width: 156, height: 40, rx: 10 }],
  ['pad', 'rect', { x: x + 77, y: y + 212, width: 156, height: 40, rx: 10 }],
  ['pad', 'rect', { x: x + 20, y: y + 78, width: 40, height: 116, rx: 10 }],
  ['pad', 'rect', { x: x + 250, y: y + 78, width: 40, height: 116, rx: 10 }],
];

// A seat's parts as [role, distance out from the tower side (from, to), along the side (from, to), rx].
const SEATS: Record<CableSeat, ['pad' | 'frame', number, number, number, number, number][]> = {
  pulldown: [['pad', 92, 170, -58, 58, 30], ['pad', 54, 92, -67, 67, 12]],
  row: [['frame', 18, 56, -58, 58, 10], ['pad', 73, 344, -39, 39, 39]],
};
const EMPTY_SLOT: [number, number, number, number] = [18, 170, -67, 67];

/** A box measured out from one side of the tower at (x, y). */
const sideBox = (x: number, y: number, side: CableSide, d0: number, d1: number, t0: number, t1: number): Box => {
  const cx = x + W / 2, cy = y + H / 2;
  if (side === 'right') return { x: x + W + d0, y: cy + t0, width: d1 - d0, height: t1 - t0 };
  if (side === 'left') return { x: x - d1, y: cy + t0, width: d1 - d0, height: t1 - t0 };
  if (side === 'top') return { x: cx + t0, y: y - d1, width: t1 - t0, height: d1 - d0 };
  return { x: cx + t0, y: y + H + d0, width: t1 - t0, height: d1 - d0 };
};

const towerXY = (t: Pick<CableTower, 'gx' | 'gy'>): [number, number] => [t.gx * (W + GAP), t.gy * (H + GAP)];
const byId = (layout: CableLayout, id: number) => layout.towers.find(t => t.id === id);
const parseKey = (key: string): [number, CableSide] => {
  const [id, side] = key.split(':');
  return [Number(id), side as CableSide];
};
export const childAt = (layout: CableLayout, id: number, side: CableSide) =>
  layout.towers.find(t => t.parent === id && t.side === side);

/** A tower and every tower that hangs off it, however far out. */
const branch = (layout: CableLayout, id: number): number[] => {
  const ids = [id];
  for (let i = 0; i < ids.length; i++) layout.towers.forEach(t => { if (t.parent === ids[i]) ids.push(t.id); });
  return ids;
};

/** What is on a side now: a seat, a tower hanging off it, or nothing. */
export const choiceAt = (layout: CableLayout, key: string): SideChoice => {
  const [id, side] = parseKey(key);
  return childAt(layout, id, side) ? 'tower' : layout.stations[key] || '';
};

/** Every side a seat or tower can go on: all but the side a tower hangs from. */
export const sidesOf = (layout: CableLayout): string[] => layout.towers.flatMap(t =>
  SIDES.filter(side => !(t.parent != null && t.side && side === OPPOSITE[t.side])).map(side => `${t.id}:${side}`));

/** Everything that takes floor space, so a new seat or tower can't run into it. */
const footprint = (layout: CableLayout) => {
  const out: { tower: number; key?: string; box: Box }[] = [];
  layout.towers.forEach(t => {
    const [x, y] = towerXY(t);
    out.push({ tower: t.id, box: { x: x - 17, y: y - 17, width: W + 34, height: H + 34 } });
    const parent = t.parent != null ? byId(layout, t.parent) : undefined;
    if (parent && t.side) {
      const [px, py] = towerXY(parent);
      out.push({ tower: t.id, box: sideBox(px, py, t.side, 20, GAP - 20, -5, 5) });
    }
  });
  Object.entries(layout.stations).forEach(([key, seat]) => {
    const [id, side] = parseKey(key);
    const t = byId(layout, id);
    if (!t) return;
    const [x, y] = towerXY(t);
    SEATS[seat].forEach(([, d0, d1, t0, t1]) => out.push({ tower: id, key, box: sideBox(x, y, side, d0, d1, t0, t1) }));
  });
  return out;
};

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Whether a side has room for a seat or a new tower, once what is there now is cleared. */
export const fits = (layout: CableLayout, key: string, choice: SideChoice): boolean => {
  if (!choice) return true;
  const [id, side] = parseKey(key);
  const t = byId(layout, id);
  if (!t) return false;
  const [x, y] = towerXY(t);
  const child = childAt(layout, id, side);
  const gone = child ? branch(layout, child.id) : [];
  const others = footprint(layout).filter(f => f.key !== key && !gone.includes(f.tower));
  let boxes: Box[];
  if (choice === 'tower') {
    if (layout.towers.length - gone.length >= MAX_TOWERS) return false;
    const [nx, ny] = towerXY({ gx: t.gx + STEP[side][0], gy: t.gy + STEP[side][1] });
    boxes = [{ x: nx - 17, y: ny - 17, width: W + 34, height: H + 34 }, sideBox(x, y, side, 20, GAP - 20, -5, 5)];
  } else {
    boxes = SEATS[choice].map(([, d0, d1, t0, t1]) => sideBox(x, y, side, d0, d1, t0, t1));
  }
  return !boxes.some(b => others.some(f => overlaps(b, f.box)));
};

/** The layout with a side cleared, and anything beyond it with it, then given the choice. */
export const setSide = (layout: CableLayout, key: string, choice: SideChoice): CableLayout => {
  const [id, side] = parseKey(key);
  const child = childAt(layout, id, side);
  const gone = child ? branch(layout, child.id) : [];
  const towers = layout.towers.filter(t => !gone.includes(t.id));
  const stations = Object.fromEntries(Object.entries(layout.stations)
    .filter(([k]) => k !== key && !gone.includes(parseKey(k)[0])));
  const t = byId(layout, id);
  if (choice === 'tower') {
    if (t) towers.push({ id: Math.max(...layout.towers.map(x => x.id)) + 1, gx: t.gx + STEP[side][0], gy: t.gy + STEP[side][1], parent: id, side });
  } else if (choice) {
    stations[key] = choice;
  }
  return { towers, stations };
};

/** A stored layout, checked; anything that doesn't hold together falls back to the sketch's. */
export const readCableLayout = (raw: unknown): CableLayout => {
  const l = raw as CableLayout | undefined;
  if (!l || !Array.isArray(l.towers) || !l.towers.length || typeof l.stations !== 'object' || !l.stations) return DEFAULT_CABLE_LAYOUT;
  // Each tower after the first hangs off one listed before it.
  const towers = l.towers.slice(0, MAX_TOWERS);
  const ids = new Set<number>();
  for (const t of towers) {
    if (!t || ![t.id, t.gx, t.gy].every(Number.isInteger) || ids.has(t.id)) return DEFAULT_CABLE_LAYOUT;
    if (ids.size && (t.parent == null || !ids.has(t.parent) || !t.side || !STEP[t.side])) return DEFAULT_CABLE_LAYOUT;
    ids.add(t.id);
  }
  const layout: CableLayout = { towers, stations: {} };
  const open = new Set(sidesOf(layout));
  for (const [key, seat] of Object.entries(l.stations)) {
    if (open.has(key) && SEATS[seat]) layout.stations[key] = seat;
  }
  return layout;
};

/** The station drawn from above, its parts placed so the drawing starts at (6, 6). */
export const cableStationDrawing = (layout: CableLayout): Drawing & { offset: [number, number] } => {
  const build = (ox: number, oy: number): Part[] => {
    const parts: Part[] = [];
    layout.towers.forEach(t => {
      const parent = t.parent != null ? byId(layout, t.parent) : undefined;
      if (!parent || !t.side) return;
      const [px, py] = towerXY(parent);
      const b = sideBox(px + ox, py + oy, t.side, 0, GAP, 0, 0);
      // The pull-up bar between the two towers, drawn like the other bars you hold.
      parts.push(['bar', 'path', { d: `M${b.x} ${b.y}L${b.x + b.width} ${b.y + b.height}` }]);
    });
    layout.towers.forEach(t => { const [x, y] = towerXY(t); parts.push(...towerParts(x + ox, y + oy)); });
    Object.entries(layout.stations).forEach(([key, seat]) => {
      const [id, side] = parseKey(key);
      const t = byId(layout, id);
      if (!t) return;
      const [x, y] = towerXY(t);
      SEATS[seat].forEach(([role, d0, d1, t0, t1, rx]) =>
        parts.push([role, 'rect', { ...sideBox(x + ox, y + oy, side, d0, d1, t0, t1), rx }]));
    });
    return parts;
  };
  const boxes = build(0, 0).filter(([, tag]) => tag === 'rect').map(([, , a]) => a as unknown as Box);
  const minX = Math.min(...boxes.map(b => b.x)), maxX = Math.max(...boxes.map(b => b.x + b.width));
  const minY = Math.min(...boxes.map(b => b.y)), maxY = Math.max(...boxes.map(b => b.y + b.height));
  const offset: [number, number] = [6 - minX, 6 - minY];
  return { size: [maxX - minX + 12, maxY - minY + 12], u: U, parts: build(...offset), offset };
};

/** The station's real size in metres, to the nearest 10 cm, as drawn (not sorted short to long). */
export const cableStationExtent = (layout: CableLayout): [number, number] => {
  const [w, h] = cableStationDrawing(layout).size;
  return [Math.round(w / U / 10) / 10, Math.round(h / U / 10) / 10];
};

export const cableStationSize = (layout: CableLayout): RealSize => {
  const [a, b] = cableStationExtent(layout);
  return { width: Math.min(a, b), length: Math.max(a, b) };
};

/**
 * Where each side's + or seat sits in the drawing, for picking it: around the
 * seat when it has one, along the pull-up bar when a tower hangs off it.
 */
export const sideBoxes = (layout: CableLayout): { key: string; choice: SideChoice; box: Box }[] => {
  const [ox, oy] = cableStationDrawing(layout).offset;
  return sidesOf(layout).map(key => {
    const [id, side] = parseKey(key);
    const t = byId(layout, id)!;
    const [x, y] = towerXY(t);
    const choice = choiceAt(layout, key);
    let r: [number, number, number, number] = EMPTY_SLOT;
    if (choice === 'tower') r = [18, GAP - 18, -67, 67];
    else if (choice) {
      const seat = SEATS[choice];
      r = [Math.min(...seat.map(s => s[1])), Math.max(...seat.map(s => s[2])), Math.min(...seat.map(s => s[3])), Math.max(...seat.map(s => s[4]))];
    }
    const box = sideBox(x + ox, y + oy, side, ...r);
    return { key, choice, box };
  });
};

/** Where each tower's middle is in the drawing, for its number. */
export const towerCentres = (layout: CableLayout): [number, number][] => {
  const [ox, oy] = cableStationDrawing(layout).offset;
  return layout.towers.map(t => { const [x, y] = towerXY(t); return [x + ox + W / 2, y + oy + H / 2]; });
};

export const sideLabel = (layout: CableLayout, key: string): string => {
  const [id, side] = parseKey(key);
  return `Tower ${layout.towers.findIndex(t => t.id === id) + 1}, ${side} side`;
};
