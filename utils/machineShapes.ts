// Which top-view drawing a machine on the map gets, if any.
//
// Only machines that look unmistakable from above, and whose names say so
// unambiguously, get one: cardio machines, power racks, benches and dumbbell
// racks. Everything else keeps its box and icon. A wrong drawing is worse than
// none — it sends someone looking for the wrong thing — so the name rules err
// towards no match: "row" alone never makes a rower, since a seated row is a
// strength machine.

export type MachineShape = 'treadmill' | 'bike' | 'rower' | 'elliptical' | 'stairs' | 'rack' | 'bench' | 'dumbbells';

export const CARDIO_SHAPES: ReadonlySet<MachineShape> = new Set(['treadmill', 'bike', 'rower', 'elliptical', 'stairs']);

// A machine placed from the Equipment Library carries its item's id, which is
// a surer guide than whatever it was later renamed to.
const BY_EQUIPMENT: Record<string, MachineShape> = {
  'eq-treadmill': 'treadmill',
  'eq-rower': 'rower',
  'eq-bike': 'bike',
  'eq-assault-bike': 'bike',
  'eq-rack': 'rack',
  'eq-squat-rack': 'rack',
  'eq-bench': 'bench',
  'eq-adj-bench': 'bench',
  'eq-dumbbells': 'dumbbells',
};

export const machineShapeOf = (machine: { name?: string; equipmentId?: string }): MachineShape | null => {
  const linked = machine.equipmentId ? BY_EQUIPMENT[machine.equipmentId] : undefined;
  if (linked) return linked;
  const name = (machine.name || '').toLowerCase();
  if (/\btread/.test(name) || name.includes('running machine')) return 'treadmill';
  if (/\b(rower|rowing|concept ?2)\b/.test(name)) return 'rower';
  if (/ellipti|cross[ -]?trainer/.test(name)) return 'elliptical';
  if (/stair|stepper|step ?mill|\bclimber\b/.test(name)) return 'stairs';
  if (/\b(bike|cycle|cycling|spin|bicycle)\b/.test(name)) return 'bike';
  // Before dumbbells: a dumbbell bench is a bench.
  if (/\bbench\b/.test(name)) return 'bench';
  if (name.includes('dumbbell')) return 'dumbbells';
  // A rack you train in, not one that stores plates, barbells or kettlebells.
  if (/\b(power|squat|half)[ -]?(rack|cage)\b/.test(name) || /^rack\b/.test(name)) return 'rack';
  return null;
};
