import { describe, it, expect } from 'vitest';
import { adaptDaysToGym, selectGymSubstitute, doableAt } from './gymSwap';
import type { LibraryExercise, WorkoutDay, Exercise } from '../types';

const lib = (over: Partial<LibraryExercise> & { id: string }): LibraryExercise => ({
  name: over.id, targetMuscle: 'Legs', equipmentRequired: '', category: '', instructions: '',
  exerciseCategory: 'compound', generationEnabled: true, minExperience: 'Beginner', requiredEquipmentIds: [], ...over,
});

const legPress = lib({ id: 'leg-press', name: 'Leg Press', movementPattern: 'squat', primaryMuscles: ['Quads', 'Glutes'], requiredEquipmentIds: ['eq-leg-press'], equipmentId: 'zone-legs' });
const goblet = lib({ id: 'goblet', name: 'Goblet Squat', movementPattern: 'squat', primaryMuscles: ['Quads', 'Glutes'], requiredEquipmentIds: ['eq-dumbbell'] });
const bwSquat = lib({ id: 'bw-squat', name: 'Bodyweight Squat', movementPattern: 'squat', primaryMuscles: ['Quads'] });
const hack = lib({ id: 'hack', name: 'Hack Squat', movementPattern: 'squat', primaryMuscles: ['Quads', 'Glutes'], minExperience: 'Intermediate', requiredEquipmentIds: ['eq-hack'] });
const legExt = lib({ id: 'leg-ext', name: 'Leg Extension', movementPattern: 'knee_extension', primaryMuscles: ['Quads', 'Glutes'], exerciseCategory: 'isolation', requiredEquipmentIds: ['eq-leg-ext'] });
const latPd = lib({ id: 'lat-pd', name: 'Lat Pulldown', movementPattern: 'vertical_pull', primaryMuscles: ['Lats'], requiredEquipmentIds: ['eq-cable'] });
const treadmill = lib({ id: 'treadmill', name: 'Treadmill', exerciseCategory: 'cardio', bookendRoles: ['warmup', 'cooldown'], requiredEquipmentIds: ['eq-treadmill'] });
const bike = lib({ id: 'bike', name: 'Bike', exerciseCategory: 'cardio', bookendRoles: ['warmup', 'cooldown'], requiredEquipmentIds: ['eq-bike'], warmupNote: 'Easy spin' });
const matVideo = lib({ id: 'mat-flow', name: 'Mat flow', exerciseType: 'video', exerciseCategory: 'mobility', bookendRoles: ['warmup'], videoDurationLabel: '5 min', requiredEquipmentIds: ['eq-mat'] });
const standVideo = lib({ id: 'stand-flow', name: 'Standing flow', exerciseType: 'video', exerciseCategory: 'mobility', bookendRoles: ['warmup'], videoDurationLabel: '5 min' });

const library = [legPress, goblet, bwSquat, hack, legExt, latPd, treadmill, bike, matVideo, standVideo];
const byId = new Map(library.map(e => [e.id, e]));

const planned = (le: LibraryExercise, over: Partial<Exercise> = {}): Exercise => ({
  id: `ex-${le.id}`, name: le.name, targetMuscle: le.targetMuscle, sets: 3, reps: '8-10', equipmentId: le.equipmentId || 'manual',
  machineId: 'machine-7', libraryExerciseId: le.id, setDetails: [{ reps: '8-10', weight: '', restSec: 120 }],
  ...over,
});
const day = (exercises: Exercise[], id = 'd1'): WorkoutDay => ({
  id, name: 'Full Body 1', exercises,
  warmup: { kind: 'warmup', name: 'Warm-up', minutes: 15, steps: ['10 minutes easy cardio'] },
  cooldown: { kind: 'cooldown', name: 'Cooldown', minutes: 10, steps: ['5 minutes easy walking'] },
});
const warmupOn = (le: LibraryExercise): Exercise => planned(le, { id: 'warm', bookend: 'warmup', isCardio: true, cardioMinutes: 10, sets: 0, reps: '', setDetails: undefined });

