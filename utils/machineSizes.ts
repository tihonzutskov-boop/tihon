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
import { DRAWINGS, DrawnKind } from './machineDrawings';
import { cableStationExtent, cableStationSize, readCableLayout } from './cableStation';
import { stretchRoom } from './roomStretch';

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
  functionalTrainer: { name: 'Functional Training Rig', size: { width: 1.6, length: 4.13 } },
  pulldown: { name: 'Lat pulldown / row', size: { width: 1.2, length: 1.8 } },
  // Two towers as sketched; a station's own towers and seats give its size.
  cableStation: { name: 'Cable station', size: { width: 4.0, length: 6.2 } },
  cableCrossover: { name: 'Cable crossover', size: { width: 1.2, length: 4.5 } },
  weightStack: { name: 'Weight-stack machine', size: { width: 1.2, length: 1.6 } },
  // The owner's sketches, and the plate-loaded and functional kit made from them.
  legExtension: { name: 'Leg extension', size: { width: 1, length: 1.2 } },
  legCurl: { name: 'Leg curl (seated)', size: { width: 1.1, length: 1.2 } },
  chestPress: { name: 'Chest press', size: { width: 1.05, length: 1.6 } },
  hipAbductor: { name: 'Hip abductor', size: { width: 1.05, length: 1.25 } },
  hipAdductor: { name: 'Hip adductor', size: { width: 1.1, length: 1.25 } },
  deltsMachine: { name: 'Delts machine', size: { width: 0.82, length: 1.18 } },
  proneLegCurl: { name: 'Prone leg curl', size: { width: 0.85, length: 1.4 } },
  plateChestPress: { name: 'Plate-loaded chest press', size: { width: 0.92, length: 1.42 } },
  plateLegExtension: { name: 'Plate-loaded leg extension', size: { width: 0.94, length: 1.06 } },
  plateShoulderPress: { name: 'Plate-loaded shoulder press', size: { width: 0.65, length: 1.1 } },
  plateUpperChestPress: { name: 'Plate-loaded upper chest press', size: { width: 0.92, length: 1.42 } },
  plateLowRow: { name: 'Plate-loaded low row', size: { width: 1.22, length: 1.42 } },
  kettlebell: { name: 'Kettlebell', size: { width: 0.6, length: 1.6 } },
  plyoBox: { name: 'Plyo box', size: { width: 0.61, length: 0.76 } },
  sprintLane: { name: 'Sprint lane', size: { width: 1.6, length: 10 } },
};

/** The kinds with a top-view drawing; the rest show as a box. */
const DRAWN: ReadonlySet<SizeKind> = new Set<SizeKind>(
  (Object.keys(STANDARD_SIZES) as SizeKind[]).filter(k => k !== 'cableCrossover' && k !== 'weightStack'),
);

const BY_EQUIPMENT: Record<string, SizeKind> = {
  'eq-leg-press': 'legPress',
  'eq-leg-extension': 'legExtension',
  'eq-cable-crossover': 'cableCrossover',
  'eq-cable': 'cableCrossover',
  'eq-lat-pulldown': 'pulldown',
  'eq-latpull': 'pulldown',
};

