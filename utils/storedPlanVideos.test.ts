import { describe, it, expect } from 'vitest';
import { generatePlan, buildCombinedBlueprint, eligibleExercises, gymEquipmentIds } from './planGeneration';
import type { GenerationProfile } from './planGeneration';
import { withBookendVideos } from './storedPlanVideos';
import type { LibraryExercise, Gym, WorkoutDay, Exercise } from '../types';

// --- fixtures ---------------------------------------------------------------

const exercise = (over: Partial<LibraryExercise> & { id: string; name: string }): LibraryExercise => ({
  targetMuscle: 'Chest', equipmentRequired: '', category: 'Compound (Strength)', instructions: '',
  movementPattern: 'horizontal_push', exerciseCategory: 'compound', generationEnabled: true,
  requiredEquipmentIds: [], ...over,
});
const gym: Gym = {
  id: 'g1', name: 'Test Gym',
  zones: [{ id: 'z1', name: 'Zone', type: 'strength' as any, x: 0, y: 0, width: 10, height: 10, color: '#fff', icon: 'dumbbell', equipmentIds: [] }],
};
const profile = (minutes: number, days = 3): GenerationProfile => ({
  goal: 'Muscle gain', experience: 'Beginner', daysPerWeek: days, sessionMinutes: minutes, injuryAreas: [],
});

const video = (id: string, over: Partial<LibraryExercise> = {}) => exercise({
  id, name: id, exerciseType: 'video', movementPattern: undefined, exerciseCategory: 'mobility',
  bookendRoles: ['warmup'], videoDurationLabel: '5 min', targetMuscle: 'Full body', ...over,
});
const warmVid = (n: number, minutes = '5 min', over: Partial<LibraryExercise> = {}) => video(`w${n}`, { videoDurationLabel: minutes, ...over });
const coolVid = (n: number, minutes = '5 min', over: Partial<LibraryExercise> = {}) =>
  video(`c${n}`, { bookendRoles: ['cooldown'], videoDurationLabel: minutes, ...over });

const lifts = [
  exercise({ id: 'squat', name: 'Squat', movementPattern: 'squat', primaryMuscles: ['Quads', 'Glutes'] }),
  exercise({ id: 'push', name: 'Push-up', movementPattern: 'horizontal_push', primaryMuscles: ['Chest'] }),
  exercise({ id: 'row', name: 'Pulldown', movementPattern: 'vertical_pull', primaryMuscles: ['Lats'] }),
  exercise({ id: 'hinge', name: 'Deadlift', movementPattern: 'hinge', primaryMuscles: ['Hamstrings'] }),
  exercise({ id: 'press', name: 'Press', movementPattern: 'vertical_push', primaryMuscles: ['Front delts'] }),
];
const bike = exercise({
  id: 'bike', name: 'Gym Bike', exerciseCategory: 'cardio', movementPattern: 'conditioning',
  bookendRoles: ['warmup', 'cooldown'],
});

const build = (library: LibraryExercise[], minutes: number, days = 3): WorkoutDay[] => {
  const r = generatePlan(
    { id: 't', name: 'T', goal: 'Muscle gain', daysPerWeek: String(days), durationMin: minutes, days: [], blueprintDays: buildCombinedBlueprint(['Muscle gain'], days, minutes) },
    library, gym, profile(minutes, days),
  );
  if (!r.ok) throw new Error('plan failed: ' + JSON.stringify(r));
  return r.days;
};

const apply = (stored: WorkoutDay[], library: LibraryExercise[], minutes: number) => {
  const p = profile(minutes);
  const pool = eligibleExercises(library, { profile: p, availableEquipmentIds: gymEquipmentIds(gym) });
  return withBookendVideos(stored, { sessionMinutes: minutes, pool, library: new Map(library.map(e => [e.id, e])) });
};

const at = (day: WorkoutDay, kind: 'warmup' | 'cooldown'): Exercise[] => day.exercises.filter(e => e.bookend === kind);
const idsAt = (day: WorkoutDay, kind: 'warmup' | 'cooldown') => at(day, kind).map(e => e.libraryExerciseId);

// A plan stored before there were any videos: the library has none when it is built.
const base = [...lifts, bike];
const videos = [warmVid(1), warmVid(2), warmVid(3), coolVid(1), coolVid(2), coolVid(3)];
const withVideos = [...base, ...videos];

