// Fixed machine sizes — every machine of a kind takes up the same real space.
//
// Machines used to be whatever size someone dragged them to: three treadmills
// at three sizes, a leg press smaller than a bench. Each kind now has one real
// size, in metres. The Equipment Library can set a gym's own model's size;
// otherwise the typical size of that kind of machine below is used.
//
// A real size becomes map units through the gym's scale. Maps are drawn at
// whatever size looked right on screen — the sample gym is three times life
// size — so the scale comes from the room's real width, entered once, and the
// drawing itself is never touched: shrinking a whole map would leave its
// labels, lines and zoom levels three times too big for it.

import { Gym, GymMachine, GymZone, GymDimensions, EquipmentItem, CableLayout } from '../types';
import { machineShapeOf } from './machineShapes';
import { DrawnKind } from './machineDrawings';
import { cableStationExtent, cableStationSize, readCableLayout } from './cableStation';

/** The room editor's original assumption, for gyms that never set a scale. */
export const DEFAULT_UNITS_PER_METRE = 10;

export const unitsPerMetreOf = (dimensions: GymDimensions | Partial<GymDimensions> | undefined): number => {
  const upm = dimensions?.unitsPerMetre;
  return typeof upm === 'number' && upm > 0 && Number.isFinite(upm) ? upm : DEFAULT_UNITS_PER_METRE;
};

/** Width is the short side, length the long one, in metres. */
export interface RealSize { width: number; length: number }

/** Every kind with a top-view drawing, and two strength machines that only have a size. */
export type SizeKind = DrawnKind | 'cableCrossover' | 'weightStack';

export const STANDARD_SIZES: Record<SizeKind, { name: string; size: RealSize }> = {
  treadmill: { name: 'Treadmill', size: { width: 0.9, length: 2.1 } },
  bike: { name: 'Bike', size: { width: 0.6, length: 1.2 } },
  rower: { name: 'Rower', size: { width: 0.6, length: 2.4 } },
  elliptical: { name: 'Cross-trainer', size: { width: 0.7, length: 1.6 } },
  stairs: { name: 'Stair climber', size: { width: 0.9, length: 1.6 } },
  rack: { name: 'Power rack', size: { width: 1.4, length: 2.2 } },
  bench: { name: 'Bench', size: { width: 0.6, length: 1.4 } },
  dumbbells: { name: 'Dumbbell rack', size: { width: 0.8, length: 2.5 } },
  benchStation: { name: 'Bench press', size: { width: 1.3, length: 2.2 } },
  legPress: { name: 'Leg press', size: { width: 1.8, length: 2.3 } },
  smith: { name: 'Smith machine', size: { width: 1.4, length: 2.2 } },
  // The owner's sketch of the RPM Power Renegade: two rack stations and plate storage.
  functionalTrainer: { name: 'Functional trainer', size: { width: 1.6, length: 4.13 } },
  pulldown: { name: 'Lat pulldown / row', size: { width: 1.2, length: 1.8 } },
  // Two towers as sketched; a station's own towers and seats give its size.
  cableStation: { name: 'Cable station', size: { width: 4.0, length: 6.2 } },
  cableCrossover: { name: 'Cable crossover', size: { width: 1.2, length: 4.5 } },
  weightStack: { name: 'Weight-stack machine', size: { width: 1.2, length: 1.6 } },
};

/** The kinds with a top-view drawing; the rest show as a box. */
const DRAWN: ReadonlySet<SizeKind> = new Set<SizeKind>([
  'treadmill', 'bike', 'rower', 'elliptical', 'stairs', 'rack', 'bench', 'dumbbells',
  'benchStation', 'legPress', 'smith', 'functionalTrainer', 'pulldown', 'cableStation',
]);

const BY_EQUIPMENT: Record<string, SizeKind> = {
  'eq-leg-press': 'legPress',
  'eq-leg-extension': 'weightStack',
  'eq-cable-crossover': 'cableCrossover',
  'eq-cable': 'cableCrossover',
  'eq-lat-pulldown': 'pulldown',
  'eq-latpull': 'pulldown',
};

// Strength machines, by name. Checked before the cardio and free-weight kinds:
// a bench press station is not a bench, and a "seated cable row" is a
// pulldown/row station, not a rower.
const kindFromName = (name: string): SizeKind | null => {
  const n = name.toLowerCase();
  if (/leg press|hack squat/.test(n)) return 'legPress';
  if (/smith/.test(n)) return 'smith';
  if (/functional trainer/.test(n)) return 'functionalTrainer';
  if (/cable station|multi[ -]?(stack|station|gym)/.test(n)) return 'cableStation';
  if (/cable cross|crossover/.test(n)) return 'cableCrossover';
  if (/pulldown|pull-down|lat pull|seated (cable )?row|low row|cable row/.test(n)) return 'pulldown';
  if (/bench press/.test(n)) return 'benchStation';
  if (/chest press|shoulder press|leg extension|leg curl|pec deck|rear delt|abductor|adductor|ab crunch|tricep(s)? (press|extension) machine|bicep(s)? curl machine|preacher curl machine|glute (kickback|machine)|calf raise machine/.test(n)) return 'weightStack';
  return null;
};

