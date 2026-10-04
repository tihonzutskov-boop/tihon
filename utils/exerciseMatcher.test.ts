import { describe, it, expect } from 'vitest';
import { getExerciseLocations, implementOf } from './exerciseMatcher';
import { planSessionRoute } from './sessionRoute';
import { EquipmentType } from '../types';
import type { Exercise, Gym, GymZone, GymMachine, LibraryExercise } from '../types';

// --- fixtures ---------------------------------------------------------------

const machine = (id: string, name: string): GymMachine =>
  ({ id, name, x: 5, y: 5, width: 10, height: 10 });

// A type that says nothing about floor space, so whether a zone counts as
// "allowing open floor" comes only from what the test gives it.
const zone = (id: string, x: number, equipmentIds: string[], machines: GymMachine[] = []): GymZone => ({
  id, name: `Area ${id}`, type: EquipmentType.MACHINE,
  x, y: 0, width: 20, height: 20, color: '#fff', icon: 'dumbbell',
  machines, equipmentIds,
});

const gym = (zones: GymZone[]): Gym => ({
  id: 'g', name: 'G',
  dimensions: { width: 400, height: 100, x: 0, y: 0 },
  entrance: { side: 'left', offset: 40, width: 20 },
  zones,
} as Gym);

// A name that suggests no equipment at all — so any match has to come from what
// the exercise requires rather than what it is called.
const libraryEx = (over: Partial<LibraryExercise> = {}): LibraryExercise => ({
  id: 'ex-1', name: 'Warm up + Mobility', targetMuscle: 'Full body',
  equipmentRequired: '', category: 'Mobility', instructions: '', equipmentId: '',
  requiredEquipmentIds: ['eq-floor-mat'],
  ...over,
} as LibraryExercise);

describe('an exercise that needs open floor', () => {
  it('is connected to the zones that allow open floor, whatever it is called', () => {
    const g = gym([
      zone('rack', 0, ['eq-barbell-plates']),
      zone('floor-a', 100, ['eq-floor-mat']),
      zone('floor-b', 200, ['eq-floor-mat', 'eq-dumbbells']),
    ]);
    const result = getExerciseLocations(libraryEx(), g);
    expect(result.equipmentZones.map(z => z.id)).toEqual(['floor-a', 'floor-b']);
    expect(result.isMapped).toBe(true);
    expect(result.needsManualReview).toBe(false);
  });

  it('leaves out zones that do not allow it', () => {
    const g = gym([zone('rack', 0, ['eq-barbell-plates']), zone('floor', 100, ['eq-floor-mat'])]);
    const ids = getExerciseLocations(libraryEx(), g).matchedZones.map(z => z.id);
    expect(ids).toContain('floor');
    expect(ids).not.toContain('rack');
  });

  it('is unmapped when no zone allows it, rather than pinned somewhere arbitrary', () => {
    const g = gym([zone('rack', 0, ['eq-barbell-plates'])]);
    const result = getExerciseLocations(libraryEx(), g);
    expect(result.isMapped).toBe(false);
    expect(result.needsManualReview).toBe(true);
  });

  it('counts a functional zone as allowing it without the toggle being set', () => {
    // The zone editor's floor toggle and the matcher's own inference for
    // functional zones are one definition of "allowed"; routing must not use a
    // narrower one than the rest of the app.
    const functional = { ...zone('func', 100, []), type: EquipmentType.FUNCTIONAL };
    const result = getExerciseLocations(libraryEx(), gym([functional]));
    expect(result.equipmentZones.map(z => z.id)).toEqual(['func']);
  });

  it('does not pin the exercise to a machine in the floor zone', () => {
    // Nothing in the zone answers to this exercise. Falling back to the first
    // machine listed would send a warm-up to whichever rack happens to be first.
    const g = gym([zone('floor', 100, ['eq-floor-mat'], [machine('rack-1', 'Squat Rack')])]);
    const result = getExerciseLocations(libraryEx(), g);
    expect(result.primaryZone?.id).toBe('floor');
    expect(result.primaryMachine).toBeNull();
  });

  it('needs every piece of equipment it requires, not just the floor', () => {
    const g = gym([
      zone('floor-only', 100, ['eq-floor-mat']),
      zone('bells-only', 200, ['eq-kettlebells']),
      zone('both', 300, ['eq-floor-mat', 'eq-kettlebells']),
    ]);
    const swing = libraryEx({ name: 'Movement Circuit', requiredEquipmentIds: ['eq-kettlebells', 'eq-floor-mat'] });
    expect(getExerciseLocations(swing, g).equipmentZones.map(z => z.id)).toEqual(['both']);
  });
});