// Strength machines, by name. Checked before the cardio and free-weight kinds:
// a bench press station is not a bench, and a "seated cable row" is a
// pulldown/row station, not a rower.
// Whether a machine has plates on horns or a weight stack is its tag, not its name:
// `plated` picks the plate-loaded drawing of the machines that have one.
const kindFromName = (name: string, plated = false): SizeKind | null => {
  const n = name.toLowerCase();
  if (/leg press|hack squat/.test(n)) return 'legPress';
  if (/smith/.test(n)) return 'smith';
  if (/cable station|multi[ -]?(stack|station|gym)/.test(n)) return 'cableStation';
  // Before the rig: "Dual Cable Cross / Functional Trainer" is a cable machine.
  if (/cable cross|crossover/.test(n)) return 'cableCrossover';
  if (/functional train(er|ing)|training rig/.test(n)) return 'functionalTrainer';
  if (/low row/.test(n) && plated) return 'plateLowRow';
  if (/kettlebell/.test(n)) return 'kettlebell';
  if (/plyo/.test(n)) return 'plyoBox';
  if (/sprint (lane|track|strip)/.test(n)) return 'sprintLane';
  if (/pulldown|pull-down|lat pull|seated (cable )?row|low row|cable row/.test(n)) return 'pulldown';
  if (/bench press/.test(n)) return 'benchStation';
  if (/abductor/.test(n)) return 'hipAbductor';
  if (/adductor/.test(n)) return 'hipAdductor';
  if (/(prone|lying) leg curl/.test(n)) return 'proneLegCurl';
  if (/leg extension/.test(n)) return plated ? 'plateLegExtension' : 'legExtension';
  if (/leg curl/.test(n)) return 'legCurl';
  if (/delt|lateral raise/.test(n)) return 'deltsMachine';
  if (/shoulder press/.test(n) && plated) return 'plateShoulderPress';
  if (/(upper|incline) chest press/.test(n)) return plated ? 'plateUpperChestPress' : 'chestPress';
  if (/chest press/.test(n)) return plated ? 'plateChestPress' : 'chestPress';
  if (/chest press|shoulder press|leg extension|leg curl|pec deck|rear delt|abductor|adductor|ab crunch|tricep(s)? (press|extension) machine|bicep(s)? curl machine|preacher curl machine|glute (kickback|machine)|calf raise machine/.test(n)) return 'weightStack';
  return null;
};

const kindFromAnyName = (name: string | undefined, plated = false): SizeKind | null =>
  name ? kindFromName(name, plated) || machineShapeOf({ name }) : null;

export const isSizeKind = (kind: string | undefined): kind is SizeKind => !!kind && kind in STANDARD_SIZES;

/**
 * Which kind of machine this is, for its drawing and size, or null when
 * unknown. The kind someone picked for it comes first; then its own name, as
 * the admin typed it; then the Equipment Library item it was placed from, by
 * link and by name. A cable crossover from the library renamed "Cable
 * station" is a cable station.
 */
export const sizeKindOf = (machine: { name?: string; equipmentId?: string; kind?: string; plateLoaded?: boolean }, equipment?: EquipmentItem): SizeKind | null => {
  if (machine.kind === 'none') return null;
  if (isSizeKind(machine.kind)) return machine.kind;
  // The machine's own tag, else its library item's.
  const plated = !!(machine.plateLoaded ?? equipment?.plateLoaded);
  const linkedKind = machine.equipmentId ? BY_EQUIPMENT[machine.equipmentId] || machineShapeOf({ equipmentId: machine.equipmentId }) : null;
  const linked = linkedKind === 'legExtension' && plated ? 'plateLegExtension' : linkedKind;
  return kindFromAnyName(machine.name, plated) || linked || kindFromAnyName(equipment?.name, plated);
};

/** Whether a kind of machine has a top-view drawing, rather than showing as a box. */
export const isDrawn = (kind: SizeKind): boolean => DRAWN.has(kind);

