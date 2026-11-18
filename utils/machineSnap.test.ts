import { describe, it, expect } from 'vitest';
import { lineUp, guidesFor, Box } from './machineSnap';

// A row of treadmills 9 wide and 21 long, 5 apart: ten map units to the metre.
const row: Box[] = [0, 14, 28].map(x => ({ x, y: 10, width: 9, height: 21 }));
const at = (x: number, y: number): Box => ({ x, y, width: 9, height: 21 });

describe('lineUp', () => {
  it('takes the row spacing and its line when the next treadmill comes close', () => {
    const s = lineUp(at(43.6, 11.8), row, 2.5, 0.5, 40);
    expect(s.x).toBe(42);
    expect(s.y).toBe(10);
    expect(s.hits.x).toMatchObject({ kind: 'gap', size: 5 });
  });

  it('leaves a machine out of reach where it was put', () => {
    const s = lineUp(at(70, 60), row, 2.5, 0.5, 40);
    expect(s.x).toBeNull();
    expect(s.y).toBeNull();
  });

  it('lines up middles as well as edges', () => {
    // A bike 6 wide under the first treadmill, nearly centred on it.
    const s = lineUp({ x: 2.2, y: 40, width: 6, height: 12 }, row, 1, 0.5, 40);
    expect(s.x).toBe(1.5);
  });

  it('ignores gaps too small or too big to be a spacing', () => {
    const s = lineUp(at(43.6, 11.8), row, 2.5, 6, 40);
    expect(s.hits.x?.kind).not.toBe('gap');
  });
});

describe('guidesFor', () => {
  it('marks both equal gaps and the shared line', () => {
    const s = lineUp(at(43.6, 11.8), row, 2.5, 0.5, 40);
    const guides = guidesFor(at(s.x!, s.y!), s.hits, 3);
    const gaps = guides.filter(g => g.gap);
    expect(gaps.map(g => [g.x1, g.x2])).toEqual([[9, 14], [37, 42]]);
    expect(guides.find(g => !g.gap)).toMatchObject({ x1: -3, x2: 54 });
  });
});
