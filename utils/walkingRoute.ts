// Walking route — the way from where the client is standing to the machine.
//
// The Locate map used to light up the destination and leave the walking to
// the client, which in a big floor meant scanning the whole map for one small
// glowing box. A drawn route answers the question they actually have — "which
// way do I go?" — and ends at the machine itself, not somewhere in its area.
//
// It is a search over a grid laid on the floor plan, shaped to look like how
// people walk in a gym rather than the geometrically shortest line:
//
//   - Walls stop it. Doors and corridors don't.
//   - Aisles are cheapest. Other areas can be crossed, since most are open
//     floor, but cost more; walled rooms like lockers or the front desk cost a
//     lot more. Machines cost most of all — walking over one is a last resort,
//     kept only so a tightly packed floor still gets a route.
//   - Each turn costs extra, so the route is a few straight legs, the way you
//     would give directions, not a staircase of tiny steps.
//   - It keeps off the edges of an aisle where it can, so the line sits down
//     the middle of a walkway instead of grazing the machines along it.

import { Gym, GymZone, GymMachine, GymWall, GymHallway } from '../types';
import { RoutePoint, RouteOption, optionPoint } from './sessionRoute';
import { isAmenityZone } from './equipmentIcons';

export interface RoutePlace {
  point: RoutePoint;
  zone?: GymZone | null;
  machine?: GymMachine | null;
}

export interface WalkingRoute {
  /**
   * Corners of the walk, from where the client is to where they stop: the side
   * of the machine they walk up to, or the middle of the area for open floor.
   * Empty when there is nothing to walk — already there, or no way through.
   */
  points: RoutePoint[];
  /** Where the pin goes: the middle of the machine, or of the area. */
  pin: RoutePoint;
  /** Already there: the same machine or spot as before, so nothing to walk. */
  arrived: boolean;
}

export interface Rect { x: number; y: number; width: number; height: number }

// Machine coordinates are relative to their zone.
export const machineRect = (zone: GymZone, machine: GymMachine): Rect => ({
  x: zone.x + machine.x, y: zone.y + machine.y, width: machine.width, height: machine.height,
});

const AISLE = 1;
const AREA = 3;
const WALLED_ROOM = 8;
const MACHINE = 40;
const TURN = 5;
const EDGE = 0.5;

// Fine enough that the gap between two machines stays open, coarse enough that
// the search stays quick on a phone: never more than this many cells a side.
const MAX_CELLS_PER_SIDE = 200;
const MIN_CELL = 2.5;

// What a person can't walk through. A door is a gap by definition; a corridor,
// staircase or lift marks a way through, not a barrier.
const BLOCKING_WALLS = new Set<GymWall['wallType']>(['exterior', 'interior', 'window']);

const inRect = (r: Rect, x: number, y: number) =>
  x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;

const clampToRect = (p: RoutePoint, r: Rect): RoutePoint => ({
  x: Math.min(Math.max(p.x, r.x), r.x + r.width),
  y: Math.min(Math.max(p.y, r.y), r.y + r.height),
});

type Segment = [RoutePoint, RoutePoint];

// Curved walls are quadratic, drawn with the midpoint as control when none is
// set — the same as the map draws them — and followed as short straight pieces.
const wallSegments = (walls: GymWall[] = []): Segment[] => {
  const out: Segment[] = [];
  for (const w of walls) {
    if (!BLOCKING_WALLS.has(w.wallType)) continue;
    if (w.type !== 'curved') {
      out.push([{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }]);
      continue;
    }
    const cx = w.controlX ?? (w.x1 + w.x2) / 2;
    const cy = w.controlY ?? (w.y1 + w.y2) / 2;
    let prev = { x: w.x1, y: w.y1 };
    for (let k = 1; k <= 12; k++) {
      const t = k / 12, u = 1 - t;
      const next = { x: u * u * w.x1 + 2 * u * t * cx + t * t * w.x2, y: u * u * w.y1 + 2 * u * t * cy + t * t * w.y2 };
      out.push([prev, next]);
      prev = next;
    }
  }
  return out;
};

const cross = (a: RoutePoint, b: RoutePoint, c: RoutePoint) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