describe('library videos in a plan stored without them', () => {
  it('starts written: the stretching is text, not videos', () => {
    const stored = build(base, 75);
    expect(at(stored[0], 'warmup')).toHaveLength(1);
    expect(stored[0].warmup!.extra!.join(' ')).toMatch(/Activation, about 5 minutes/);
  });

  it('puts the activation in as a video, after the cardio and before the lifting', () => {
    const day = apply(build(base, 75), withVideos, 75)[0];
    expect(idsAt(day, 'warmup')).toEqual(['bike', 'w1']);
    expect(day.exercises.slice(0, 2).map(e => e.bookend)).toEqual(['warmup', 'warmup']);
    expect(day.exercises[1]).toMatchObject({ libraryExerciseId: 'w1', isCardio: true, cardioMinutes: 5, bookend: 'warmup' });
  });

  it('takes the written activation out, since the video is it', () => {
    const day = apply(build(base, 75), withVideos, 75)[0];
    expect((day.warmup!.extra || []).join(' ')).not.toMatch(/Activation|Dead bugs|Band/);
    // What is not stretching stays.
    expect(day.warmup!.extra!.join(' ')).toMatch(/ramp-up sets/);
  });

  it('puts the cool-down stretching in after the walk, at the end', () => {
    const day = apply(build(base, 75), withVideos, 75)[0];
    expect(idsAt(day, 'cooldown')[0]).toBe('bike');
    expect(idsAt(day, 'cooldown').length).toBeGreaterThan(1);
    expect(day.exercises[day.exercises.length - 1].bookend).toBe('cooldown');
    expect((day.cooldown!.extra || []).join(' ')).not.toMatch(/Stretch what you trained/);
  });

  it('counts the videos in the warm-up and cool-down times', () => {
    const day = apply(build(base, 75), withVideos, 75)[0];
    expect(day.warmup!.minutes).toBe(15);
    const walk = at(day, 'cooldown')[0].cardioMinutes!;
    const videoMinutes = at(day, 'cooldown').slice(1).reduce((s, e) => s + e.cardioMinutes!, 0);
    expect(day.cooldown!.minutes).toBe(walk + videoMinutes);
  });

  it('keeps every lift where it was', () => {
    const stored = build(base, 75);
    const after = apply(stored, withVideos, 75);
    stored.forEach((d, i) => {
      expect(after[i].exercises.filter(e => !e.bookend).map(e => e.id)).toEqual(d.exercises.filter(e => !e.bookend).map(e => e.id));
    });
  });

  it('makes the same choices as building the plan afresh with those videos', () => {
    for (const minutes of [60, 75]) {
      const stored = apply(build(base, minutes), withVideos, minutes);
      const fresh = build(withVideos, minutes);
      stored.forEach((d, i) => {
        expect(idsAt(d, 'warmup'), `${minutes} min day ${i} warm-up`).toEqual(idsAt(fresh[i], 'warmup'));
        expect(idsAt(d, 'cooldown'), `${minutes} min day ${i} cool-down`).toEqual(idsAt(fresh[i], 'cooldown'));
        expect(d.warmup!.minutes).toBe(fresh[i].warmup!.minutes);
        expect(d.cooldown!.minutes).toBe(fresh[i].cooldown!.minutes);
        expect(d.warmup!.extra).toEqual(fresh[i].warmup!.extra);
        expect(d.cooldown!.extra).toEqual(fresh[i].cooldown!.extra);
      });
    }
  });

  it('rotates through the videos across the week rather than repeating one', () => {
    const days = apply(build(base, 75), withVideos, 75);
    const warm = days.map(d => idsAt(d, 'warmup')[1]);
    expect(new Set(warm).size).toBe(3);
  });

  it('matches the videos to the muscles the day trains', () => {
    const legs = [warmVid(1, '5 min', { primaryMuscles: ['Quads'] }), warmVid(2, '5 min', { primaryMuscles: ['Biceps'] })];
    const lib = [...base, ...legs];
    const stored = build(base, 75, 1);
    // One full-body day trains the quads, so the leg video comes first although w1 and w2 are otherwise level.
    expect(idsAt(apply(stored, lib, 75)[0], 'warmup')[1]).toBe('w1');
    const flipped = [warmVid(1, '5 min', { primaryMuscles: ['Biceps'] }), warmVid(2, '5 min', { primaryMuscles: ['Quads'] })];
    expect(idsAt(apply(stored, [...base, ...flipped], 75)[0], 'warmup')[1]).toBe('w2');
  });
});

