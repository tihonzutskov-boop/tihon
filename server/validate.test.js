import { describe, it, expect } from 'vitest';
import {
  validateQuestionnaire, validatePlanPayload, validateExerciseLogs,
  validateCompletedWorkout, validateCheckinText, AIMS, TRAINING_TYPES, FOCUS_AREAS, MAX_FOCUS_AREAS,
  LOG_MAX_ENTRIES, LOG_MAX_SETS,
  PLAN_MAX_DAYS, PLAN_MAX_EXERCISES_PER_DAY,
} from './validate.js';

const answers = (over = {}) => ({
  age: 28, heightCm: 170, weightKg: 65, sex: 'Male',
  goals: ['Muscle gain'], level: 'Beginner',
  daysPerWeek: '3', minutesPerSession: '60 min',
  equipment: 'Anything', injuryAreas: [],
  ...over,
});
const bad = (over) => validateQuestionnaire(answers(over));

describe('questionnaire answers', () => {
  it('accepts what the app sends', () => {
    const r = validateQuestionnaire(answers({ secondaryGoals: ['Mobility'], gymId: 'g1', injuryAreas: ['Knees'], consent: true }));
    expect(r.ok).toBe(true);
    expect(r.value.goals).toEqual(['Muscle gain']);
    expect(r.value.secondaryGoals).toEqual(['Mobility']);
  });

  it('keeps the gym chain and the usual location in it', () => {
    const r = validateQuestionnaire(answers({ gymChain: 'MyFitness', gymId: 'g1' }));
    expect(r.ok).toBe(true);
    expect(r.value).toMatchObject({ gymChain: 'MyFitness', gymId: 'g1' });
    expect('gymChain' in validateQuestionnaire(answers({ gymId: 'g1' })).value).toBe(false);
  });

  it('refuses a gym chain that is not a short piece of text', () => {
    expect(bad({ gymChain: 'x'.repeat(121) }).ok).toBe(false);
    expect(bad({ gymChain: 42 }).ok).toBe(false);
  });

  it('accepts the training type and focus areas the app sends, and keeps them', () => {
    const r = validateQuestionnaire(answers({ trainingType: 'Strength', focusAreas: ['Glutes', 'Arms'] }));
    expect(r.ok).toBe(true);
    expect(r.value.trainingType).toBe('Strength');
    expect(r.value.focusAreas).toEqual(['Glutes', 'Arms']);
  });

  it('still accepts answers from before the training type and focus areas were asked', () => {
    const r = validateQuestionnaire(answers());
    expect(r.ok).toBe(true);
    expect('trainingType' in r.value).toBe(false);
    expect('focusAreas' in r.value).toBe(false);
    expect('focusAreas' in validateQuestionnaire(answers({ focusAreas: [] })).value).toBe(false);
  });

  it('only accepts a training type the app offers', () => {
    for (const t of TRAINING_TYPES) expect(bad({ trainingType: t }).ok).toBe(true);
    for (const t of ['Powerlifting', '', 5, ['Strength']]) expect(bad({ trainingType: t }).ok, String(t)).toBe(false);
  });

  it('only accepts focus areas the engine can act on, and at most three', () => {
    expect(bad({ focusAreas: ['Toes'] }).ok).toBe(false);
    expect(bad({ focusAreas: 'Arms' }).ok).toBe(false);
    expect(bad({ focusAreas: FOCUS_AREAS.slice(0, MAX_FOCUS_AREAS) }).ok).toBe(true);
    expect(bad({ focusAreas: FOCUS_AREAS.slice(0, MAX_FOCUS_AREAS + 1) }).ok).toBe(false);
    expect(bad({ focusAreas: Array.from({ length: 1000 }, () => 'Arms') }).ok).toBe(true); // repeats collapse to one
    expect(validateQuestionnaire(answers({ focusAreas: ['Arms', 'Arms', 'Core'] })).value.focusAreas).toEqual(['Arms', 'Core']);
  });

  it('refuses a days-per-week that would build an enormous plan', () => {
    // 60000 days made a 185 MB plan in testing.
    for (const days of ['60000', '0', '8', '-1', '3.5', 'abc', '', 3, null, undefined]) {
      expect(bad({ daysPerWeek: days }).ok, String(days)).toBe(false);
    }
    for (const days of ['1', '2', '3', '4', '5', '6', '7']) expect(bad({ daysPerWeek: days }).ok).toBe(true);
  });

  it('bounds the session length', () => {
    for (const m of ['5 min', '999 min', '60', '60 minutes', '', 60, null, undefined]) expect(bad({ minutesPerSession: m }).ok, String(m)).toBe(false);
    for (const m of ['45 min', '60 min', '75 min']) expect(bad({ minutesPerSession: m }).ok).toBe(true);
  });

  it('no longer takes a 30 or 90 minute session, nor a length in between', () => {
    for (const m of ['30 min', '40 min', '90 min', '120 min']) expect(bad({ minutesPerSession: m }).ok, m).toBe(false);
    expect(bad({ minutesPerSession: '30 min' }).error).toMatch(/45, 60 or 75/);
  });

  it('only accepts goals the engine has an aim for', () => {
    expect(bad({ goals: ['Get huge'] }).ok).toBe(false);
    expect(bad({ goals: [] }).ok).toBe(false);
    expect(bad({ goals: 'Muscle gain' }).ok).toBe(false);
    expect(bad({ goals: [...AIMS] }).ok).toBe(true);
    expect(bad({ goals: [...AIMS, 'Muscle gain'] }).ok).toBe(false); // more entries than there are aims
    expect(bad({ goals: Array.from({ length: 1000 }, () => 'Muscle gain') }).ok).toBe(false);
    expect(bad({ secondaryGoals: ['Nonsense'] }).ok).toBe(false);
  });

  it('drops repeats and secondary goals that are already main goals', () => {
    const r = validateQuestionnaire(answers({ goals: ['Muscle gain', 'Muscle gain', 'Endurance'], secondaryGoals: ['Endurance', 'Mobility', 'Mobility'] }));
    expect(r.value.goals).toEqual(['Muscle gain', 'Endurance']);
    expect(r.value.secondaryGoals).toEqual(['Mobility']);
  });

  it('leaves secondaryGoals out entirely when there are none', () => {
    expect('secondaryGoals' in validateQuestionnaire(answers()).value).toBe(false);
    expect('secondaryGoals' in validateQuestionnaire(answers({ secondaryGoals: [] })).value).toBe(false);
  });

  it('bounds the body measurements', () => {
    expect(bad({ age: 5 }).ok).toBe(false);
    expect(bad({ age: 28.5 }).ok).toBe(false);
    expect(bad({ age: '28' }).ok).toBe(false);
    expect(bad({ heightCm: 20 }).ok).toBe(false);
    expect(bad({ weightKg: 5000 }).ok).toBe(false);
    expect(bad({ weightKg: NaN }).ok).toBe(false);
  });

  it('bounds free text and lists', () => {
    expect(bad({ injuryNotes: 'x'.repeat(1001) }).ok).toBe(false);
    expect(bad({ avoidExercises: 'x'.repeat(501) }).ok).toBe(false);
    expect(bad({ injuryAreas: Array.from({ length: 50 }, (_, i) => `a${i}`) }).ok).toBe(false);
    expect(bad({ injuryAreas: ['x'.repeat(41)] }).ok).toBe(false);
    expect(bad({ equipment: '' }).ok).toBe(false);
  });

  it('stores only the fields it knows, so nothing rides along', () => {
    const r = validateQuestionnaire(answers({ preferredDays: ['mon'], isAdmin: true, huge: 'x'.repeat(100000) }));
    expect(r.ok).toBe(true);
    expect(Object.keys(r.value)).not.toContain('preferredDays');
    expect(Object.keys(r.value)).not.toContain('isAdmin');
    expect(Object.keys(r.value)).not.toContain('huge');
  });

  it('refuses something that is not an object', () => {
    for (const v of [null, undefined, 'x', 5, [], [answers()]]) expect(validateQuestionnaire(v).ok).toBe(false);
  });

  it('says what is wrong in words a person can act on', () => {
    expect(bad({ daysPerWeek: '60000' }).error).toMatch(/days per week/i);
  });
});

