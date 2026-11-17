import { describe, it, expect } from 'vitest';
import { stretchRoom } from './roomStretch';
import { Gym, GymMachine, GymZone } from '../types';

const machine = (id: string, x: number, y: number, width: number, height: number): GymMachine => ({ id, name: id, x, y, width, height });
const zone = (id: string, x: number, y: number, width: number, height: number, machines: GymMachine[] = []): GymZone =>
  ({ id, name: id, type: 'Machine' as any, x, y, width, height, color: '#fff', icon: 'x', machines });
const room = (): Gym => ({
  id: 'g', name: 'G',
  dimensions: { width: 200, height: 100, walls: [{ id: 'w', type: 'straight', wallType: 'interior', x1: 100, y1: 0, x2: 100, y2: 100 }] },
  zones: [
    zone('left', 0, 0, 100, 100, [machine('tread', 10, 10, 9, 21), machine('fountain', 0, 0, 100, 100)]),
    zone('right', 100, 0, 100, 100),
  ],
  annexes: [{ id: 'wing', x: 200, y: 20, width: 50, height: 40 }],
});
const sized = (m: GymMachine) => m.id === 'tread';

describe('stretchRoom', () => {
  it('stretches the zones and walls so they still fill the room', () => {
    const g = stretchRoom(room(), { x: 0, y: 0, width: 300, height: 150 }, sized);
    expect(g.zones.map(z => [z.x, z.y, z.width, z.height])).toEqual([[0, 0, 150, 150], [150, 0, 150, 150]]);
    expect(g.dimensions!.walls![0]).toMatchObject({ x1: 150, y1: 0, x2: 150, y2: 150 });
  });

  it('moves machines with their zone at their real size, and stretches the ones without one', () => {
    const [tread, fountain] = stretchRoom(room(), { x: 0, y: 0, width: 300, height: 150 }, sized).zones[0].machines!;
    // Its middle was at (14.5, 20.5); half as much again is (21.75, 30.75).
    expect(tread).toMatchObject({ x: 17.25, y: 20.25, width: 9, height: 21 });
    expect(fountain).toMatchObject({ x: 0, y: 0, width: 150, height: 150 });
  });

  it('keeps a wing against the wall it was against', () => {
    const g = stretchRoom(room(), { x: 0, y: 0, width: 300, height: 100 }, sized);
    expect(g.annexes![0]).toMatchObject({ x: 300, y: 20 });
  });

  it('follows a wall dragged out to the left', () => {
    const g = stretchRoom(room(), { x: -100, y: 0, width: 300, height: 100 }, sized);
    expect(g.zones.map(z => [z.x, z.width])).toEqual([[-100, 150], [50, 150]]);
    expect(g.dimensions).toMatchObject({ x: -100, width: 300 });
  });
});
