import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CABLE_LAYOUT, MAX_TOWERS, cableStationExtent, cableStationSize, choiceAt, fits, readCableLayout, setSide, sidesOf,
} from './cableStation';
import { CableLayout } from '../types';

const grow = (layout: CableLayout, ...steps: [string, Parameters<typeof setSide>[2]][]) =>
  steps.reduce((l, [key, choice]) => setSide(l, key, choice), layout);

describe('cable station', () => {
  it('is the sketch at 4.0 × 6.2 m to start with', () => {
    expect(cableStationExtent(DEFAULT_CABLE_LAYOUT)).toEqual([4, 6.2]);
    expect(cableStationSize(DEFAULT_CABLE_LAYOUT)).toEqual({ width: 4, length: 6.2 });
  });

  it('offers every side but the one a tower hangs from', () => {
    expect(sidesOf(DEFAULT_CABLE_LAYOUT)).toEqual(['0:top', '0:left', '0:right', '0:bottom', '1:left', '1:right', '1:bottom']);
    expect(choiceAt(DEFAULT_CABLE_LAYOUT, '0:bottom')).toBe('tower');
    expect(choiceAt(DEFAULT_CABLE_LAYOUT, '1:left')).toBe('pulldown');
    expect(choiceAt(DEFAULT_CABLE_LAYOUT, '1:bottom')).toBe('');
  });

  it('grows longer down the line and wider to the side', () => {
    const longer = setSide(DEFAULT_CABLE_LAYOUT, '1:bottom', 'tower');
    expect(longer.towers).toHaveLength(3);
    expect(cableStationExtent(longer)).toEqual([4, 10.9]);
    const branched = setSide(longer, '2:right', 'tower');
    expect(cableStationExtent(branched)).toEqual([7.3, 10.9]);
  });

  it('takes away every tower beyond a side when it is cleared', () => {
    const l = grow(DEFAULT_CABLE_LAYOUT, ['1:bottom', 'tower'], ['2:right', 'tower'], ['3:top', 'row']);
    const cleared = setSide(l, '1:bottom', '');
    expect(cleared).toEqual(DEFAULT_CABLE_LAYOUT);
  });

  it('turns down a tower where one already stands, and past the most towers', () => {
    // Round the corner and back: the third tower would land on the second.
    const l = grow(DEFAULT_CABLE_LAYOUT, ['0:right', 'tower'], ['2:bottom', 'tower']);
    expect(fits(l, '3:left', 'tower')).toBe(false);
    expect(fits(l, '3:left', 'pulldown')).toBe(true);
    const full = grow(l, ['1:bottom', 'tower'], ['0:left', 'tower']);
    expect(full.towers).toHaveLength(MAX_TOWERS);
    expect(fits(full, '4:bottom', 'tower')).toBe(false);
    // Swapping a tower for another is still fine at the most.
    expect(fits(full, '1:bottom', 'tower')).toBe(true);
  });

  it('reads back a stored layout, and falls back to the sketch for a broken one', () => {
    const l = setSide(DEFAULT_CABLE_LAYOUT, '0:top', 'row');
    expect(readCableLayout(JSON.parse(JSON.stringify(l)))).toEqual(l);
    expect(readCableLayout(undefined)).toEqual(DEFAULT_CABLE_LAYOUT);
    expect(readCableLayout({ towers: [{ id: 0, gx: 0, gy: 0 }, { id: 1, gx: 0, gy: 1, parent: 7, side: 'bottom' }], stations: {} })).toEqual(DEFAULT_CABLE_LAYOUT);
    // A seat on the side a tower hangs from, or on no tower at all, is dropped.
    expect(readCableLayout({ ...DEFAULT_CABLE_LAYOUT, stations: { '1:top': 'row', '5:left': 'row', '1:left': 'pulldown' } }).stations)
      .toEqual({ '1:left': 'pulldown' });
  });
});
