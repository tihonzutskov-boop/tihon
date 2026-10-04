// Turning raw per-zone/per-machine session counts into what the admin heatmap
// needs: an intensity to color the map by, and a ranked list of which
// equipment actually gets used. Kept apart from the component so the
// arithmetic — normalizing against a maximum that might be zero, joining a
// machine back to its equipment type, breaking a tie — can be tested without
// rendering anything.

import type { Gym, EquipmentItem } from '../types';

export interface UsageRow {
  zoneId: string;
  machineId: string | null;
  uses: number;
  trainees: number;
  lastUsedAt: string | null;
}

export interface GymUsage {
  byZone: UsageRow[];
  byMachine: UsageRow[];
}

export interface HeatEntry {
  uses: number;
  trainees: number;
  lastUsedAt: string | null;
  /** 0 (least used of the ones shown) to 1 (the busiest). */
  intensity: number;
}

/**
 * One HeatEntry per id, intensity scaled against the busiest row in the set —
 * the point of a heatmap is relative standing, not an absolute count a single
 * gym's volume would make meaningless on its own. Empty input, or every row
 * tied at zero, maps everything to intensity 0 rather than dividing by zero.
 */
export const toHeatMap = (rows: UsageRow[], idOf: (r: UsageRow) => string): Record<string, HeatEntry> => {
  const maxUses = rows.reduce((m, r) => Math.max(m, r.uses), 0);
  const map: Record<string, HeatEntry> = {};
  for (const r of rows) {
    map[idOf(r)] = { uses: r.uses, trainees: r.trainees, lastUsedAt: r.lastUsedAt, intensity: maxUses > 0 ? r.uses / maxUses : 0 };
  }
  return map;
};

export const zoneHeatMap = (usage: GymUsage): Record<string, HeatEntry> => toHeatMap(usage.byZone, r => r.zoneId);
export const machineHeatMap = (usage: GymUsage): Record<string, HeatEntry> => toHeatMap(usage.byMachine, r => r.machineId!);

export interface EquipmentUsage {
  equipmentId: string;
  name: string;
  uses: number;
  /** The most trainees any single machine of this type saw — see note below. */
  trainees: number;
}

/**
 * Machine-level usage rolled up to the equipment type it is (every squat rack
 * counted as one "Squat Rack" line, not listed machine by machine) — the
 * question an admin actually has is "what should I buy more of", which is
 * about the type, not which specific instance. `trainees` is the busiest
 * single machine's count rather than a sum: a trainee who used two of the
 * gym's three identical treadmills would otherwise be counted twice, and
 * there is no way to deduplicate people without the raw log rows.
 */
export const topEquipmentByUsage = (gym: Gym, equipmentList: EquipmentItem[], byMachine: UsageRow[]): EquipmentUsage[] => {
  const equipmentIdByMachine = new Map<string, string>();
  for (const zone of gym.zones || []) {
    for (const m of zone.machines || []) {
      if (m.equipmentId) equipmentIdByMachine.set(m.id, m.equipmentId);
    }
  }
  const nameById = new Map(equipmentList.map(e => [e.id, e.name]));

  const totals = new Map<string, { uses: number; trainees: number }>();
  for (const row of byMachine) {
    const equipmentId = row.machineId ? equipmentIdByMachine.get(row.machineId) : undefined;
    if (!equipmentId) continue; // an untagged or removed machine has no type to roll up to
    const prev = totals.get(equipmentId) ?? { uses: 0, trainees: 0 };
    totals.set(equipmentId, { uses: prev.uses + row.uses, trainees: Math.max(prev.trainees, row.trainees) });
  }

  return [...totals.entries()]
    .map(([equipmentId, t]) => ({ equipmentId, name: nameById.get(equipmentId) || equipmentId, ...t }))
    .sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name));
};

/** A zone's own name, for a ranked list — falls back to its id if it was never named. */
export const topZonesByUsage = (
  gym: Gym, byZone: UsageRow[]
): { zoneId: string; name: string; uses: number; trainees: number }[] => {
  const nameById = new Map((gym.zones || []).map(z => [z.id, z.name]));
  return [...byZone]
    .map(r => ({ zoneId: r.zoneId, name: nameById.get(r.zoneId) || r.zoneId, uses: r.uses, trainees: r.trainees }))
    .sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name));
};

// A traffic-light read: green where a piece of equipment barely gets touched,
// through yellow, to red where it is the busiest thing in the gym — the same
// register a risk matrix uses for "how much attention does this need", which
// is exactly the question this answers for a piece of gym equipment.
const HEAT_STOPS: [number, [number, number, number]][] = [
  [0, [22, 163, 74]],   // green-600 — least used
  [0.5, [234, 179, 8]], // yellow-500
  [1, [220, 38, 38]],   // red-600 — busiest
];

/** Interpolated along HEAT_STOPS; an intensity outside [0,1] clamps to an end. */
export const heatColor = (intensity: number): string => {
  const t = Math.max(0, Math.min(1, intensity));
  let [lo, hi] = [HEAT_STOPS[0], HEAT_STOPS[HEAT_STOPS.length - 1]];
  for (let i = 0; i < HEAT_STOPS.length - 1; i++) {
    if (t >= HEAT_STOPS[i][0] && t <= HEAT_STOPS[i + 1][0]) { lo = HEAT_STOPS[i]; hi = HEAT_STOPS[i + 1]; break; }
  }
  const span = hi[0] - lo[0];
  const f = span > 0 ? (t - lo[0]) / span : 0;
  const mix = (a: number, b: number) => Math.round(a + (b - a) * f);
  const [r, g, b] = [mix(lo[1][0], hi[1][0]), mix(lo[1][1], hi[1][1]), mix(lo[1][2], hi[1][2])];
  return `rgb(${r}, ${g}, ${b})`;
};