const ALL = ['eq-leg-press', 'eq-dumbbell', 'eq-hack', 'eq-leg-ext', 'eq-cable', 'eq-treadmill', 'eq-bike', 'eq-mat'];
const at = (equipment: string[], days: WorkoutDay[], over: Partial<Parameters<typeof adaptDaysToGym>[1]> = {}) =>
  adaptDaysToGym(days, {
    library: byId, pool: library, availableEquipmentIds: new Set(equipment), gymName: 'MyFitness Ülemiste', ...over,
  });
const without = (...missing: string[]) => ALL.filter(e => !missing.includes(e));

describe('a location with everything the plan needs', () => {
  it('leaves the plan exactly as it is', () => {
    const days = [day([warmupOn(treadmill), planned(legPress), planned(latPd)])];
    const r = at(ALL, days);
    expect(r.changes).toEqual([]);
    expect(r.days[0]).toBe(days[0]);
  });
});

describe('an exercise this location cannot do', () => {
  it('is swapped for one with the same movement pattern that it can do', () => {
    const r = at(without('eq-leg-press'), [day([planned(legPress), planned(latPd)])]);
    const swapped = r.days[0].exercises[0];
    expect(swapped.libraryExerciseId).toBe('goblet');
    expect(swapped.name).toBe('Goblet Squat');
    expect(r.changes).toEqual([{ dayId: 'd1', from: 'Leg Press', to: 'Goblet Squat' }]);
    // Everything else in the day is untouched.
    expect(r.days[0].exercises[1]).toEqual(planned(latPd));
  });

  it('keeps the planned sets, reps and rest, so the session trains what it was meant to', () => {
    const r = at(without('eq-leg-press'), [day([planned(legPress)])]);
    const swapped = r.days[0].exercises[0];
    expect(swapped.sets).toBe(3);
    expect(swapped.reps).toBe('8-10');
    expect(swapped.setDetails).toEqual([{ reps: '8-10', weight: '', restSec: 120 }]);
  });

  it('is found on this location\'s map by its own equipment, not the planned machine', () => {
    const swapped = at(without('eq-leg-press'), [day([planned(legPress)])]).days[0].exercises[0];
    expect(swapped.machineId).toBeUndefined();
    expect(swapped.equipmentId).toBe('manual');
  });

  it('tells the client what it replaced and why', () => {
    const swapped = at(without('eq-leg-press'), [day([planned(legPress)])]).days[0].exercises[0];
    expect(swapped.substitutedFor).toEqual({ id: 'leg-press', name: 'Leg Press' });
    expect(swapped.adaptation).toMatchObject({ action: 'substitute', rule: 'GYM-1' });
    expect(swapped.adaptation!.reason).toMatch(/MyFitness Ülemiste doesn't have the equipment for Leg Press, so today it's Goblet Squat/);
  });

  it('never changes the movement pattern, however well another exercise matches the muscles', () => {
    // Leg extension trains the same muscles but is a different movement.
    const pool = [legPress, legExt, latPd];
    const r = at(without('eq-leg-press'), [day([planned(legPress), planned(latPd)])], { pool });
    expect(r.days[0].exercises.map(e => e.libraryExerciseId)).toEqual(['lat-pd']);
    expect(r.changes).toEqual([{ dayId: 'd1', from: 'Leg Press' }]);
  });

  it('prefers the one that trains more of the same muscles', () => {
    // Bodyweight squat needs nothing and sorts first, but trains only the quads.
    expect(selectGymSubstitute(legPress, [bwSquat, goblet])?.id).toBe('goblet');
  });

  it('prefers the same difficulty', () => {
    // Hack squat matches every muscle but is a step harder than the planned exercise.
    expect(selectGymSubstitute(legPress, [hack, goblet])?.id).toBe('goblet');
    expect(selectGymSubstitute({ ...legPress, minExperience: 'Intermediate' }, [hack, goblet])?.id).toBe('hack');
  });

  it('prefers the same kind of exercise, compound for compound', () => {
    const isoSquat = lib({ id: 'a-iso-squat', movementPattern: 'squat', primaryMuscles: ['Quads', 'Glutes'], exerciseCategory: 'isolation' });
    expect(selectGymSubstitute(legPress, [isoSquat, goblet])?.id).toBe('goblet');
  });

  it('only uses exercises this client may do here', () => {
    // Goblet squat is not in the pool, as if it loaded an injured joint.
    const r = at(without('eq-leg-press'), [day([planned(legPress)])], { pool: library.filter(e => e.id !== 'goblet') });
    expect(r.days[0].exercises[0].libraryExerciseId).toBe('bw-squat');
  });

  it('never uses one this location cannot do either', () => {
    const r = at(without('eq-leg-press', 'eq-dumbbell'), [day([planned(legPress)])]);
    expect(r.days[0].exercises[0].libraryExerciseId).toBe('bw-squat');
  });

  it('never repeats an exercise already in the day', () => {
    const r = at(without('eq-leg-press'), [day([planned(legPress), planned(goblet, { id: 'ex-goblet-2' })])]);
    expect(r.days[0].exercises[0].libraryExerciseId).toBe('bw-squat');
  });

  it('never gives two missing exercises in one day the same substitute', () => {
    const r = at(without('eq-leg-press', 'eq-hack'), [day([planned(legPress), planned({ ...hack, minExperience: 'Beginner' })])]);
    expect(r.days[0].exercises.map(e => e.libraryExerciseId)).toEqual(['goblet', 'bw-squat']);
  });

  it('never hands back an exercise the client withdrew for pain', () => {
    const r = at(without('eq-leg-press'), [day([planned(legPress)])], { withdrawnIds: new Set(['goblet']) });
    expect(r.days[0].exercises[0].libraryExerciseId).toBe('bw-squat');
  });

  it('is left out of today\'s session when nothing here comes close, and the client is told', () => {
    const r = at(without('eq-leg-press', 'eq-dumbbell', 'eq-hack'), [day([planned(legPress), planned(latPd)])], {
      pool: library.filter(e => e.id !== 'bw-squat'),
    });
    expect(r.days[0].exercises.map(e => e.libraryExerciseId)).toEqual(['lat-pd']);
    expect(r.changes).toEqual([{ dayId: 'd1', from: 'Leg Press' }]);
  });

  it('is swapped the same way on every day it appears', () => {
    const r = at(without('eq-leg-press'), [day([planned(legPress)], 'd1'), day([planned(legPress)], 'd2')]);
    expect(r.days.map(d => d.exercises[0].libraryExerciseId)).toEqual(['goblet', 'goblet']);
    expect(r.changes.map(c => c.dayId)).toEqual(['d1', 'd2']);
  });

  it('is never a video in place of a lift, or a lift in place of a video', () => {
    const absVideo = lib({ id: 'abs-video', exerciseType: 'video', movementPattern: 'core', primaryMuscles: ['Abs'], requiredEquipmentIds: ['eq-mat'] });
    const plank = lib({ id: 'plank', movementPattern: 'core', primaryMuscles: ['Abs'] });
    expect(selectGymSubstitute(absVideo, [plank])).toBeNull();
    expect(selectGymSubstitute(plank, [absVideo])).toBeNull();
  });
});

