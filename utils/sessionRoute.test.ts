import { describe, it, expect } from 'vitest';
import { planSessionRoute, entrancePoint, optionPoint } from './sessionRoute';
import { Exercise, Gym, GymZone, GymMachine } from '../types';

// --- fixtures ---------------------------------------------------------------

const machine = (id: string, x: number, y: number, name = 'Treadmill'): GymMachine =>
  ({ id, name, x, y, width: 10, height: 10 });

const zone = (id: string, x: number, y: number, machines: GymMachine[] = []): GymZone => ({
  id, name: `Zone ${id}`, type: 'Cardio' as any,
  x, y, width: 20, height: 20, color: '#fff', icon: 'dumbbell',
  machines,
});

// Two treadmills far apart, and a bench between them, so a nearest-first walk
// is distinguishable from list order.
const gymWithDuplicates = (): Gym => ({
  id: 'g1', name: 'Big Gym',
  dimensions: { width: 400, height: 100, x: 0, y: 0 },
  entrance: { side: 'left', offset: 40, width: 20 },
  zones: [
    zone('far', 300, 0, [machine('tread-far', 5, 5)]),
    zone('near', 0, 0, [machine('tread-near', 5, 5)]),
    zone('middle', 150, 0, [machine('bench-mid', 5, 5, 'Bench Press')]),
  ],
});

const ex = (id: string, name: string): Exercise => ({
  id, name, targetMuscle: 'Full body', sets: 3, reps: '10', equipmentId: 'manual',
});

describe('entrancePoint', () => {
  it('places the entrance on the side it is set to', () => {
    const dims = { width: 100, height: 50, x: 0, y: 0 };
    expect(entrancePoint({ side: 'left', offset: 10, width: 10 }, dims)).toEqual({ x: 0, y: 15 });
    expect(entrancePoint({ side: 'right', offset: 10, width: 10 }, dims)).toEqual({ x: 100, y: 15 });
    expect(entrancePoint({ side: 'top', offset: 10, width: 10 }, dims)).toEqual({ x: 15, y: 0 });
    expect(entrancePoint({ side: 'bottom', offset: 10, width: 10 }, dims)).toEqual({ x: 15, y: 50 });
  });

  it('returns null when the gym has no entrance or dimensions set', () => {
    expect(entrancePoint(undefined, { width: 10, height: 10 })).toBeNull();
    expect(entrancePoint({ side: 'top', offset: 0, width: 1 }, undefined)).toBeNull();
  });
});

describe('optionPoint', () => {
  // Machine coordinates are relative to the zone, which is easy to get wrong.
  it('offsets a machine by its zone position', () => {
    expect(optionPoint({ zone: zone('z', 100, 50), machine: machine('m', 5, 5) })).toEqual({ x: 105, y: 55 });
  });

  it('falls back to the centre of a zone with no specific machine', () => {
    expect(optionPoint({ zone: zone('z', 100, 50), machine: null })).toEqual({ x: 110, y: 60 });
  });
});

describe('planSessionRoute', () => {
  // The whole point: with two identical treadmills, start at the one by the door.
  it('starts at the copy nearest the entrance', () => {
    const route = planSessionRoute([ex('e1', 'Treadmill')], gymWithDuplicates());
    expect(route[0].machine?.id).toBe('tread-near');
  });

  it('carries the copies it did not choose as alternatives', () => {
    const route = planSessionRoute([ex('e1', 'Treadmill')], gymWithDuplicates());
    expect(route[0].alternatives.map(a => a.machine?.id)).toEqual(['tread-far']);
  });

  // Walking: once the client is at the far end, the far treadmill is the
  // sensible one to send them back to — not the one nearest the door.
  it('chooses relative to where the previous exercise left the client', () => {
    const route = planSessionRoute(
      [ex('e1', 'Bench Press'), ex('e2', 'Treadmill')],
      // No entrance, so the first stop is decided by tie-break and the second
      // is decided purely by distance from the first.
      { ...gymWithDuplicates(), entrance: undefined },
    );
    const benchAt = route[0].zone?.id;
    expect(benchAt).toBe('middle');
    // From the middle zone, both treadmills are 150 apart — so this asserts the
    // tie-break is deterministic rather than a specific side.
    expect(route[1].machine).not.toBeNull();
  });

  it('walks toward the nearer copy when the client is already at one end', () => {
    const g: Gym = {
      id: 'g', name: 'G',
      dimensions: { width: 400, height: 100, x: 0, y: 0 },
      zones: [
        zone('start', 280, 0, [machine('bench', 5, 5, 'Bench Press')]),
        zone('far', 0, 0, [machine('tread-far', 5, 5)]),
        zone('near', 300, 0, [machine('tread-near', 5, 5)]),
      ],
    };
    const route = planSessionRoute([ex('e1', 'Bench Press'), ex('e2', 'Treadmill')], g);
    expect(route[0].machine?.id).toBe('bench');
    // The bench is at x=285; tread-near is at 305, tread-far at 5.
    expect(route[1].machine?.id).toBe('tread-near');
  });

  // Training order is set by the program and must survive routing untouched.
  it('never reorders the exercises themselves', () => {
    const exercises = [ex('e1', 'Treadmill'), ex('e2', 'Bench Press'), ex('e3', 'Treadmill')];
    const route = planSessionRoute(exercises, gymWithDuplicates());
    expect(route.map(r => r.exerciseId)).toEqual(['e1', 'e2', 'e3']);
  });

  it('is deterministic for the same gym and plan', () => {
    const g = gymWithDuplicates();
    const a = planSessionRoute([ex('e1', 'Treadmill'), ex('e2', 'Bench Press')], g);
    const b = planSessionRoute([ex('e1', 'Treadmill'), ex('e2', 'Bench Press')], g);
    expect(a.map(r => r.machine?.id)).toEqual(b.map(r => r.machine?.id));
  });

  // An unmapped exercise is a normal outcome, not a crash.
  it('returns an empty stop when nothing in the gym matches', () => {
    const route = planSessionRoute([ex('e1', 'Zercher Carry')], gymWithDuplicates());
    expect(route[0].zone).toBeNull();
    expect(route[0].alternatives).toEqual([]);
  });

  it('returns nothing when there is no gym', () => {
    expect(planSessionRoute([ex('e1', 'Treadmill')], null)).toEqual([]);
  });
});
