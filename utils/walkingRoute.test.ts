import { describe, it, expect } from 'vitest';
import { planWalkingRoute, machineRect, Rect, RoutePlace } from './walkingRoute';
import { entrancePoint, optionPoint, RoutePoint } from './sessionRoute';
import { DEFAULT_GYM } from '../constants';
import { Gym, GymZone, GymMachine, GymWall } from '../types';

// --- fixtures ---------------------------------------------------------------

const machine = (id: string, x: number, y: number, width = 20, height = 20): GymMachine =>
  ({ id, name: id, x, y, width, height });

const zone = (id: string, x: number, y: number, width: number, height: number, machines: GymMachine[] = [], extra: Partial<GymZone> = {}): GymZone => ({
  id, name: id, type: 'Machine' as any, x, y, width, height, color: '#fff', icon: 'dumbbell', machines, ...extra,
});

const wall = (id: string, x1: number, y1: number, x2: number, y2: number, wallType: GymWall['wallType'] = 'interior'): GymWall =>
  ({ id, type: 'straight', wallType, x1, y1, x2, y2 });

const gymOf = (zones: GymZone[], extra: Partial<Gym['dimensions']> = {}, width = 200, height = 120): Pick<Gym, 'zones' | 'dimensions' | 'annexes'> => ({
  zones, dimensions: { width, height, x: 0, y: 0, ...extra }, annexes: [],
});

const at = (x: number, y: number): RoutePlace => ({ point: { x, y } });

// Every point along the walk, half a unit apart.
const samples = (points: RoutePoint[]): RoutePoint[] => {
  const out: RoutePoint[] = [];
  for (let k = 1; k < points.length; k++) {
    const [a, b] = [points[k - 1], points[k]];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.5));
    for (let s = 0; s <= steps; s++) out.push({ x: a.x + (b.x - a.x) * s / steps, y: a.y + (b.y - a.y) * s / steps });
  }
  return out;
};

const strictlyInside = (r: Rect, p: RoutePoint) =>
  p.x > r.x + 0.01 && p.x < r.x + r.width - 0.01 && p.y > r.y + 0.01 && p.y < r.y + r.height - 0.01;

const onEdge = (r: Rect, p: RoutePoint) => {
  const within = p.x >= r.x - 1e-6 && p.x <= r.x + r.width + 1e-6 && p.y >= r.y - 1e-6 && p.y <= r.y + r.height + 1e-6;
  const touches = [r.x, r.x + r.width].some(x => Math.abs(p.x - x) < 1e-6) || [r.y, r.y + r.height].some(y => Math.abs(p.y - y) < 1e-6);
  return within && touches;
};

// Inner legs only: the ends may join a start or finish that sits off the grid.
const innerLegsStraight = (points: RoutePoint[]) =>
  points.slice(1, -1).every((p, k, inner) => k === 0 || p.x === inner[k - 1].x || p.y === inner[k - 1].y);

// --- tests ------------------------------------------------------------------