describe('what is left alone', () => {
  it('an exercise pulled for pain, which has its own handling', () => {
    const pulled = planned(legPress, { adaptation: { action: 'withdraw', rule: 'PAIN-5', reason: 'Knee pain' } });
    const r = at(without('eq-leg-press'), [day([pulled])]);
    expect(r.days[0].exercises[0]).toEqual(pulled);
    expect(r.changes).toEqual([]);
  });

  it('an exercise added by hand, whose equipment is not known', () => {
    const manual: Exercise = { id: 'm', name: 'Something', targetMuscle: '', sets: 3, reps: '10', equipmentId: 'manual' };
    const r = at([], [day([manual])]);
    expect(r.days[0].exercises).toEqual([manual]);
  });

  it('an exercise that needs no equipment', () => {
    expect(doableAt(bwSquat, new Set())).toBe(true);
    expect(at([], [day([planned(bwSquat)])]).changes).toEqual([]);
  });
});

describe('the warm-up, cool-down and zone 2 cardio', () => {
  it('moves the cardio to a machine this location has, keeping its minutes', () => {
    const r = at(without('eq-treadmill'), [day([warmupOn(treadmill), planned(latPd)])]);
    const warm = r.days[0].exercises[0];
    expect(warm).toMatchObject({ id: 'warm', bookend: 'warmup', libraryExerciseId: 'bike', name: 'Bike', cardioMinutes: 10, notes: 'Easy spin' });
    expect(r.changes).toEqual([{ dayId: 'd1', from: 'Treadmill', to: 'Bike', part: 'warmup' }]);
  });

  it('moves the warm-up and the cool-down to the same machine when both were on the missing one', () => {
    const cool = planned(treadmill, { id: 'cool', bookend: 'cooldown', isCardio: true, cardioMinutes: 5, sets: 0, reps: '', setDetails: undefined });
    const r = at(without('eq-treadmill'), [day([warmupOn(treadmill), planned(latPd), cool])]);
    expect(r.days[0].exercises.map(e => e.libraryExerciseId)).toEqual(['bike', 'lat-pd', 'bike']);
    expect(r.days[0].exercises[2]).toMatchObject({ id: 'cool', bookend: 'cooldown', cardioMinutes: 5 });
  });

  it('keeps the warm-up when the location has no cardio machine at all, done by its written steps', () => {
    const r = at(['eq-cable'], [day([warmupOn(treadmill), planned(latPd)])]);
    const warm = r.days[0].exercises[0];
    expect(warm).toMatchObject({ bookend: 'warmup', name: 'Warm-up', cardioMinutes: 10, equipmentId: 'manual', notes: '10 minutes easy cardio' });
    expect(warm.libraryExerciseId).toBeUndefined();
  });

  it('moves zone 2 cardio to another cardio machine, keeping its minutes', () => {
    const zone2 = planned(treadmill, { id: 'z2', finisher: 'zone2', isCardio: true, cardioMinutes: 10, sets: 0, reps: '' });
    const r = at(without('eq-treadmill'), [day([planned(latPd), zone2])]);
    expect(r.days[0].exercises[1]).toMatchObject({ id: 'z2', finisher: 'zone2', libraryExerciseId: 'bike', cardioMinutes: 10 });
    expect(r.changes).toEqual([{ dayId: 'd1', from: 'Treadmill', to: 'Bike', part: 'zone2' }]);
  });

  it('swaps a stretching video that needs equipment this location lacks for one that does not', () => {
    const video = planned(matVideo, { id: 'wv', bookend: 'warmup', isCardio: true, cardioMinutes: 5, sets: 0, reps: '' });
    const r = at(without('eq-mat'), [day([warmupOn(treadmill), video, planned(latPd)])]);
    expect(r.days[0].exercises[1]).toMatchObject({ id: 'wv', bookend: 'warmup', libraryExerciseId: 'stand-flow' });
  });
});

describe('the plan it was given', () => {
  it('is not changed', () => {
    const days = [day([warmupOn(treadmill), planned(legPress), planned(latPd)])];
    const copy = JSON.parse(JSON.stringify(days));
    at(['eq-cable'], days);
    expect(days).toEqual(copy);
  });

  it('copes with no days and empty days', () => {
    expect(at([], [])).toEqual({ days: [], changes: [] });
    const empty = day([]);
    expect(at([], [empty]).days[0]).toBe(empty);
  });
});