describe('an exercise that does not need open floor', () => {
  it('is not connected to floor zones by this rule', () => {
    const g = gym([zone('floor', 100, ['eq-floor-mat'])]);
    const dumbbell = libraryEx({ name: 'Movement Circuit', requiredEquipmentIds: ['eq-dumbbells'] });
    const result = getExerciseLocations(dumbbell, g);
    expect(result.equipmentZones).toEqual([]);
    expect(result.isMapped).toBe(false);
  });

  it('is not assumed to need floor just because nothing was filled in', () => {
    // Reading an empty requirement as "open floor" would route an exercise
    // nobody finished tagging and hide the gap the review flag exists to show.
    const g = gym([zone('floor', 100, ['eq-floor-mat'])]);
    const untagged = libraryEx({ name: 'Movement Circuit', requiredEquipmentIds: [] });
    expect(getExerciseLocations(untagged, g).isMapped).toBe(false);
  });

  it('behaves as before for a stored plan exercise that carries no requirements', () => {
    const g = gym([zone('floor', 100, ['eq-floor-mat'])]);
    const stored: Exercise = {
      id: 'e1', name: 'Warm up + Mobility', targetMuscle: 'Full body', sets: 0, reps: '', equipmentId: 'manual',
    };
    expect(getExerciseLocations(stored, g).isMapped).toBe(false);
  });
});

describe('routing an exercise that needs open floor', () => {
  const planExercise = (): Exercise => ({
    id: 'e1', name: 'Warm up + Mobility', targetMuscle: 'Full body', sets: 0, reps: '',
    equipmentId: 'manual', requiredEquipmentIds: ['eq-floor-mat'],
  });

  it('sends the client to the nearest floor zone and keeps the others as alternatives', () => {
    const g = gym([
      zone('far', 300, ['eq-floor-mat']),
      zone('rack', 150, ['eq-barbell-plates']),
      zone('near', 0, ['eq-floor-mat']),
    ]);
    const [stop] = planSessionRoute([planExercise()], g);
    expect(stop.zone?.id).toBe('near');
    expect(stop.machine).toBeNull();
    expect(stop.alternatives.map(o => o.zone.id)).toEqual(['far']);
  });

  it('still finds no zone for the same exercise when routing is not given its requirements', () => {
    const g = gym([zone('floor', 100, ['eq-floor-mat'])]);
    const bare = { ...planExercise() };
    delete bare.requiredEquipmentIds;
    expect(planSessionRoute([bare], g)[0].zone).toBeNull();
  });
});