const planDay = (over = {}) => ({ id: 'd1', name: 'Full Body 1', exercises: [{ id: 'e1', name: 'Squat', sets: 3, reps: '10' }], ...over });

describe('plan saves', () => {
  it('accepts a normal plan and defaults the name', () => {
    const r = validatePlanPayload({ days: [planDay()] });
    expect(r.ok).toBe(true);
    expect(r.value.name).toBe('My Training Plan');
  });

  it('leaves fields the app owns exactly as sent', () => {
    const day = planDay({ weekday: 'mon', warmup: { x: 1 }, exercises: [{ id: 'e', name: 'Squat', sets: 3, setDetails: [{ reps: '8' }], libraryExerciseId: 'lib1', bookend: 'warmup' }] });
    expect(validatePlanPayload({ name: 'P', days: [day] }).value.days[0]).toEqual(day);
  });

  it('bounds days and exercises', () => {
    expect(validatePlanPayload({ days: Array.from({ length: PLAN_MAX_DAYS + 1 }, (_, i) => planDay({ id: `d${i}` })) }).ok).toBe(false);
    const many = Array.from({ length: PLAN_MAX_EXERCISES_PER_DAY + 1 }, (_, i) => ({ id: `e${i}`, name: 'x' }));
    expect(validatePlanPayload({ days: [planDay({ exercises: many })] }).ok).toBe(false);
  });

  it('bounds the total size', () => {
    const big = Array.from({ length: 60 }, (_, i) => ({ id: `e${i}`, name: 'x', notes: 'y'.repeat(20000) }));
    expect(validatePlanPayload({ days: [planDay({ exercises: big }), planDay({ id: 'd2', exercises: big })] }).ok).toBe(false);
  });

  it('refuses a shape the rest of the app cannot read', () => {
    for (const body of [null, {}, { days: 'nope' }, { days: [null] }, { days: [{ name: 'no id', exercises: [] }] },
      { days: [{ id: 'd', exercises: 'no' }] }, { days: [planDay({ exercises: [{ name: 'no id' }] })] },
      { days: [planDay({ exercises: [{ id: 'e', name: 'x', sets: 9999 }] })] },
      { days: [planDay()], name: 'x'.repeat(256) }]) {
      expect(validatePlanPayload(body).ok, JSON.stringify(body).slice(0, 60)).toBe(false);
    }
  });
});