/** Which kind of machine this is, for its size, or null when unknown. */
export const sizeKindOf = (machine: { name?: string; equipmentId?: string }, equipment?: EquipmentItem): SizeKind | null => {
  if (machine.equipmentId && BY_EQUIPMENT[machine.equipmentId]) return BY_EQUIPMENT[machine.equipmentId];
  for (const name of [machine.name || '', equipment?.name || '']) {
    const kind = kindFromName(name);
    if (kind) return kind;
  }
  return machineShapeOf(machine) || (equipment ? machineShapeOf({ name: equipment.name }) : null);
};

/** Which drawing a machine gets on the map, or null when it shows as a box. */
export const drawnKindOf = (machine: { name?: string; equipmentId?: string }): DrawnKind | null => {
  const kind = sizeKindOf(machine);
  return kind && DRAWN.has(kind) ? kind as DrawnKind : null;
};

/**
 * The real size a machine should be: a cable station's from its own towers
 * and seats (the sketch's two until someone changes them), its Equipment
 * Library item's own size when one was set for this gym's model, or the
 * typical size of its kind. Null for kit nobody has given a size — it keeps
 * the size it was drawn at.
 */
export const standardSizeOf = (machine: { name?: string; equipmentId?: string; cableLayout?: CableLayout }, equipment?: EquipmentItem): RealSize | null => {
  const kind = sizeKindOf(machine, equipment);
  if (kind === 'cableStation') return cableStationSize(readCableLayout(machine.cableLayout));
  const own = equipment?.sizeM;
  if (own && own.width > 0 && own.length > 0) return { width: Math.min(own.width, own.length), length: Math.max(own.width, own.length) };
  return kind ? STANDARD_SIZES[kind].size : null;
};

type Box = { x: number; y: number; width: number; height: number };

// Kept inside its zone when it fits; a machine bigger than its zone is centred
// on it rather than pushed out of one side.
const clampInto = (box: Box, zone: GymZone): Box => {
  const fit = (pos: number, size: number, room: number) =>
    size <= room ? Math.min(Math.max(pos, 0), room - size) : (room - size) / 2;
  return { ...box, x: fit(box.x, box.width, zone.width), y: fit(box.y, box.height, zone.height) };
};

const round = (v: number) => Math.round(v * 100) / 100;

/**
 * A machine at its real size, centred where it was, its long side along the
 * long side it had — a treadmill placed sideways stays sideways.
 */
export const fitToSize = (machine: GymMachine, zone: GymZone, size: RealSize, unitsPerMetre: number): Box => {
  const long = size.length * unitsPerMetre;
  const short = size.width * unitsPerMetre;
  const wide = machine.width > machine.height;
  const width = wide ? long : short;
  const height = wide ? short : long;
  const cx = machine.x + machine.width / 2;
  const cy = machine.y + machine.height / 2;
  const box = clampInto({ x: cx - width / 2, y: cy - height / 2, width, height }, zone);
  return { x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height) };
};

/** A quarter turn: width and length swap, about the same centre. */
export const turnQuarter = (machine: GymMachine, zone: GymZone): Box => {
  const cx = machine.x + machine.width / 2;
  const cy = machine.y + machine.height / 2;
  const box = clampInto({ x: cx - machine.height / 2, y: cy - machine.width / 2, width: machine.height, height: machine.width }, zone);
  return { x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height) };
};

/** Which way a machine's front points on the map: its console, its weights. */
export type Facing = 'up' | 'right' | 'down' | 'left';

const BEHIND: Record<Facing, Facing> = { up: 'down', right: 'left', down: 'up', left: 'right' };

/** Whether a machine's drawing stands upright, front at the top: all do, but a cable station can be wider than long. */
const drawsUpright = (machine: { name?: string; equipmentId?: string; cableLayout?: CableLayout }): boolean => {
  if (sizeKindOf(machine) !== 'cableStation') return true;
  const [w, h] = cableStationExtent(readCableLayout(machine.cableLayout));
  return h >= w;
};

/**
 * Where a machine's front is. Its drawing lies along the footprint's long
 * side, turned a quarter clockwise when the two disagree, so the front is at
 * the top or, turned, at the right; flipped, it is at the other end.
 */