/** Which drawing a machine gets on the map, or null when it shows as a box. */
export const drawnKindOf = (machine: { name?: string; equipmentId?: string; kind?: string; plateLoaded?: boolean }): DrawnKind | null => {
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
export const standardSizeOf = (machine: { name?: string; equipmentId?: string; kind?: string; plateLoaded?: boolean; cableLayout?: CableLayout }, equipment?: EquipmentItem): RealSize | null => {
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

const CLOCKWISE: Facing[] = ['up', 'right', 'down', 'left'];
/** A direction turned on by another, as quarter turns clockwise from up. */
const turnBy = (facing: Facing, by: Facing): Facing => CLOCKWISE[(CLOCKWISE.indexOf(facing) + CLOCKWISE.indexOf(by)) % 4];

// Which side of a drawing is the machine's front, where the person using it
// faces, for the machines whose front isn't the top: the owner's bench press
// and power rack, and the Smith machine, have the bar along one long side.
const FRONT_OF_DRAWING: Partial<Record<SizeKind, Facing>> = { benchStation: 'right', rack: 'left', smith: 'left' };

/** Whether a machine's drawing stands upright, long side up and down: most do, but a cable station and some of the sketches are wider than long. */
const drawsUpright = (machine: { name?: string; equipmentId?: string; kind?: string; plateLoaded?: boolean; cableLayout?: CableLayout }): boolean => {
  const kind = sizeKindOf(machine);
  if (kind === 'cableStation') {
    const [w, h] = cableStationExtent(readCableLayout(machine.cableLayout));
    return h >= w;
  }
  // Some of the owner's sketches are wider than long, as the machine is built.
  const drawing = kind ? (DRAWINGS as Record<string, { size: [number, number] }>)[kind] : undefined;
  return drawing ? drawing.size[1] >= drawing.size[0] : true;
};

type Placed = Pick<GymMachine, 'width' | 'height' | 'flipped' | 'name' | 'equipmentId' | 'kind' | 'plateLoaded' | 'cableLayout'>;

/**
 * Where the top of a machine's drawing points on the map. The drawing lies
 * along the footprint's long side, turned a quarter clockwise when the two
 * disagree, so its top is up or, turned, at the right; flipped, it is the
 * other way.
 */
const topOf = (machine: Placed): Facing => {
  const turned = drawsUpright(machine) !== (machine.height >= machine.width);
  return turnBy(turned ? 'right' : 'up', machine.flipped ? 'down' : 'up');
};

/** Where a machine's front points on the map: its drawing's top, or the side its front is on. */
export const facingOf = (machine: Placed): Facing =>
  turnBy(topOf(machine), FRONT_OF_DRAWING[sizeKindOf(machine) as SizeKind] || 'up');

/** A quarter turn clockwise, front and all: up, right, down, left and round again. */
export const rotateClockwise = (machine: GymMachine, zone: GymZone): Box & { flipped: boolean } => {
  const top = topOf(machine);
  // Swapping the sides alone takes a drawing lying on its side back upright; from
  // the side it has to go on round, so it ends up the other way up.
  const flipped = top === 'right' || top === 'left' ? !machine.flipped : !!machine.flipped;
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
    machines: (zone.machines || []).map(original => {
      // A machine takes its library item's Plate-loaded tag, which picks its sketch.
      const tag = equipmentFor(original, equipment)?.plateLoaded;
      const m = tag != null && original.plateLoaded == null ? { ...original, plateLoaded: tag } : original;
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
 * room is at that scale, the zones stretching with it; and every machine goes
 * to its real size in it.
 */
export const setRoomSize = (gym: Gym, widthM: number, lengthM: number, equipment: EquipmentItem[]): SizeReport => {
  const dims = gym.dimensions || { width: 780, height: 580 };
  const unitsPerMetre = dims.width / widthM;
  const scaled = { ...gym, dimensions: { ...dims, unitsPerMetre } };
  const room = { x: dims.x || 0, y: dims.y || 0, width: dims.width, height: round(lengthM * unitsPerMetre) };
  return applyStandardSizes(stretchRoom(scaled, room), equipment);
};

/** How many machines are not at their real size: what Apply would change. */
export const countOffSize = (gym: Pick<Gym, 'zones' | 'dimensions'>, equipment: EquipmentItem[]): number => {
  const upm = unitsPerMetreOf(gym.dimensions);
  return gym.zones.reduce((n, z) => n + (z.machines || []).filter(m => {
    const size = standardSizeOf(m, equipmentFor(m, equipment));
    return !!size && !isAtSize(m, size, upm);
  }).length, 0);
};