const logEntry = (over = {}) => ({ exerciseId: 'ex1', planDayId: 'd1', weight: 40, sets: [{ reps: 10, targetReps: 10 }], effort: 3, pain: false, ...over });

const GYM_LOC = { gymId: 'g1', zoneId: 'z1', machineId: 'm1' };

describe('training logs', () => {
  it('accepts one entry or a batch, and cleans them', () => {
    expect(validateExerciseLogs(logEntry()).value).toHaveLength(1);
    const r = validateExerciseLogs([logEntry(), logEntry({ exerciseId: 'ex2', weight: null })]);
    expect(r.value.map(e => e.weightUnit)).toEqual(['kg', 'kg']);
    expect(r.value[1].weight).toBeNull();
  });

  it('keeps only reps and target reps on a set', () => {
    const r = validateExerciseLogs(logEntry({ sets: [{ reps: 8, targetReps: 10, junk: 'x'.repeat(1000) }] }));
    expect(r.value[0].sets).toEqual([{ reps: 8, targetReps: 10 }]);
  });

  it('bounds how much one request can log', () => {
    expect(validateExerciseLogs(Array.from({ length: LOG_MAX_ENTRIES + 1 }, () => logEntry())).ok).toBe(false);
    expect(validateExerciseLogs(logEntry({ sets: Array.from({ length: LOG_MAX_SETS + 1 }, () => ({ reps: 1 })) })).ok).toBe(false);
    expect(validateExerciseLogs([]).ok).toBe(false);
  });

  it('refuses values the database would reject or that cannot be real', () => {
    for (const over of [{ exerciseId: '' }, { exerciseId: 5 }, { sets: 'x' }, { sets: [{ reps: -1 }] }, { sets: [{ reps: 1.5 }] },
      { effort: 9 }, { effort: 2.5 }, { weight: 'heavy' }, { weight: -5 }, { weight: 99999 }, { weightUnit: 'stone' },
      { planDayId: 'x'.repeat(101) }, { painArea: 'x'.repeat(41) }, { painNote: 'x'.repeat(501) }]) {
      expect(validateExerciseLogs(logEntry(over)).ok, JSON.stringify(over)).toBe(false);
    }
  });

  it('treats pain as a strict yes', () => {
    expect(validateExerciseLogs(logEntry({ pain: 'true' })).value[0].pain).toBe(false);
    expect(validateExerciseLogs(logEntry({ pain: true })).value[0].pain).toBe(true);
  });
});

