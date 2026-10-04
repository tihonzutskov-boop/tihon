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

export interface MapHeat {
  zoneHeat: Record<string, HeatEntry>;
  machineHeat: Record<string, HeatEntry>;
}

// Relative standing, not an absolute count: a single gym's volume would make
// raw numbers meaningless on their own. A maximum of zero maps to intensity 0
// rather than dividing by zero.
const entryFor = (r: UsageRow, maxUses: number): HeatEntry => ({
  uses: r.uses, trainees: r.trainees, lastUsedAt: r.lastUsedAt,
  intensity: maxUses > 0 ? r.uses / maxUses : 0,
});

/**
 * Heat for the map, with zones and machines on one scale.
 *
 * A zone whose own machines carry usage shows it on those machines rather than
 * as a zone glow — showing both says the same thing twice, and inconsistently
 * whenever the zone's total differs from its hottest machine. What remains is
 * scaled against the busiest thing actually drawn, so a color means the same
 * number of uses on a zone as on a machine. Scaling each against its own
 * busiest made a lightly used open-floor zone glow as red as the busiest
 * machine in the gym. Rows for zones or machines no longer on the floor plan
 * are dropped, so they can't set a maximum that nothing on the map reaches.
 */
export const mapHeat = (usage: GymUsage, gym: Gym): MapHeat => {
  const zones = gym.zones || [];
  const zoneIds = new Set(zones.map(z => z.id));
  const machineIds = new Set(zones.flatMap(z => (z.machines || []).map(m => m.id)));

  const machineRows = usage.byMachine.filter(r => !!r.machineId && machineIds.has(r.machineId));
  const usedMachineIds = new Set(machineRows.map(r => r.machineId!));
  const shownByMachines = new Set(
    zones.filter(z => (z.machines || []).some(m => usedMachineIds.has(m.id))).map(z => z.id)
  );
  const zoneRows = usage.byZone.filter(r => zoneIds.has(r.zoneId) && !shownByMachines.has(r.zoneId));

  const maxUses = [...zoneRows, ...machineRows].reduce((m, r) => Math.max(m, r.uses), 0);
  const zoneHeat: Record<string, HeatEntry> = {};
  for (const r of zoneRows) zoneHeat[r.zoneId] = entryFor(r, maxUses);
  const machineHeat: Record<string, HeatEntry> = {};
  for (const r of machineRows) machineHeat[r.machineId!] = entryFor(r, maxUses);
  return { zoneHeat, machineHeat };
};

export interface ClipRect { x: number; y: number; width: number; height: number }

/**
 * Where heat may be drawn: the building, so a glow near an outer wall doesn't
 * bleed onto the page. The building is the main room plus every wing, not the
 * room alone — clipping to the room hid every glow in a wing completely. Each
 * zone's own rectangle is included too, so a zone placed outside the drawn walls
 * still shows its heat instead of losing it entirely.
 */
export const heatClipRects = (
  room: { x?: number; y?: number; width: number; height: number },
  annexes: ClipRect[] = [],
  zones: ClipRect[] = [],
): ClipRect[] => [
  { x: room.x || 0, y: room.y || 0, width: room.width, height: room.height },
  ...annexes.map(a => ({ x: a.x, y: a.y, width: a.width, height: a.height })),
  ...zones.map(z => ({ x: z.x, y: z.y, width: z.width, height: z.height })),
];

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

// Blue where a piece of equipment barely gets touched, through yellow, to red
// where it is the busiest thing in the gym — a traffic-density read, the same
// register maps and dashboards use for "how much is happening here".
const HEAT_STOPS: [number, [number, number, number]][] = [
  [0, [37, 99, 235]],   // blue-600 — least used
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
