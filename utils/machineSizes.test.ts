import { describe, it, expect } from 'vitest';
import {
  sizeKindOf, standardSizeOf, fitToSize, turnQuarter, isAtSize, findOverlaps,
  applyStandardSizes, countOffSize, unitsPerMetreOf, STANDARD_SIZES,
} from './machineSizes';
import { Gym, GymZone, GymMachine, EquipmentItem } from '../types';

const machine = (id: string, name: string, x: number, y: number, width: number, height: number, extra: Partial<GymMachine> = {}): GymMachine =>
  ({ id, name, x, y, width, height, ...extra });
const zone = (id: string, x: number, y: number, width: number, height: number, machines: GymMachine[] = []): GymZone =>
  ({ id, name: id, type: 'Machine' as any, x, y, width, height, color: '#fff', icon: 'x', machines });
const gymOf = (zones: GymZone[]): Gym => ({ id: 'g', name: 'G', zones, dimensions: { width: 300, height: 200 } } as Gym);

describe('sizeKindOf', () => {
  it('knows machines with a drawing and strength machines without one', () => {
    expect(sizeKindOf({ name: 'Treadmill 3' })).toBe('treadmill');
    expect(sizeKindOf({ name: 'Power Rack 1' })).toBe('rack');
    expect(sizeKindOf({ name: '45° Leg Press' })).toBe('legPress');
    expect(sizeKindOf({ name: 'Dual Cable Cross' })).toBe('cableCrossover');
    expect(sizeKindOf({ name: 'Chest Press' })).toBe('weightStack');
    expect(sizeKindOf({ name: 'Smith Machine' })).toBe('smith');
  });

  // The ones a drawing rule alone would get wrong.
  it('tells a bench press station from a bench, and a seated row from a rower', () => {
    expect(sizeKindOf({ name: 'Flat Bench Press' })).toBe('benchStation');
    expect(sizeKindOf({ name: 'Flat Bench 2' })).toBe('bench');
    expect(sizeKindOf({ name: 'Lat Pulldown & Seated Cable Row' })).toBe('pulldown');
    expect(sizeKindOf({ name: 'Rower B' })).toBe('rower');
  });

  it('falls back to the Equipment Library item name, then gives up', () => {
    const eq = { id: 'eq-x', name: 'Commercial Running Treadmill', category: 'Cardio' } as EquipmentItem;
    expect(sizeKindOf({ name: 'Lane 4', equipmentId: 'eq-x' }, eq)).toBe('treadmill');
    expect(sizeKindOf({ name: 'Plyo box' })).toBeNull();
  });
});

describe('standardSizeOf', () => {
  it('uses the typical size of the kind', () => {
    expect(standardSizeOf({ name: 'Treadmill' })).toEqual(STANDARD_SIZES.treadmill.size);
  });

  it("prefers the gym's own model's size from the Equipment Library, short side first", () => {
    const eq = { id: 'eq-t', name: 'Treadmill', category: 'Cardio', sizeM: { width: 2.2, length: 1 } } as EquipmentItem;
    expect(standardSizeOf({ name: 'Treadmill', equipmentId: 'eq-t' }, eq)).toEqual({ width: 1, length: 2.2 });
  });

  it('has no size for kit nobody sized', () => {
    expect(standardSizeOf({ name: 'Battle ropes' })).toBeNull();
  });
});

describe('fitToSize', () => {
  const z = zone('z', 0, 0, 200, 200);

  it('keeps the centre and the way round it was placed', () => {
    // Placed wide: the treadmill lies sideways, 21 by 9.
    const box = fitToSize(machine('m', 'Treadmill', 50, 50, 40, 20), z, { width: 0.9, length: 2.1 }, 10);
    expect(box).toEqual({ x: 59.5, y: 55.5, width: 21, height: 9 });
    const tall = fitToSize(machine('m', 'Treadmill', 50, 50, 20, 40), z, { width: 0.9, length: 2.1 }, 10);
    expect(tall).toEqual({ x: 55.5, y: 59.5, width: 9, height: 21 });
  });

  it('stays inside its zone when growing near an edge', () => {
    const box = fitToSize(machine('m', 'Leg Press', 0, 0, 10, 10), z, { width: 1.8, length: 2.3 }, 10);
    expect(box.x).toBe(0);
    expect(box.y).toBe(0);
  });

  it('is centred on a zone too small for it', () => {
    const tiny = zone('t', 0, 0, 10, 10);
    const box = fitToSize(machine('m', 'Cable', 0, 0, 10, 4), tiny, { width: 1.2, length: 4.5 }, 10);
    expect(box.x).toBe((10 - 45) / 2);
  });
});