export const facingOf = (machine: Pick<GymMachine, 'width' | 'height' | 'flipped' | 'name' | 'equipmentId' | 'cableLayout'>): Facing => {
  const turned = drawsUpright(machine) !== (machine.height >= machine.width);
  const front: Facing = turned ? 'right' : 'up';
  return machine.flipped ? BEHIND[front] : front;
};

/** A quarter turn clockwise, front and all: up, right, down, left and round again. */
export const rotateClockwise = (machine: GymMachine, zone: GymZone): Box & { flipped: boolean } => {
  const facing = facingOf(machine);
  // Swapping the sides alone takes right back up; from the side, it goes on round to the far end.
  const flipped = facing === 'right' || facing === 'left' ? !machine.flipped : !!machine.flipped;
  return { ...turnQuarter(machine, zone), flipped };
};

/** Whether a machine already is its real size, either way round. */
export const isAtSize = (machine: GymMachine, size: RealSize, unitsPerMetre: number): boolean => {
  const near = (a: number, b: number) => Math.abs(a - b) < 0.5;
  const long = size.length * unitsPerMetre, short = size.width * unitsPerMetre;
  return (near(machine.width, short) && near(machine.height, long)) || (near(machine.width, long) && near(machine.height, short));
};

export interface MachineRef { zoneId: string; machineId: string; name: string }

/** Every pair of machines whose footprints overlap, anywhere in the gym. */
export const findOverlaps = (gym: Pick<Gym, 'zones'>): [MachineRef, MachineRef][] => {
  const all = gym.zones.flatMap(z => (z.machines || []).map(m => ({
    ref: { zoneId: z.id, machineId: m.id, name: m.name },
    x: z.x + m.x, y: z.y + m.y, w: m.width, h: m.height,
  })));
  const pairs: [MachineRef, MachineRef][] = [];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j];
      // A shared edge, or a sliver from rounding, is not an overlap.
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > 0.5 && oy > 0.5) pairs.push([a.ref, b.ref]);
    }
  }
  return pairs;
};

export interface SizeReport {
  gym: Gym;
  /** Machines changed to their real size. */
  resized: MachineRef[];
  /** Machines with no known size, left as drawn. */
  unknown: MachineRef[];
  overlaps: [MachineRef, MachineRef][];
}

const equipmentFor = (machine: GymMachine, equipment: EquipmentItem[]) =>
  equipment.find(e => e.id === machine.equipmentId) || equipment.find(e => e.name === machine.name);

/** Every machine in the gym at its real size, with what changed and what now overlaps. */
export const applyStandardSizes = (gym: Gym, equipment: EquipmentItem[]): SizeReport => {
  const upm = unitsPerMetreOf(gym.dimensions);
  const resized: MachineRef[] = [];
  const unknown: MachineRef[] = [];
  const zones = gym.zones.map(zone => ({
    ...zone,
    machines: (zone.machines || []).map(m => {
      const ref = { zoneId: zone.id, machineId: m.id, name: m.name };
      const size = standardSizeOf(m, equipmentFor(m, equipment));
      if (!size) { unknown.push(ref); return m; }
      if (isAtSize(m, size, upm)) return m;
      resized.push(ref);
      return { ...m, ...fitToSize(m, zone, size, upm) };
    }),
  }));
  const next = { ...gym, zones };
  return { gym: next, resized, unknown, overlaps: findOverlaps(next) };
};

/**
 * The room set to its real size, in one go with everything in it. The width
 * sets the map's scale, so every zone keeps its place on the map and is
 * measured in the same metres as the room; the length then sets how long the
 * room is at that scale; and every machine goes to its real size in it.
 */
export const setRoomSize = (gym: Gym, widthM: number, lengthM: number, equipment: EquipmentItem[]): SizeReport => {
  const dims = gym.dimensions || { width: 780, height: 580 };
  const unitsPerMetre = dims.width / widthM;
  const height = round(lengthM * unitsPerMetre);
  return applyStandardSizes({ ...gym, dimensions: { ...dims, unitsPerMetre, height } }, equipment);
};

/** How many machines are not at their real size: what Apply would change. */
export const countOffSize = (gym: Pick<Gym, 'zones' | 'dimensions'>, equipment: EquipmentItem[]): number => {
  const upm = unitsPerMetreOf(gym.dimensions);
  return gym.zones.reduce((n, z) => n + (z.machines || []).filter(m => {
    const size = standardSizeOf(m, equipmentFor(m, equipment));
    return !!size && !isAtSize(m, size, upm);
  }).length, 0);
};