describe('when it leaves a plan as it is', () => {
  it('changes nothing when the library has no video for the end', () => {
    const stored = build(base, 75);
    expect(apply(stored, base, 75)).toEqual(stored);
    const onlyWarm = apply(stored, [...base, warmVid(1)], 75);
    expect(idsAt(onlyWarm[0], 'cooldown')).toEqual(['bike']);
    expect(onlyWarm[0].cooldown).toEqual(stored[0].cooldown);
  });

  it('does not use a video that is not switched on for generation', () => {
    const stored = build(base, 75);
    const lib = [...base, warmVid(1, '5 min', { generationEnabled: false }), warmVid(2, '5 min', { generationEnabled: undefined })];
    expect(apply(stored, lib, 75)).toEqual(stored);
  });

  it('does not use a video the gym cannot do', () => {
    const stored = build(base, 75);
    const lib = [...base, warmVid(1, '5 min', { requiredEquipmentIds: ['eq-not-in-gym'] })];
    expect(apply(stored, lib, 75)).toEqual(stored);
  });

  it('does not use a video that is not tagged for an end, or is not a video', () => {
    const stored = build(base, 75);
    const lib = [...base, warmVid(1, '5 min', { bookendRoles: [], exerciseCategory: 'mobility' }), warmVid(2, '5 min', { exerciseType: 'standard' })];
    expect(apply(stored, lib, 75)).toEqual(stored);
  });

  it('puts a video at the end it is tagged for and no other', () => {
    const after = apply(build(base, 75), [...base, warmVid(1), coolVid(1)], 75);
    expect(idsAt(after[0], 'warmup')).toEqual(['bike', 'w1']);
    expect(idsAt(after[0], 'cooldown')).toEqual(['bike', 'c1']);
  });

  it('leaves the shortest sessions alone, which have no room for stretching', () => {
    const stored = build(base, 30);
    expect(apply(stored, withVideos, 30)).toEqual(stored);
  });

  it('at 45 minutes, stretches after the walk but has no stretching to add to the warm-up', () => {
    const stored = build(base, 45);
    const after = apply(stored, withVideos, 45);
    expect(idsAt(after[0], 'warmup')).toEqual(['bike']);
    expect(after[0].warmup).toEqual(stored[0].warmup);
    expect(idsAt(after[0], 'cooldown').length).toBeGreaterThan(1);
    // Exactly what building the plan afresh with the videos does.
    const fresh = build(withVideos, 45);
    expect(idsAt(after[0], 'cooldown')).toEqual(idsAt(fresh[0], 'cooldown'));
  });

  it('is idempotent: a plan that already has videos is not given more', () => {
    const once = apply(build(base, 75), withVideos, 75);
    expect(apply(once, withVideos, 75)).toEqual(once);
  });

  it('leaves an end that already has videos alone and still fills the other', () => {
    const half = apply(build(base, 75), [...base, warmVid(1), warmVid(2), warmVid(3)], 75);
    const both = apply(half, withVideos, 75);
    half.forEach((d, i) => expect(idsAt(both[i], 'warmup')).toEqual(idsAt(d, 'warmup')));
    expect(idsAt(both[0], 'cooldown').length).toBeGreaterThan(1);
  });

  it('does nothing for a day with no warm-up entry to put them beside', () => {
    const stored = build(base, 75).map(d => ({ ...d, exercises: d.exercises.filter(e => e.bookend !== 'warmup') }));
    const after = apply(stored, withVideos, 75);
    expect(at(after[0], 'warmup')).toEqual([]);
    expect(idsAt(after[0], 'cooldown').length).toBeGreaterThan(1);
  });

  it('copes with an empty plan, an empty library and a day with no exercises', () => {
    expect(apply([], withVideos, 75)).toEqual([]);
    const stored = build(base, 75);
    expect(apply(stored, [], 75)).toEqual(stored);
    const empty: WorkoutDay = { id: 'd', name: 'Empty', exercises: [] };
    expect(apply([empty], withVideos, 75)).toEqual([empty]);
  });

  it('does not change the plan it is given', () => {
    const stored = build(base, 75);
    const copy = JSON.parse(JSON.stringify(stored));
    apply(stored, withVideos, 75);
    expect(stored).toEqual(copy);
  });
});

describe('a pool that has not been filtered', () => {
  const ctx = (pool: LibraryExercise[]) => ({ sessionMinutes: 75, pool, library: new Map(pool.map(e => [e.id, e])) });

  it('still never uses a video that is not switched on', () => {
    const stored = build(base, 75);
    const pool = [warmVid(1, '5 min', { generationEnabled: false }), warmVid(2, '5 min', { generationEnabled: undefined }), coolVid(1, '5 min', { generationEnabled: false })];
    expect(withBookendVideos(stored, ctx([...base, ...pool]))).toEqual(stored);
  });
});

describe('the room a session has for them', () => {
  // Sessions of other lengths than the ones offered now are still stored, and
  // the room the bookends may take is a share of the session: at 46 minutes it
  // is 20, which the 25 minutes of warm-up and cool-down the shape asks for
  // already overruns, so there is nothing left for a video.
  it('puts none in where the session has no room, as building the plan afresh would', () => {
    for (const minutes of [46, 50, 90]) {
      const stored = apply(build(base, minutes), withVideos, minutes);
      const fresh = build(withVideos, minutes);
      stored.forEach((d, i) => {
        expect(idsAt(d, 'warmup'), `${minutes} min day ${i} warm-up`).toEqual(idsAt(fresh[i], 'warmup'));
        expect(idsAt(d, 'cooldown'), `${minutes} min day ${i} cool-down`).toEqual(idsAt(fresh[i], 'cooldown'));
      });
    }
    const stored46 = build(base, 46);
    expect(apply(stored46, withVideos, 46)).toEqual(stored46);
  });

  it('never lets the warm-up and cool-down run past their share of the session', () => {
    const long = [warmVid(1, '9 min'), warmVid(2, '9 min'), coolVid(1, '9 min'), coolVid(2, '9 min')];
    for (const minutes of [60, 75]) {
      for (const d of apply(build(base, minutes), [...base, ...long], minutes)) {
        expect(d.warmup!.minutes + d.cooldown!.minutes, `${minutes} min`).toBeLessThanOrEqual(Math.floor(minutes * 0.45));
      }
    }
  });
});