describe('turnQuarter', () => {
  it('swaps width and length about the same centre', () => {
    const box = turnQuarter(machine('m', 'Treadmill', 50, 50, 9, 21), zone('z', 0, 0, 200, 200));
    expect(box).toEqual({ x: 44, y: 56, width: 21, height: 9 });
  });
});

describe('isAtSize', () => {
  it('accepts either way round', () => {
    const size = { width: 0.9, length: 2.1 };
    expect(isAtSize(machine('m', 'T', 0, 0, 9, 21), size, 10)).toBe(true);
    expect(isAtSize(machine('m', 'T', 0, 0, 21, 9), size, 10)).toBe(true);
    expect(isAtSize(machine('m', 'T', 0, 0, 30, 60), size, 10)).toBe(false);
    // Drawn at three times life size, 30 by 60 is about right.
    expect(isAtSize(machine('m', 'T', 0, 0, 27, 63), size, 30)).toBe(true);
  });
});

describe('findOverlaps', () => {
  it('finds machines on top of each other, across zones too, but not ones touching', () => {
    const a = zone('a', 0, 0, 100, 100, [machine('m1', 'One', 10, 10, 20, 20), machine('m2', 'Two', 25, 25, 20, 20), machine('m3', 'Three', 45, 10, 10, 10)]);
    const b = zone('b', 100, 0, 100, 100, [machine('m4', 'Four', -5, 12, 10, 10)]);
    const pairs = findOverlaps(gymOf([a, b])).map(([x, y]) => [x.machineId, y.machineId].join('+'));
    expect(pairs).toEqual(['m1+m2']);
  });
});

describe('applyStandardSizes', () => {
  const gym = () => gymOf([zone('cardio', 0, 0, 200, 100, [
    machine('t1', 'Treadmill 1', 10, 10, 30, 60),
    machine('t2', 'Treadmill 2', 60, 10, 9, 21),
    machine('box', 'Plyo box', 100, 10, 10, 10),
  ])]);

  it('resizes what has a size, leaves the rest, and says which is which', () => {
    const report = applyStandardSizes(gym(), []);
    expect(report.resized.map(r => r.machineId)).toEqual(['t1']);
    expect(report.unknown.map(r => r.machineId)).toEqual(['box']);
    const t1 = report.gym.zones[0].machines!.find(m => m.id === 't1')!;
    expect([t1.width, t1.height]).toEqual([9, 21]);
    // Already at its size: untouched.
    expect(report.gym.zones[0].machines!.find(m => m.id === 't2')).toEqual(gym().zones[0].machines![1]);
  });

  it('reports machines that end up overlapping', () => {
    const crowded = gymOf([zone('m', 0, 0, 200, 100, [
      machine('lp', 'Leg Press', 10, 10, 10, 10),
      machine('ch', 'Chest Press', 22, 10, 10, 10),
    ])]);
    const report = applyStandardSizes(crowded, []);
    expect(report.overlaps.map(([a, b]) => [a.machineId, b.machineId])).toEqual([['lp', 'ch']]);
  });

  it('counts what Apply would change', () => {
    expect(countOffSize(gym(), [])).toBe(1);
    expect(countOffSize(applyStandardSizes(gym(), []).gym, [])).toBe(0);
  });
});

describe('the gym scale', () => {
  it("falls back to the editor's 10 units to the metre", () => {
    expect(unitsPerMetreOf(undefined)).toBe(10);
    expect(unitsPerMetreOf({})).toBe(10);
    expect(unitsPerMetreOf({ unitsPerMetre: 0 })).toBe(10);
    expect(unitsPerMetreOf({ unitsPerMetre: NaN })).toBe(10);
    expect(unitsPerMetreOf({ unitsPerMetre: 31.2 })).toBe(31.2);
  });

  it("sizes machines in the gym's own scale, leaving the drawing alone", () => {
    const g = { ...gymOf([zone('cardio', 0, 0, 600, 300, [machine('t', 'Treadmill', 100, 100, 20, 20)])]), dimensions: { width: 780, height: 580, unitsPerMetre: 30 } } as Gym;
    const report = applyStandardSizes(g, []);
    const t = report.gym.zones[0].machines![0];
    expect([t.width, t.height]).toEqual([27, 63]);
    expect(report.gym.dimensions).toBe(g.dimensions);
    expect(report.gym.zones[0]).toMatchObject({ x: 0, y: 0, width: 600, height: 300 });
  });
});