// Whether a step crosses a wall. A wall running along the step is not crossed:
// walking beside a wall is fine.
const crosses = (p1: RoutePoint, p2: RoutePoint, q1: RoutePoint, q2: RoutePoint) => {
  const d1 = cross(q1, q2, p1), d2 = cross(q1, q2, p2);
  if (d1 === 0 && d2 === 0) return false;
  return d1 * d2 <= 0 && cross(p1, p2, q1) * cross(p1, p2, q2) <= 0;
};

const distToSegment = (p: RoutePoint, [a, b]: Segment) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

interface Grid {
  minX: number; minY: number; cell: number; nx: number; ny: number;
  cost: Float32Array;
  /** A wall between a cell and the one to its right / below it. */
  wallRight: Uint8Array;
  wallDown: Uint8Array;
}

const buildGrid = (
  gym: Pick<Gym, 'zones' | 'dimensions' | 'annexes'>,
  from: RoutePlace,
  to: RouteOption,
  pin: RoutePoint,
): Grid => {
  const dims = gym.dimensions!;
  const room: Rect = { x: dims.x || 0, y: dims.y || 0, width: dims.width, height: dims.height };
  // Areas count as floor even where they stick out past the room's walls — an
  // old layout whose room was never resized still has its zones somewhere.
  const floors: Rect[] = [room, ...(gym.annexes || []), ...gym.zones];

  let minX = Math.min(from.point.x, pin.x), minY = Math.min(from.point.y, pin.y);
  let maxX = Math.max(from.point.x, pin.x), maxY = Math.max(from.point.y, pin.y);
  for (const r of floors) {
    minX = Math.min(minX, r.x); minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width); maxY = Math.max(maxY, r.y + r.height);
  }
  const cell = Math.max(MIN_CELL, Math.max(maxX - minX, maxY - minY) / MAX_CELLS_PER_SIDE);
  minX -= cell; minY -= cell;
  const nx = Math.ceil((maxX - minX) / cell) + 1;
  const ny = Math.ceil((maxY - minY) / cell) + 1;
  const cost = new Float32Array(nx * ny).fill(Infinity);
  const cx = (i: number) => minX + (i + 0.5) * cell;
  const cy = (j: number) => minY + (j + 0.5) * cell;

  // Every cell whose centre falls in the rectangle, without visiting the rest.
  const eachCellIn = (r: Rect, fn: (c: number) => void) => {
    const i0 = Math.max(0, Math.floor((r.x - minX) / cell - 0.5));
    const i1 = Math.min(nx - 1, Math.ceil((r.x + r.width - minX) / cell - 0.5));
    const j0 = Math.max(0, Math.floor((r.y - minY) / cell - 0.5));
    const j1 = Math.min(ny - 1, Math.ceil((r.y + r.height - minY) / cell - 0.5));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        if (inRect(r, cx(i), cy(j))) fn(j * nx + i);
      }
    }
  };

  for (const r of floors) eachCellIn(r, c => { cost[c] = AISLE; });

  const isEnd = (z: GymZone) => z.id === to.zone.id || z.id === from.zone?.id;
  for (const z of gym.zones) {
    if (isEnd(z) || z.isHallway) continue;
    const price = isAmenityZone(z) ? WALLED_ROOM : AREA;
    eachCellIn(z, c => { cost[c] = Math.max(cost[c], price); });
  }

  // Drawn walkways are aisles wherever they run, unless something stands on them.
  const hallways: GymHallway[] = dims.hallways || [];
  for (const h of hallways) {
    for (let k = 1; k < h.points.length; k++) {
      const seg: Segment = [h.points[k - 1], h.points[k]];
      const half = h.width / 2;
      const box: Rect = {
        x: Math.min(seg[0].x, seg[1].x) - half, y: Math.min(seg[0].y, seg[1].y) - half,
        width: Math.abs(seg[1].x - seg[0].x) + h.width, height: Math.abs(seg[1].y - seg[0].y) + h.width,
      };
      eachCellIn(box, c => {
        if (distToSegment({ x: cx(c % nx), y: cy(Math.floor(c / nx)) }, seg) <= half && Number.isFinite(cost[c])) {
          cost[c] = Math.min(cost[c], AISLE);
        }
      });
    }
  }

  for (const z of gym.zones) {
    for (const m of z.machines || []) {
      const own = (from.machine && m.id === from.machine.id) || (to.machine && m.id === to.machine.id);
      if (!own) eachCellIn(machineRect(z, m), c => { cost[c] = Math.max(cost[c], MACHINE); });
    }
  }

  const wallRight = new Uint8Array(nx * ny);
  const wallDown = new Uint8Array(nx * ny);
  for (const seg of wallSegments(dims.walls)) {
    const box: Rect = {
      x: Math.min(seg[0].x, seg[1].x) - cell, y: Math.min(seg[0].y, seg[1].y) - cell,
      width: Math.abs(seg[1].x - seg[0].x) + 2 * cell, height: Math.abs(seg[1].y - seg[0].y) + 2 * cell,
    };
    eachCellIn(box, c => {
      const i = c % nx, j = Math.floor(c / nx);
      const here = { x: cx(i), y: cy(j) };
      if (i + 1 < nx && crosses(here, { x: cx(i + 1), y: here.y }, seg[0], seg[1])) wallRight[c] = 1;
      if (j + 1 < ny && crosses(here, { x: here.x, y: cy(j + 1) }, seg[0], seg[1])) wallDown[c] = 1;
    });
  }

  // Keep to the middle of a walkway: a cell beside anything dearer — or a wall,
  // or the edge of the floor — costs a little more than one with room around it.
  const base = cost.slice();
  for (let c = 0; c < cost.length; c++) {
    if (!Number.isFinite(base[c]) || base[c] >= MACHINE) continue;
    const i = c % nx, j = Math.floor(c / nx);
    const dearer = (n: number) => !(base[n] <= base[c]);
    if ((i + 1 >= nx || wallRight[c] || dearer(c + 1))
      || (i === 0 || wallRight[c - 1] || dearer(c - 1))
      || (j + 1 >= ny || wallDown[c] || dearer(c + nx))
      || (j === 0 || wallDown[c - nx] || dearer(c - nx))) {
      cost[c] += EDGE;
    }
  }

  return { minX, minY, cell, nx, ny, cost, wallRight, wallDown };
};

