// When the room changes shape, what's laid out in it follows.
//
// The room is the main hall and its wings, one shape. Whichever part changes,
// the zones in it stretch with it, so they fill it the way they did: a zone
// along the back wall stays along the back wall, and two zones side by side
// stay side by side. Inner walls and walkways follow the same way. Machines
// move with their zone but never change size: a treadmill is the size it is,
// however big the room around it gets.
//
// A zone belongs to the part its middle is in. Making the hall bigger moves a
// wing out with the wall it's against, and the zones in the wing go with it,
// at their size; making a wing bigger stretches the zones in the wing and
// leaves the hall's alone.

import { Gym, GymZone } from '../types';

export type RoomBox = { x: number; y: number; width: number; height: number };

const round = (v: number) => Math.round(v * 100) / 100;

// Kept inside its zone when it fits; bigger than its zone, it is centred on it.
const fit = (pos: number, size: number, room: number) =>
  size <= room ? Math.min(Math.max(pos, 0), room - size) : (room - size) / 2;

const inside = (b: RoomBox, x: number, y: number) => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;

/** Taking one box to another: where a point lands, and how much wider and longer things get. */
interface Move { X: (x: number) => number; Y: (y: number) => number; sx: number; sy: number }

const moveBetween = (from: RoomBox, to: RoomBox): Move => {
  const sx = to.width / from.width, sy = to.height / from.height;
  return { X: x => round(to.x + (x - from.x) * sx), Y: y => round(to.y + (y - from.y) * sy), sx, sy };
};

const shiftBy = (dx: number, dy: number): Move => ({ X: x => round(x + dx), Y: y => round(y + dy), sx: 1, sy: 1 });

/** A zone and its machines taken along by a move: the zone stretches, the machines keep their size. */
const carryZone = (z: GymZone, mv: Move): GymZone => {
  const width = round(z.width * mv.sx), height = round(z.height * mv.sy);
  const machines = z.machines?.map(m => {
    // Its middle moves with the zone; it stays the size it is.
    const cx = (m.x + m.width / 2) * mv.sx, cy = (m.y + m.height / 2) * mv.sy;
    return { ...m, x: round(fit(cx - m.width / 2, m.width, width)), y: round(fit(cy - m.height / 2, m.height, height)) };
  });
  return { ...z, x: mv.X(z.x), y: mv.Y(z.y), width, height, ...(machines ? { machines } : {}) };
};

/**
 * The gym with every zone, wall, node and walkway carried by the move of the
 * part it's in: `moveOf` says which move a point is under, or null to leave
 * it. A zone goes by its middle.
 */
const carryAll = (gym: Gym, moveOf: (x: number, y: number) => Move | null): Gym => {
  const d = gym.dimensions || { width: 780, height: 580 };
  const point = (x: number, y: number): [number, number] => {
    const mv = moveOf(x, y);
    return mv ? [mv.X(x), mv.Y(y)] : [x, y];
  };
  const zones = gym.zones.map(z => {
    const mv = moveOf(z.x + z.width / 2, z.y + z.height / 2);
    return mv ? carryZone(z, mv) : z;
  });
  const walls = d.walls?.map(w => {
    const [x1, y1] = point(w.x1, w.y1), [x2, y2] = point(w.x2, w.y2);
    const control = w.controlX != null && w.controlY != null ? point(w.controlX, w.controlY) : null;
    return { ...w, x1, y1, x2, y2, ...(control ? { controlX: control[0], controlY: control[1] } : {}) };
  });
  const nodes = d.nodes?.map(n => { const [x, y] = point(n.x, n.y); return { ...n, x, y }; });
  const hallways = d.hallways?.map(h => ({ ...h, points: h.points.map(p => { const [x, y] = point(p.x, p.y); return { x, y }; }) }));
  return { ...gym, zones, dimensions: { ...d, ...(walls ? { walls } : {}), ...(nodes ? { nodes } : {}), ...(hallways ? { hallways } : {}) } };
};

const hallOf = (gym: Gym): RoomBox => {
  const d = gym.dimensions || { width: 780, height: 580 };
  return { x: d.x || 0, y: d.y || 0, width: d.width, height: d.height };
};

/**
 * The gym with its main hall reshaped to `next` and everything following:
 * what's in the hall stretches with it, and each wing moves out or in with the
 * wall it's against, taking what's in it along.
 */
export const stretchRoom = (gym: Gym, next: RoomBox): Gym => {
  const from = hallOf(gym);
  const right = from.x + from.width, bottom = from.y + from.height;
  // How far each wing moves with its wall: the wall on the side its middle is
  // past. Wings overlap the hall a little so the two stay joined, so where a
  // wing starts says less than where its middle is.
  const wings = (gym.annexes || []).map(a => {
    const cx = a.x + a.width / 2, cy = a.y + a.height / 2;
    let dx = 0, dy = 0;
    if (cx > right) dx = next.x + next.width - right;
    else if (cx < from.x) dx = next.x - from.x;
    if (cy > bottom) dy = next.y + next.height - bottom;
    else if (cy < from.y) dy = next.y - from.y;
    return { a, dx, dy };
  });
  const inHall = moveBetween(from, next);
  const moved = carryAll(gym, (x, y) => {
    if (inside(from, x, y)) return inHall;
    const wing = wings.find(w => inside(w.a, x, y));
    return wing ? shiftBy(wing.dx, wing.dy) : inHall;
  });
  const annexes = gym.annexes ? wings.map(({ a, dx, dy }) => (dx || dy ? { ...a, x: round(a.x + dx), y: round(a.y + dy) } : a)) : undefined;
  return {
    ...moved,
    ...(annexes ? { annexes } : {}),
    dimensions: { ...moved.dimensions!, x: next.x, y: next.y, width: next.width, height: next.height },
  };
};

/**
 * The gym with one wing moved or reshaped to `next`, and what's in the wing
 * following it. The hall and the other wings stay as they are.
 */
export const stretchWing = (gym: Gym, wingId: string, next: RoomBox): Gym => {
  const wing = (gym.annexes || []).find(a => a.id === wingId);
  if (!wing) return gym;
  const hall = hallOf(gym);
  const mv = moveBetween(wing, next);
  // Only what's in the wing and not in the hall: where they overlap is the hall's.
  const moved = carryAll(gym, (x, y) => (inside(wing, x, y) && !inside(hall, x, y) ? mv : null));
  return { ...moved, annexes: (gym.annexes || []).map(a => (a.id === wingId ? { ...a, x: next.x, y: next.y, width: next.width, height: next.height } : a)) };
};
