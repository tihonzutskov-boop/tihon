import { describe, it, expect } from 'vitest';
import { toHeatMap, zoneHeatMap, machineHeatMap, topEquipmentByUsage, topZonesByUsage, heatColor } from './equipmentUsage';
import type { UsageRow, GymUsage } from './equipmentUsage';
import type { Gym, EquipmentItem } from '../types';

const row = (over: Partial<UsageRow>): UsageRow => ({ zoneId: 'z1', machineId: null, uses: 0, trainees: 0, lastUsedAt: null, ...over });

describe('scaling usage into a heat intensity', () => {
  it('gives the busiest row intensity 1 and scales the rest against it', () => {
    const map = toHeatMap([row({ zoneId: 'a', uses: 10 }), row({ zoneId: 'b', uses: 5 }), row({ zoneId: 'c', uses: 1 })], r => r.zoneId);
    expect(map.a.intensity).toBe(1);
    expect(map.b.intensity).toBe(0.5);
    expect(map.c.intensity).toBe(0.1);
  });

  it('is zero intensity for everything when there is no usage at all, not a division error', () => {
    const map = toHeatMap([row({ zoneId: 'a', uses: 0 }), row({ zoneId: 'b', uses: 0 })], r => r.zoneId);
    expect(Object.values(map).every(e => e.intensity === 0)).toBe(true);
  });

  it('is empty for no rows', () => {
    expect(toHeatMap([], r => r.zoneId)).toEqual({});
  });

  it('carries the raw counts through unchanged, for display alongside the color', () => {
    const map = toHeatMap([row({ zoneId: 'a', uses: 7, trainees: 3, lastUsedAt: '2026-09-20' })], r => r.zoneId);
    expect(map.a).toEqual({ uses: 7, trainees: 3, lastUsedAt: '2026-09-20', intensity: 1 });
  });

  it('builds zone and machine heat maps from the two halves of a GymUsage', () => {
    const usage: GymUsage = {
      byZone: [row({ zoneId: 'z1', uses: 4 })],
      byMachine: [row({ zoneId: 'z1', machineId: 'm1', uses: 4 })],
    };
    expect(zoneHeatMap(usage).z1.uses).toBe(4);
    expect(machineHeatMap(usage).m1.uses).toBe(4);
  });
});

const machine = (id: string, equipmentId?: string) => ({ id, name: id, x: 0, y: 0, width: 10, height: 10, equipmentId });
const zone = (id: string, name: string, machines: ReturnType<typeof machine>[] = []) =>
  ({ id, name, type: 'strength', x: 0, y: 0, width: 10, height: 10, color: '#fff', icon: 'x', machines } as any);
const gym = (zones: ReturnType<typeof zone>[]): Gym => ({ id: 'g', name: 'G', dimensions: { width: 10, height: 10, x: 0, y: 0 }, zones } as Gym);
const equipment = (id: string, name: string): EquipmentItem => ({ id, name, category: 'Machines' } as EquipmentItem);