const cellAt = (g: Grid, p: RoutePoint) => {
  const i = Math.min(g.nx - 1, Math.max(0, Math.floor((p.x - g.minX) / g.cell)));
  const j = Math.min(g.ny - 1, Math.max(0, Math.floor((p.y - g.minY) / g.cell)));
  return j * g.nx + i;
};

const centre = (g: Grid, c: number): RoutePoint => ({
  x: g.minX + ((c % g.nx) + 0.5) * g.cell,
  y: g.minY + (Math.floor(c / g.nx) + 0.5) * g.cell,
});

// The nearest cell someone can stand on: for an entrance on the outside wall,
// or a machine placed slightly off the floor.
const nearestFloor = (g: Grid, p: RoutePoint) => {
  const at = cellAt(g, p);
  if (Number.isFinite(g.cost[at])) return at;
  let best = -1, bestD = Infinity;
  for (let c = 0; c < g.cost.length; c++) {
    if (!Number.isFinite(g.cost[c])) continue;
    const q = centre(g, c);
    const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
};

// Binary min-heap of search states keyed by estimated total cost.
class Heap {
  private ids: number[] = [];
  private keys: number[] = [];
  get size() { return this.ids.length; }
  push(id: number, key: number) {
    let k = this.ids.length;
    this.ids.push(id); this.keys.push(key);
    while (k > 0) {
      const parent = (k - 1) >> 1;
      if (this.keys[parent] <= key) break;
      this.ids[k] = this.ids[parent]; this.keys[k] = this.keys[parent];
      k = parent;
    }
    this.ids[k] = id; this.keys[k] = key;
  }
  pop(): number {
    const top = this.ids[0];
    const lastId = this.ids.pop()!, lastKey = this.keys.pop()!;
    const n = this.ids.length;
    if (n > 0) {
      let k = 0;
      for (;;) {
        let child = 2 * k + 1;
        if (child >= n) break;
        if (child + 1 < n && this.keys[child + 1] < this.keys[child]) child++;
        if (this.keys[child] >= lastKey) break;
        this.ids[k] = this.ids[child]; this.keys[k] = this.keys[child];
        k = child;
      }
      this.ids[k] = lastId; this.keys[k] = lastKey;
    }
    return top;
  }
}

// Steps right, down, left, up.
const DI = [1, 0, -1, 0];
const DJ = [0, 1, 0, -1];

// A* over (cell, heading) so turning can be priced. Returns the cells walked,
// start first, ending on the first goal cell reached; null when walls leave no
// way through.
const search = (g: Grid, start: number, goal: Uint8Array, useWalls: boolean): number[] | null => {
  const { nx, ny, cost } = g;
  let gi0 = nx, gi1 = -1, gj0 = ny, gj1 = -1;
  for (let c = 0; c < goal.length; c++) {
    if (!goal[c]) continue;
    const i = c % nx, j = Math.floor(c / nx);
    gi0 = Math.min(gi0, i); gi1 = Math.max(gi1, i); gj0 = Math.min(gj0, j); gj1 = Math.max(gj1, j);
  }
  if (gi1 < 0) return null;
  // Every step costs at least one, so the distance to the goal's bounding box
  // in steps never overestimates.
  const h = (c: number) => {
    const i = c % nx, j = Math.floor(c / nx);
    return Math.max(0, gi0 - i, i - gi1) + Math.max(0, gj0 - j, j - gj1);
  };

  const best = new Float64Array(nx * ny * 4).fill(Infinity);
  const parent = new Int32Array(nx * ny * 4).fill(-1);
  const done = new Uint8Array(nx * ny * 4);
  const open = new Heap();
  for (let d = 0; d < 4; d++) { best[start * 4 + d] = 0; open.push(start * 4 + d, h(start)); }

  while (open.size > 0) {
    const s = open.pop();
    if (done[s]) continue;
    done[s] = 1;
    const c = s >> 2, d = s & 3;
    if (goal[c]) {
      const cells: number[] = [];
      for (let t = s; t >= 0; t = parent[t]) cells.push(t >> 2);
      return cells.reverse();
    }
    const i = c % nx, j = Math.floor(c / nx);
    for (let d2 = 0; d2 < 4; d2++) {
      if (d2 === ((d + 2) & 3)) continue; // never straight back
      const i2 = i + DI[d2], j2 = j + DJ[d2];
      if (i2 < 0 || i2 >= nx || j2 < 0 || j2 >= ny) continue;
      const n = j2 * nx + i2;
      if (!Number.isFinite(cost[n])) continue;
      if (useWalls) {
        const blocked = d2 === 0 ? g.wallRight[c] : d2 === 2 ? g.wallRight[n] : d2 === 1 ? g.wallDown[c] : g.wallDown[n];
        if (blocked) continue;
      }
      const ns = n * 4 + d2;
      const ng = best[s] + cost[n] + (d2 === d ? 0 : TURN);
      if (ng < best[ns]) {
        best[ns] = ng;
        parent[ns] = s;
        open.push(ns, ng + h(n));
      }
    }
  }
  return null;
};

const same = (a: RoutePoint, b: RoutePoint) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;

// Corners only: drops repeated points and any point on a straight line between
// its neighbours.
const corners = (points: RoutePoint[]): RoutePoint[] => {
  const out: RoutePoint[] = [];
  for (const p of points) {
    if (out.length > 0 && same(out[out.length - 1], p)) continue;
    if (out.length >= 2 && Math.abs(cross(out[out.length - 2], out[out.length - 1], p)) < 1e-6) {
      out[out.length - 1] = p;
      continue;
    }
    out.push(p);
  }
  return out;
};

const straight = (a: RoutePoint, b: RoutePoint) => a.x === b.x || a.y === b.y;

// Moves a straight leg sideways so it lines up with a point, keeping it straight.
const shiftLeg = (a: RoutePoint, b: RoutePoint, onto: RoutePoint) => {
  if (a.x === b.x) { a.x = onto.x; b.x = onto.x; } else if (a.y === b.y) { a.y = onto.y; b.y = onto.y; }
};

// Grid cells sit up to half a cell off where the walk really starts and ends,
// which shows as a little kink at either end. Shifting the first or last
// straight leg onto that point removes it; the legs either side stay straight,
// since they meet it at a right angle.
//
// A walk that is one straight leg ends on the machine, so moving it moves
// where it meets the machine — fine while that stays on the machine's side.
const alignEnds = (points: RoutePoint[], machine: Rect | null): RoutePoint[] => {
  const p = points.map(q => ({ ...q }));
  const n = p.length;
  if (n === 3 && machine && !straight(p[0], p[1]) && straight(p[1], p[2])) {
    const [start] = p;
    const alongX = p[1].x === p[2].x && start.x >= machine.x && start.x <= machine.x + machine.width;
    const alongY = p[1].y === p[2].y && start.y >= machine.y && start.y <= machine.y + machine.height;
    if (alongX || alongY) shiftLeg(p[1], p[2], start);
    return corners(p);
  }
  if (n < 4) return p;
  if (!straight(p[0], p[1])) shiftLeg(p[1], p[2], p[0]);
  if (n >= 5 && !straight(p[n - 2], p[n - 1])) shiftLeg(p[n - 3], p[n - 2], p[n - 1]);
  return corners(p);
};

// Whether a straight run between two points crosses only floor: no machine
// other than the two ends, nothing off the floor, and no wall.
const clearRun = (g: Grid, a: RoutePoint, b: RoutePoint) => {
  const end = cellAt(g, b);
  const step = a.x === b.x ? (b.y > a.y ? g.nx : -g.nx) : (b.x > a.x ? 1 : -1);
  for (let c = cellAt(g, a), k = 0; k <= g.nx + g.ny; k++) {
    if (!(g.cost[c] < MACHINE)) return false;
    if (c === end) return true;
    const next = c + step;
    const wall = step === 1 ? g.wallRight[c] : step === -1 ? g.wallRight[next] : step > 0 ? g.wallDown[c] : g.wallDown[next];
    if (wall) return false;
    c = next;
  }
  return false;
};

// The search stops at the first bit of the machine it reaches, which is often
// a corner. Sliding the last leg along to the middle of that side — where you
// stand to use it, right under the pin — reads as "this one" far better. Only
// when the leg before runs along that side, so the slide just walks it a
// little further or less far, and only over clear floor.
const meetSquarely = (g: Grid, points: RoutePoint[], target: Rect): RoutePoint[] => {
  const n = points.length;
  if (n < 3) return points;
  const [q, p, e] = [points[n - 3], points[n - 2], points[n - 1]];
  let p2: RoutePoint, e2: RoutePoint;
  if (p.x === e.x && q.y === p.y) {
    const mid = target.x + target.width / 2;
    p2 = { x: mid, y: p.y }; e2 = { x: mid, y: e.y };
  } else if (p.y === e.y && q.x === p.x) {
    const mid = target.y + target.height / 2;
    p2 = { x: p.x, y: mid }; e2 = { x: e.x, y: mid };
  } else {
    return points;
  }
  if (!clearRun(g, p, p2) || !clearRun(g, p2, e2)) return points;
  return corners([...points.slice(0, n - 2), p2, e2]);
};

/**
 * The walk from one place to the next exercise's machine, or its area when it
 * has no single machine. Null when the gym has no floor plan to route over.
 */
export const planWalkingRoute = (
  gym: Pick<Gym, 'zones' | 'dimensions' | 'annexes'>,
  from: RoutePlace,
  to: RouteOption,
): WalkingRoute | null => {
  if (!gym.dimensions) return null;
  const pin = optionPoint(to);
  const target = to.machine ? machineRect(to.zone, to.machine) : null;
  // Already at it: the same machine as the last exercise, or the same spot.
  if (target ? inRect(target, from.point.x, from.point.y) : same(from.point, pin)) return { points: [], pin, arrived: true };

  const grid = buildGrid(gym, from, to, pin);
  const goal = new Uint8Array(grid.cost.length);
  if (target) {
    for (let c = 0; c < goal.length; c++) {
      const q = centre(grid, c);
      if (inRect(target, q.x, q.y)) { goal[c] = 1; grid.cost[c] = AISLE; }
    }
  }
  // A machine smaller than a cell holds no cell centre; open floor has only its middle.
  if (!goal.some(Boolean)) {
    const at = nearestFloor(grid, pin);
    if (at >= 0) goal[at] = 1;
  }
  const start = nearestFloor(grid, from.point);
  if (start < 0) return { points: [], pin, arrived: false };
  if (goal[start]) return { points: [], pin, arrived: true };

  // Walls drawn slightly off the room's edge can seal the entrance in; a route
  // that ignores them beats none.
  const cells = search(grid, start, goal, true) || search(grid, start, goal, false);
  if (!cells) return { points: [], pin, arrived: false };

  let end = pin;
  let walked = cells;
  if (target) {
    // Stop at the side of the machine: the last step is the one onto it.
    walked = cells.slice(0, -1);
    end = clampToRect(walked.length > 0 ? centre(grid, walked[walked.length - 1]) : from.point, target);
  }
  let points = corners([from.point, ...walked.map(c => centre(grid, c)), end]);
  if (target) points = meetSquarely(grid, points, target);
  return { points: alignEnds(points, target), pin, arrived: false };
};

// How far the walk is, along the route drawn — not as the crow flies.
export const walkLength = (points: RoutePoint[]): number =>
  points.slice(1).reduce((sum, p, k) => sum + Math.hypot(p.x - points[k].x, p.y - points[k].y), 0);

/**
 * Of several copies of the same machine, the one with the shortest walk from
 * where the client is. A straight line can't see walls or rows of machines: the
 * copy just the other side of a wall looks nearest and is the furthest walk.
 * Without a floor plan to walk — or no way through to any of them — the
 * nearest in a straight line. Ties keep the order given, so the same floor
 * always gives the same answer.
 */
export const nearestByWalk = (
  gym: Pick<Gym, 'zones' | 'dimensions' | 'annexes'>,
  from: RoutePlace,
  options: RouteOption[],
): number => {
  if (options.length < 2) return 0;
  const lengths = options.map(option => {
    const walk = planWalkingRoute(gym, from, option);
    if (!walk) return NaN;
    return walk.arrived ? 0 : walk.points.length > 1 ? walkLength(walk.points) : Infinity;
  });
  const walkable = lengths.some(l => Number.isFinite(l));
  const crowFlies = (o: RouteOption) => {
    const p = optionPoint(o);
    return Math.hypot(p.x - from.point.x, p.y - from.point.y);
  };
  let best = 0;
  options.forEach((option, k) => {
    const length = walkable ? lengths[k] : crowFlies(option);
    const bestSoFar = walkable ? lengths[best] : crowFlies(options[best]);
    if (length < bestSoFar) best = k;
  });
  return best;
};

export interface WalkStop {
  /** Where this exercise sends the client, or null when nowhere on the map. */
  place: RouteOption | null;
  /** The other copies of the same thing not marked busy, for when that one is taken. */
  others: RouteOption[];
  /** Copies the client marked busy. */
  busy: RouteOption[];
  /** Where they are standing as it starts: the last place they were sent, or the entrance. */
  from: RoutePlace | null;
}

// Names one copy of a machine, or an area, for marking it busy.
export const optionKey = (option: RouteOption): string => `${option.zone.id}/${option.machine?.id ?? ''}`;

/**
 * The session walked in order: each exercise sent to the copy of its machine
 * with the shortest walk from wherever the one before left the client, so the
 * pin always lands on the copy nearest the "you are here" shown with it. An
 * exercise that sends them nowhere — a follow-along video — leaves them where
 * they were.
 *
 * Copies the client found taken (`busy`, by optionKey) are passed over for the
 * next closest, and the session carries on from wherever they went instead.
 * With every copy marked busy there is nothing better to offer, so it goes
 * back to the closest.
 */
export const planSessionWalk = (
  gym: Pick<Gym, 'zones' | 'dimensions' | 'annexes'>,
  entrance: RoutePoint | null,
  exercises: { options: RouteOption[]; travels: boolean; busy?: string[] }[],
): WalkStop[] => {
  let at: RoutePlace | null = entrance ? { point: entrance } : null;
  return exercises.map(({ options, travels, busy = [] }) => {
    const from = at;
    if (options.length === 0) return { place: null, others: [], busy: [], from };
    const isBusy = (o: RouteOption) => busy.includes(optionKey(o));
    const free = options.filter(o => !isBusy(o));
    const pool = free.length > 0 ? free : options;
    const place = pool[from ? nearestByWalk(gym, from, pool) : 0];
    if (travels) at = { point: optionPoint(place), zone: place.zone, machine: place.machine };
    return {
      place,
      others: free.filter(o => o !== place),
      busy: options.filter(o => o !== place && isBusy(o)),
      from,
    };
  });
};