describe('where a logged exercise actually happened', () => {
  it('stores the gym, zone and machine when all three are given', () => {
    const r = validateExerciseLogs(logEntry(GYM_LOC));
    expect(r.value[0]).toMatchObject(GYM_LOC);
  });

  it('is fine with none of them — most exercises still have nowhere to route to', () => {
    const r = validateExerciseLogs(logEntry());
    expect(r.value[0].gymId).toBeUndefined();
    expect(r.value[0].zoneId).toBeUndefined();
    expect(r.value[0].machineId).toBeUndefined();
  });

  it('is fine with a zone but no specific machine — open floor has no one machine', () => {
    const r = validateExerciseLogs(logEntry({ gymId: 'g1', zoneId: 'z1' }));
    expect(r.value[0]).toMatchObject({ gymId: 'g1', zoneId: 'z1' });
    expect(r.value[0].machineId).toBeUndefined();
  });

  it('drops a machine or gym id with no zone to place it in, rather than storing a dangling reference', () => {
    expect(validateExerciseLogs(logEntry({ gymId: 'g1', machineId: 'm1' })).value[0].gymId).toBeUndefined();
    expect(validateExerciseLogs(logEntry({ zoneId: 'z1' })).value[0].zoneId).toBeUndefined();
  });

  it('refuses an oversized gym, zone or machine id', () => {
    expect(validateExerciseLogs(logEntry({ gymId: 'x'.repeat(101), zoneId: 'z1' })).ok).toBe(false);
    expect(validateExerciseLogs(logEntry({ gymId: 'g1', zoneId: 'x'.repeat(101) })).ok).toBe(false);
    expect(validateExerciseLogs(logEntry({ gymId: 'g1', zoneId: 'z1', machineId: 'x'.repeat(101) })).ok).toBe(false);
  });
});

describe('smaller writes', () => {
  it('cleans a completed workout and fills in defaults', () => {
    expect(validateCompletedWorkout({}).value).toEqual({ dayName: 'Workout', exerciseCount: 0, planDayId: null });
    expect(validateCompletedWorkout({ dayName: 'Upper', exerciseCount: 6, planDayId: 'd1' }).value.exerciseCount).toBe(6);
  });

  it('refuses an oversized or malformed workout record', () => {
    expect(validateCompletedWorkout({ dayName: 'x'.repeat(256) }).ok).toBe(false);
    expect(validateCompletedWorkout({ exerciseCount: 99999 }).ok).toBe(false);
    expect(validateCompletedWorkout({ planDayId: 'x'.repeat(101) }).ok).toBe(false);
  });

  it('bounds check-in text', () => {
    expect(validateCheckinText({ note: 'x'.repeat(1001) }).ok).toBe(false);
    expect(validateCheckinText({ planDayId: 'x'.repeat(101) }).ok).toBe(false);
    expect(validateCheckinText({ note: 'tired', planDayId: 'd1' }).value).toEqual({ planDayId: 'd1', note: 'tired' });
    expect(validateCheckinText({}).value).toEqual({ planDayId: null, note: null });
  });
});
