// Lining a machine up with its neighbours as it's dragged, without stopping it
// going anywhere else.
//
// Within `reach` of lining up, a machine snaps into line: its side, middle or
// end level with another machine's, or the same gap from its neighbour as the
// next-door pair in its row or column has. Out of reach it stays where it was
// put. Each axis snaps on its own, so a treadmill can take a row's spacing
// across and its neighbour's front up and down. Everything is in the zone's
// map units.

export type Box = { x: number; y: number; width: number; height: number };

/** What a machine lined up with, to draw: a shared edge, or a gap with its size. */
export interface Guide { x1: number; y1: number; x2: number; y2: number; gap?: number }

export interface Snapped {
  /** Where it lines up, per axis; null where nothing was in reach. */
  x: number | null;
  y: number | null;
  /** What it lined up with, for the guides; worked out by `guidesFor` once it's placed. */
  hits: { x: Hit | null; y: Hit | null };
}

type Hit =
  | { kind: 'edge'; at: number; other: Box }
  | { kind: 'gap'; size: number; pair: [Box, Box]; next: Box; after: boolean };

const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;

// Next-door pairs along one axis: each machine and the nearest one past it, among those it shares a row (or column) with.
const neighbourGaps = (others: Box[], axis: 'x' | 'y'): { pair: [Box, Box]; size: number }[] => {
  const all: { pair: [Box, Box]; size: number }[] = [];
  others.forEach(a => others.forEach(b => {
    if (a === b) return;
    if (axis === 'x' && overlaps(a.y, a.y + a.height, b.y, b.y + b.height) && b.x >= a.x + a.width) all.push({ pair: [a, b], size: b.x - a.x - a.width });
    if (axis === 'y' && overlaps(a.x, a.x + a.width, b.x, b.x + b.width) && b.y >= a.y + a.height) all.push({ pair: [a, b], size: b.y - a.y - a.height });
  }));
  return all.filter(g => !all.some(h => h.pair[0] === g.pair[0] && h.size < g.size));
};

/**
 * Where a machine dragged to `at` lines up with the `others`, if anything is
 * within `reach`. Gaps count from `minGap` to `maxGap`, so touching machines
 * and ones across the room don't set a spacing.
 */
export const lineUp = (at: Box, others: Box[], reach: number, minGap: number, maxGap: number): Snapped => {
  const best: { x: { d: number; v: number; hit: Hit } | null; y: { d: number; v: number; hit: Hit } | null } = { x: null, y: null };
  const consider = (axis: 'x' | 'y', v: number, hit: Hit) => {
    const d = Math.abs(v - at[axis]);
    if (d <= reach && (!best[axis] || d < best[axis]!.d)) best[axis] = { d, v, hit };
  };
  const { width: w, height: h } = at;
  others.forEach(o => {
    // Left, middle and right against the other's left, middle and right, and side by side.
    [[0, 0], [w / 2, o.width / 2], [w, o.width], [0, o.width], [w, 0]].forEach(([mine, theirs]) =>
      consider('x', o.x + theirs - mine, { kind: 'edge', at: o.x + theirs, other: o }));
    [[0, 0], [h / 2, o.height / 2], [h, o.height], [0, o.height], [h, 0]].forEach(([mine, theirs]) =>
      consider('y', o.y + theirs - mine, { kind: 'edge', at: o.y + theirs, other: o }));
  });
  const useful = (g: { size: number }) => g.size >= minGap && g.size <= maxGap;
  const rowGaps = neighbourGaps(others, 'x').filter(useful), colGaps = neighbourGaps(others, 'y').filter(useful);
  others.forEach(o => {
    if (overlaps(at.y, at.y + h, o.y, o.y + o.height)) rowGaps.forEach(({ pair, size }) => {
      consider('x', o.x + o.width + size, { kind: 'gap', size, pair, next: o, after: true });
      consider('x', o.x - size - w, { kind: 'gap', size, pair, next: o, after: false });
    });
    if (overlaps(at.x, at.x + w, o.x, o.x + o.width)) colGaps.forEach(({ pair, size }) => {
      consider('y', o.y + o.height + size, { kind: 'gap', size, pair, next: o, after: true });
      consider('y', o.y - size - h, { kind: 'gap', size, pair, next: o, after: false });
    });
  });
  return { x: best.x?.v ?? null, y: best.y?.v ?? null, hits: { x: best.x?.hit ?? null, y: best.y?.hit ?? null } };
};

/** The guides to draw for a machine placed at `placed`: each edge it shares, and each equal gap. */
export const guidesFor = (placed: Box, hits: Snapped['hits'], overhang: number): Guide[] => {
  const out: Guide[] = [];
  const midY = (b: Box) => b.y + b.height / 2, midX = (b: Box) => b.x + b.width / 2;
  (['x', 'y'] as const).forEach(axis => {
    const hit = hits[axis];
    if (!hit) return;
    if (hit.kind === 'edge') {
      const o = hit.other;
      out.push(axis === 'x'
        ? { x1: hit.at, x2: hit.at, y1: Math.min(placed.y, o.y) - overhang, y2: Math.max(placed.y + placed.height, o.y + o.height) + overhang }
        : { y1: hit.at, y2: hit.at, x1: Math.min(placed.x, o.x) - overhang, x2: Math.max(placed.x + placed.width, o.x + o.width) + overhang });
      return;
    }
    const [a, b] = hit.pair;
    const [first, second] = hit.after ? [hit.next, placed] : [placed, hit.next];
    if (axis === 'x') {
      const ya = (midY(a) + midY(b)) / 2, ym = (midY(first) + midY(second)) / 2;
      out.push({ x1: a.x + a.width, x2: b.x, y1: ya, y2: ya, gap: hit.size });
      out.push({ x1: first.x + first.width, x2: second.x, y1: ym, y2: ym, gap: hit.size });
    } else {
      const xa = (midX(a) + midX(b)) / 2, xm = (midX(first) + midX(second)) / 2;
      out.push({ y1: a.y + a.height, y2: b.y, x1: xa, x2: xa, gap: hit.size });
      out.push({ y1: first.y + first.height, y2: second.y, x1: xm, x2: xm, gap: hit.size });
    }
  });
  return out;
};