describe('a dumbbell exercise is sent to the dumbbells, not a bench station that shares its name', () => {
  // The station is the user's own equipment item: a flat bench with uprights
  // for the barbell bench press. "Dumbbell Bench Press" contains "bench press",
  // which is what used to make it win.
  const station = (id = 'station') => ({ id, name: 'Bench Press', x: 5, y: 5, width: 10, height: 10, equipmentId: 'eq-bench-station' } as GymMachine);
  const dumbbells = (id = 'db') => ({ id, name: 'Dumbbells', x: 5, y: 5, width: 10, height: 10, equipmentId: 'eq-dumbbells' } as GymMachine);
  const freeWeights = (machines: GymMachine[], x = 0, id = 'free') =>
    ({ ...zone(id, x, []), name: 'Free Weights', type: EquipmentType.FREE_WEIGHTS, machines });

  const dbPress = (over: Partial<Exercise> = {}): Exercise => ({
    id: 'e1', name: 'Dumbbell Bench Press', targetMuscle: 'Chest', sets: 3, reps: '10', equipmentId: 'manual',
    requiredEquipmentIds: ['eq-dumbbells', 'eq-adj-bench'], ...over,
  });

  it('picks the dumbbells when both are in the same zone, whichever is listed first', () => {
    const g = gym([freeWeights([station(), dumbbells()])]);
    expect(getExerciseLocations(dbPress(), g).primaryMachine?.id).toBe('db');
  });

  it('picks the dumbbells from the implement in the name alone, when the exercise carries no tags', () => {
    const g = gym([freeWeights([station(), dumbbells()])]);
    const untagged = { id: 'e1', name: 'Dumbbell Bench Press', targetMuscle: 'Chest', sets: 3, reps: '10', equipmentId: 'manual' } as Exercise;
    expect(getExerciseLocations(untagged, g).primaryMachine?.id).toBe('db');
  });

  it('routes to the dumbbells even when the station is nearer the entrance', () => {
    const g = gym([
      freeWeights([station()], 0, 'near'),
      freeWeights([dumbbells()], 300, 'far'),
    ]);
    const [stop] = planSessionRoute([dbPress()], g);
    expect(stop.machine?.id).toBe('db');
    expect(stop.zone?.id).toBe('far');
  });

  it('ranks inside a zone the exercise is pinned to, rather than taking the first match', () => {
    // The best match overall is in another zone, so the pinned zone has to
    // choose among its own machines — and the station is listed first there.
    const exact = { id: 'exact', name: 'Dumbbell Bench Press', x: 5, y: 5, width: 10, height: 10, equipmentId: 'eq-dumbbells' } as GymMachine;
    const g = gym([freeWeights([station(), dumbbells()], 0, 'free'), freeWeights([exact], 300, 'other')]);
    const result = getExerciseLocations(dbPress({ equipmentId: 'free' }), g);
    expect(result.primaryZone?.id).toBe('free');
    expect(result.primaryMachine?.id).toBe('db');
  });

  it('never picks a machine that names a different implement', () => {
    const barbellBench = { id: 'bb', name: 'Barbell Bench Press', x: 5, y: 5, width: 10, height: 10 } as GymMachine;
    const g = gym([freeWeights([barbellBench, dumbbells()])]);
    const untagged = { id: 'e1', name: 'Dumbbell Bench Press', targetMuscle: 'Chest', sets: 3, reps: '10', equipmentId: 'manual' } as Exercise;
    expect(getExerciseLocations(untagged, g).primaryMachine?.id).toBe('db');
  });

  it('still sends a barbell bench press to the station', () => {
    const g = gym([freeWeights([dumbbells(), station()])]);
    const barbell = dbPress({ name: 'Barbell Bench Press', requiredEquipmentIds: ['eq-bench-station'] });
    expect(getExerciseLocations(barbell, g).primaryMachine?.id).toBe('station');
  });
});

describe('reading the implement from an exercise name', () => {
  it('finds the implement the name leads with', () => {
    expect(implementOf('Dumbbell Bench Press')).toBe('dumbbell');
    expect(implementOf('Barbell Row')).toBe('barbell');
    expect(implementOf('Cable Fly')).toBe('cable');
    expect(implementOf('Kettlebell Swing')).toBe('kettlebell');
    expect(implementOf('EZ Bar Curl')).toBe('ez bar');
  });

  it('accepts the plural', () => {
    expect(implementOf('Dumbbells Shoulder Press')).toBe('dumbbell');
  });

  it('finds none when the name names none', () => {
    expect(implementOf('Push-up')).toBeNull();
    expect(implementOf('Leg Press')).toBeNull();
    expect(implementOf('')).toBeNull();
  });

  it('does not mistake a word that merely contains one', () => {
    expect(implementOf('Cablestation Stretch')).toBeNull();
  });
});
