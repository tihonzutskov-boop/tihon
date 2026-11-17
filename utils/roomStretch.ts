// When the room changes shape, what's laid out in it follows.
//
// Zones, inner walls and walkways stretch with the room, so they fill it the
// way they did: a zone along the back wall stays along the back wall, and two
// zones side by side stay side by side. Machines move with their zone but keep
// their real size; only a machine with no fixed size, like a placeholder that
// spans its zone, stretches too. Wings built onto the outside of the room
// stay against the wall they were against.

import { Gym, GymMachine } from '../types';

export type RoomBox = { x: number; y: number; width: number; height: number };

const round = (v: number) => Math.round(v * 100) / 100;

// Kept inside its zone when it fits; bigger than its zone, it is centred on it.
const fit = (pos: number, size: number, room: number) =>
  size <= room ? Math.min(Math.max(pos, 0), room - size) : (room - size) / 2;

/**
 * The gym with its room reshaped to `next` and everything in it following.
 * `keepsSize` says which machines have a real size to keep.
 */
export const stretchRoom = (gym: Gym, next: RoomBox, keepsSize: (m: GymMachine) => boolean): Gym => {
  const d = gym.dimensions || { width: 780, height: 580 };
  const from: RoomBox = { x: d.x || 0, y: d.y || 0, width: d.width, height: d.height };
  const sx = next.width / from.width, sy = next.height / from.height;
  const X = (x: number) => round(next.x + (x - from.x) * sx);
  const Y = (y: number) => round(next.y + (y - from.y) * sy);

  const zones = gym.zones.map(z => {
    const width = round(z.width * sx), height = round(z.height * sy);
    const machines = z.machines?.map(m => {
      if (!keepsSize(m)) return { ...m, x: round(m.x * sx), y: round(m.y * sy), width: round(m.width * sx), height: round(m.height * sy) };
      // Its middle moves with the zone; it stays its real size.
      const cx = (m.x + m.width / 2) * sx, cy = (m.y + m.height / 2) * sy;
      return { ...m, x: round(fit(cx - m.width / 2, m.width, width)), y: round(fit(cy - m.height / 2, m.height, height)) };
    });
    return { ...z, x: X(z.x), y: Y(z.y), width, height, ...(machines ? { machines } : {}) };
  });

  const walls = d.walls?.map(w => ({
    ...w, x1: X(w.x1), y1: Y(w.y1), x2: X(w.x2), y2: Y(w.y2),
    ...(w.controlX != null ? { controlX: X(w.controlX) } : {}),
    ...(w.controlY != null ? { controlY: Y(w.controlY) } : {}),
  }));
  const nodes = d.nodes?.map(n => ({ ...n, x: X(n.x), y: Y(n.y) }));
  const hallways = d.hallways?.map(h => ({ ...h, points: h.points.map(p => ({ x: X(p.x), y: Y(p.y) })) }));

  // A wing against a wall moves out or in with that wall.
  const right = from.x + from.width, bottom = from.y + from.height, near = 1;
  const annexes = gym.annexes?.map(a => {
    let dx = 0, dy = 0;
    if (a.x >= right - near) dx = next.x + next.width - right;
    else if (a.x + a.width <= from.x + near) dx = next.x - from.x;
    if (a.y >= bottom - near) dy = next.y + next.height - bottom;
    else if (a.y + a.height <= from.y + near) dy = next.y - from.y;
    return dx || dy ? { ...a, x: round(a.x + dx), y: round(a.y + dy) } : a;
  });

  return {
    ...gym,
    zones,
    ...(annexes ? { annexes } : {}),
    dimensions: {
      ...d, x: next.x, y: next.y, width: next.width, height: next.height,
      ...(walls ? { walls } : {}), ...(nodes ? { nodes } : {}), ...(hallways ? { hallways } : {}),
    },
  };
};