describe('rolling machine usage up to equipment types', () => {
  it('sums uses across every machine of the same equipment type', () => {
    const g = gym([zone('z1', 'Strength', [machine('m1', 'eq-rack'), machine('m2', 'eq-rack')])]);
    const result = topEquipmentByUsage(g, [equipment('eq-rack', 'Squat Rack')], [
      row({ zoneId: 'z1', machineId: 'm1', uses: 10, trainees: 3 }),
      row({ zoneId: 'z1', machineId: 'm2', uses: 6, trainees: 2 }),
    ]);
    expect(result).toEqual([{ equipmentId: 'eq-rack', name: 'Squat Rack', uses: 16, trainees: 3 }]);
  });

  it('sorts the busiest equipment first, and alphabetically on a tie', () => {
    const g = gym([zone('z1', 'Z', [machine('m1', 'eq-a'), machine('m2', 'eq-b'), machine('m3', 'eq-c')])]);
    const result = topEquipmentByUsage(g, [equipment('eq-a', 'Zebra'), equipment('eq-b', 'Apple'), equipment('eq-c', 'Mango')], [
      row({ machineId: 'm1', uses: 5 }), row({ machineId: 'm2', uses: 9 }), row({ machineId: 'm3', uses: 5 }),
    ]);
    expect(result.map(r => r.name)).toEqual(['Apple', 'Mango', 'Zebra']);
  });

  it('leaves out a machine whose equipment link no longer exists', () => {
    // Removed from the library, or never tagged — there is no type to roll it into.
    const g = gym([zone('z1', 'Z', [machine('m1', undefined)])]);
    expect(topEquipmentByUsage(g, [], [row({ machineId: 'm1', uses: 5 })])).toEqual([]);
  });

  it('leaves out a machine the gym no longer has, rather than crashing on an unknown id', () => {
    const g = gym([zone('z1', 'Z', [])]);
    expect(topEquipmentByUsage(g, [], [row({ machineId: 'gone', uses: 5 })])).toEqual([]);
  });

  it('falls back to the equipment id as a name when the library has none', () => {
    const g = gym([zone('z1', 'Z', [machine('m1', 'eq-mystery')])]);
    expect(topEquipmentByUsage(g, [], [row({ machineId: 'm1', uses: 1 })])[0].name).toBe('eq-mystery');
  });

  it('never double-counts a trainee across two machines of the same type', () => {
    // Three people total trained on racks, but the merge can only see the
    // busiest single machine's distinct count — stated as policy, not a bug.
    const g = gym([zone('z1', 'Z', [machine('m1', 'eq-rack'), machine('m2', 'eq-rack')])]);
    const result = topEquipmentByUsage(g, [equipment('eq-rack', 'Rack')], [
      row({ machineId: 'm1', uses: 3, trainees: 2 }), row({ machineId: 'm2', uses: 1, trainees: 1 }),
    ]);
    expect(result[0].trainees).toBe(2);
  });
});

describe('ranking zones by usage', () => {
  it('names each zone and sorts busiest first', () => {
    const g = gym([zone('z1', 'Floor'), zone('z2', 'Weights')]);
    const result = topZonesByUsage(g, [row({ zoneId: 'z1', uses: 2 }), row({ zoneId: 'z2', uses: 9 })]);
    expect(result).toEqual([
      { zoneId: 'z2', name: 'Weights', uses: 9, trainees: 0 },
      { zoneId: 'z1', name: 'Floor', uses: 2, trainees: 0 },
    ]);
  });

  it('falls back to the raw id when the zone no longer exists in the gym', () => {
    expect(topZonesByUsage(gym([]), [row({ zoneId: 'gone', uses: 1 })])[0].name).toBe('gone');
  });
});

describe('the heat color scale', () => {
  it('runs blue at 0 through yellow to red at 1, a traffic-density read', () => {
    expect(heatColor(0)).toBe('rgb(37, 99, 235)');
    expect(heatColor(0.5)).toBe('rgb(234, 179, 8)');
    expect(heatColor(1)).toBe('rgb(220, 38, 38)');
  });

  it('moves between named stops smoothly rather than jumping', () => {
    const rgb = (c: string) => c.match(/\d+/g)!.map(Number);
    const mid = rgb(heatColor(0.25)); // halfway between blue and yellow
    const blue = rgb(heatColor(0));
    const yellow = rgb(heatColor(0.5));
    mid.forEach((v, i) => {
      const lo = Math.min(blue[i], yellow[i]), hi = Math.max(blue[i], yellow[i]);
      expect(v).toBeGreaterThanOrEqual(lo);
      expect(v).toBeLessThanOrEqual(hi);
    });
  });

  it('clamps anything outside the 0-1 range instead of extrapolating', () => {
    expect(heatColor(-5)).toBe(heatColor(0));
    expect(heatColor(5)).toBe(heatColor(1));
  });
});