describe('planWalkingRoute', () => {
  const target = machine('row', 20, 10);
  const cables = zone('cables', 20, 20, 60, 40, [target]);

  it('ends at the side of the machine, with the pin on its middle', () => {
    const route = planWalkingRoute(gymOf([cables]), at(100, 120), { zone: cables, machine: target })!;
    const rect = machineRect(cables, target);
    expect(route.pin).toEqual({ x: 50, y: 40 });
    expect(route.points[0]).toEqual({ x: 100, y: 120 });
    const last = route.points[route.points.length - 1];
    expect(onEdge(rect, last)).toBe(true);
    // It stops there rather than walking on into the machine.
    expect(samples(route.points).some(p => strictlyInside(rect, p))).toBe(false);
  });

  it('walks a few straight legs, not a staircase', () => {
    const route = planWalkingRoute(gymOf([cables]), at(100, 120), { zone: cables, machine: target })!;
    expect(innerLegsStraight(route.points)).toBe(true);
    // Corners between the start and the end: an open room needs two at most.
    expect(route.points.length - 2).toBeLessThanOrEqual(2);
  });

  it('meets the machine at the middle of the side it walks up to, not a corner', () => {
    // Approached along the aisle below it, the first bit reached is its corner.
    const bench = machine('bench', 0, 2, 60, 12);
    const top = zone('top', 100, 5, 60, 20, [bench]);
    const route = planWalkingRoute(gymOf([top]), at(20, 120), { zone: top, machine: bench })!;
    const rect = machineRect(top, bench);
    const last = route.points[route.points.length - 1];
    expect(onEdge(rect, last)).toBe(true);
    const middleOfASide = last.x === rect.x + rect.width / 2 || last.y === rect.y + rect.height / 2;
    expect(middleOfASide).toBe(true);
    expect(innerLegsStraight(route.points)).toBe(true);
  });

  it('does not slide to the middle of a side over another machine', () => {
    // A second machine stands right under the first one's middle.
    const bench = machine('bench', 0, 2, 60, 12);
    const top = zone('top', 100, 5, 60, 20, [bench]);
    const box = machine('box', 25, 0, 10, 10);
    const below = zone('below', 100, 21, 60, 10, [box]);
    const route = planWalkingRoute(gymOf([top, below]), at(20, 120), { zone: top, machine: bench })!;
    const pts = samples(route.points);
    expect(pts.some(p => strictlyInside(machineRect(below, box), p))).toBe(false);
    expect(onEdge(machineRect(top, bench), route.points[route.points.length - 1])).toBe(true);
  });

  it('goes round a machine standing in the way, never over it', () => {
    const goal = machine('goal', 20, 3, 20, 10);
    const top = zone('top', 70, 5, 60, 20, [goal]);
    const blocker = machine('wall-of-racks', 0, 0, 80, 20);
    const racks = zone('racks', 60, 50, 80, 20, [blocker]);
    const route = planWalkingRoute(gymOf([top, racks]), at(100, 120), { zone: top, machine: goal })!;
    expect(route.points.length).toBeGreaterThan(2);
    expect(samples(route.points).some(p => strictlyInside(machineRect(racks, blocker), p))).toBe(false);
    expect(onEdge(machineRect(top, goal), route.points[route.points.length - 1])).toBe(true);
  });

  it('keeps to the aisles rather than cutting across another area', () => {
    // A straight line from the door to the machine runs over the turf; the
    // aisle beside it is barely longer.
    const goal = machine('goal', 5, 5, 10, 10);
    const top = zone('top', 90, 5, 20, 20, [goal]);
    const turf = zone('turf', 60, 40, 80, 60);
    const route = planWalkingRoute(gymOf([top, turf]), at(100, 120), { zone: top, machine: goal })!;
    const turfRect = { x: turf.x, y: turf.y, width: turf.width, height: turf.height };
    expect(samples(route.points).some(p => strictlyInside(turfRect, p))).toBe(false);
  });

  it('still crosses an area when going round would be far longer', () => {
    // The only way round this area is the long way, along the far walls.
    const goal = machine('goal', 5, 5, 10, 10);
    const top = zone('top', 90, 2, 20, 20, [goal]);
    const turf = zone('turf', 2, 30, 196, 60);
    const route = planWalkingRoute(gymOf([top, turf]), at(100, 120), { zone: top, machine: goal })!;
    const turfRect = { x: turf.x, y: turf.y, width: turf.width, height: turf.height };
    expect(samples(route.points).some(p => strictlyInside(turfRect, p))).toBe(true);
  });

  it('goes through the door in a wall, not the wall', () => {
    const goal = machine('goal', 10, 5, 20, 20);
    const corner = zone('corner', 10, 10, 40, 30, [goal]);
    const walls = [
      wall('w1', 0, 60, 150, 60),
      wall('door', 150, 60, 180, 60, 'door'),
      wall('w2', 180, 60, 200, 60),
    ];
    const route = planWalkingRoute(gymOf([corner], { walls }), at(100, 120), { zone: corner, machine: goal })!;
    const pts = samples(route.points);
    const crossings = pts.filter((p, k) => k > 0 && (pts[k - 1].y - 60) * (p.y - 60) <= 0 && pts[k - 1].y !== p.y);
    expect(crossings.length).toBeGreaterThan(0);
    for (const p of crossings) expect(p.x > 150 && p.x < 180).toBe(true);
  });

  it('follows a curved wall as drawn', () => {
    // An arc bulging down from y=60 to y=100 in the middle of the room, open at
    // the ends: the way through is round one end of it.
    const goal = machine('goal', 0, 0, 10, 10);
    const top = zone('top', 95, 10, 10, 10, [goal]);
    const arc: GymWall = { id: 'arc', type: 'curved', wallType: 'interior', x1: 40, y1: 60, x2: 160, y2: 60, controlX: 100, controlY: 140 };
    const route = planWalkingRoute(gymOf([top], { walls: [arc] }), at(100, 120), { zone: top, machine: goal })!;
    // Straight up from the door would cross the arc near y=100.
    const pts = samples(route.points);
    const passesUnderTheArc = pts.some(p => p.x > 60 && p.x < 140 && p.y > 70 && p.y < 95);
    expect(passesUnderTheArc).toBe(false);
  });

  it('does not let a door count as a wall', () => {
    const goal = machine('goal', 0, 0, 10, 10);
    const top = zone('top', 95, 10, 10, 10, [goal]);
    const route = planWalkingRoute(gymOf([top], { walls: [wall('d', 0, 60, 200, 60, 'door')] }), at(100, 120), { zone: top, machine: goal })!;
    // Straight up: nothing in the way.
    expect(route.points).toEqual([{ x: 100, y: 120 }, { x: 100, y: 20 }]);
  });

  it('still draws a route when walls seal the start in', () => {
    // A wall traced just inside the room's edge, with the entrance not drawn as
    // a door — common on a traced floor plan.
    const goal = machine('goal', 0, 0, 10, 10);
    const top = zone('top', 95, 10, 10, 10, [goal]);
    const route = planWalkingRoute(gymOf([top], { walls: [wall('e', 0, 115, 200, 115, 'exterior')] }), at(100, 120), { zone: top, machine: goal })!;
    expect(route.points.length).toBeGreaterThan(1);
  });

  it('goes to the middle of an area with no single machine', () => {
    const floor = zone('floor', 120, 10, 60, 40);
    const route = planWalkingRoute(gymOf([floor]), at(100, 120), { zone: floor, machine: null })!;
    expect(route.pin).toEqual({ x: 150, y: 30 });
    expect(route.points[route.points.length - 1]).toEqual({ x: 150, y: 30 });
    expect(innerLegsStraight(route.points)).toBe(true);
  });

  it('has nothing to walk when the client is already at the machine', () => {
    const route = planWalkingRoute(gymOf([cables]), { point: { x: 50, y: 40 }, zone: cables, machine: target }, { zone: cables, machine: target })!;
    expect(route.points).toEqual([]);
    expect(route.pin).toEqual({ x: 50, y: 40 });
  });

  it('leaves the last machine and walks to the next', () => {
    const other = machine('press', 5, 5);
    const legs = zone('legs', 120, 60, 40, 40, [other]);
    const from = { zone: legs, machine: other };
    const route = planWalkingRoute(gymOf([cables, legs]), { point: optionPoint(from), ...from }, { zone: cables, machine: target })!;
    expect(route.points[0]).toEqual(optionPoint(from));
    expect(onEdge(machineRect(cables, target), route.points[route.points.length - 1])).toBe(true);
  });

  it('steps off the last machine on the side facing the next one', () => {
    // A long, shallow machine with the next one straight ahead: the walk heads
    // straight for it rather than out of the nearest long side and round.
    const bench = machine('bench', 0, 0, 80, 20);
    const from = { zone: zone('row', 20, 50, 80, 20, [bench]), machine: bench };
    const goal = machine('goal', 10, 5, 20, 10);
    const next = zone('next', 140, 50, 40, 20, [goal]);
    const route = planWalkingRoute(gymOf([from.zone, next]), { point: optionPoint(from), ...from }, { zone: next, machine: goal })!;
    expect(samples(route.points).every(p => p.y >= 50 && p.y <= 70)).toBe(true);
  });

  it('reaches a machine smaller than the grid', () => {
    const tiny = machine('band-hook', 30, 20, 1, 1);
    const wallBars = zone('bars', 20, 20, 60, 40, [tiny]);
    const route = planWalkingRoute(gymOf([wallBars]), at(100, 120), { zone: wallBars, machine: tiny })!;
    expect(route.points.length).toBeGreaterThan(1);
  });

  it('keeps off the edge of a walkway on a long straight leg', () => {
    // An aisle from x=90 to x=110 between two areas, and a door near its left side.
    const goal = machine('goal', 85, 2, 10, 10);
    const top = zone('top', 10, 5, 180, 20, [goal]);
    const left = zone('left', 10, 30, 80, 100);
    const right = zone('right', 110, 30, 80, 100);
    const g = gymOf([top, left, right], {}, 200, 140);
    const route = planWalkingRoute(g, at(91, 140), { zone: top, machine: goal })!;
    const legs = route.points.slice(1).map((p, k) => ({ a: route.points[k], b: p }));
    const longest = legs.reduce((m, l) => (Math.abs(l.b.y - l.a.y) > Math.abs(m.b.y - m.a.y) ? l : m));
    expect(longest.a.x).toBe(longest.b.x);
    expect(longest.a.x).toBeGreaterThan(92.5);
    expect(longest.a.x).toBeLessThan(107.5);
  });

  it('is the same every time for the same floor', () => {
    const a = planWalkingRoute(gymOf([cables]), at(100, 120), { zone: cables, machine: target });
    const b = planWalkingRoute(gymOf([cables]), at(100, 120), { zone: cables, machine: target });
    expect(a).toEqual(b);
  });

  it('returns null for a gym with no floor plan', () => {
    expect(planWalkingRoute({ zones: [cables] }, at(0, 0), { zone: cables, machine: target })).toBeNull();
  });

  // The whole sample gym: from the door, and from each machine to the next,
  // every route ends on its machine and walks over no other machine.
  it('routes to every machine in the sample gym without walking over another', () => {
    const places = DEFAULT_GYM.zones.flatMap(z => (z.machines || []).map(m => ({ zone: z, machine: m })));
    const door = entrancePoint(DEFAULT_GYM.entrance, DEFAULT_GYM.dimensions)!;
    const starts: RoutePlace[] = [{ point: door }, ...places.map(p => ({ point: optionPoint(p), ...p }))];
    for (const from of starts) {
      for (const to of places) {
        if (to.machine.id === from.machine?.id) continue;
        const route = planWalkingRoute(DEFAULT_GYM, from, to)!;
        const rect = machineRect(to.zone, to.machine);
        expect(onEdge(rect, route.points[route.points.length - 1])).toBe(true);
        const others = places
          .filter(p => p.machine.id !== to.machine.id && p.machine.id !== from.machine?.id)
          .map(o => machineRect(o.zone, o.machine));
        const overAnother = samples(route.points).find(p => others.some(r => strictlyInside(r, p)));
        expect(overAnother).toBeUndefined();
      }
    }
  });
});
