import { describe, it, expect } from 'vitest';
import {
  checkEligibility, eligibleExercises, gymEquipmentIds, selectSplit,
  selectForSlot, estimateDayMinutes, generatePlan, validatePlan,
  GenerationProfile, EligibilityContext,
} from './planGeneration';
import type { GenerationFailure } from './planGeneration';
import { LibraryExercise, Gym, ExerciseSlot, PlanTemplate } from '../types';

// --- fixtures ---------------------------------------------------------------

const exercise = (over: Partial<LibraryExercise> & { id: string; name: string }): LibraryExercise => ({
  targetMuscle: 'Chest',
  equipmentRequired: '',
  category: 'Compound (Strength)',
  instructions: '',
  movementPattern: 'horizontal_push',
  exerciseCategory: 'compound',
  generationEnabled: true,
  requiredEquipmentIds: [],
  ...over,
});

const gym = (equipmentIds: string[]): Gym => ({
  id: 'g1',
  name: 'Test Gym',
  zones: [{
    id: 'z1', name: 'Zone', type: 'strength' as any, x: 0, y: 0, width: 10, height: 10,
    color: '#fff', icon: 'dumbbell', equipmentIds,
  }],
});

const profile = (over: Partial<GenerationProfile> = {}): GenerationProfile => ({
  goal: 'Muscle gain',
  experience: 'Beginner',
  daysPerWeek: 1,
  sessionMinutes: 60,
  injuryAreas: [],
  ...over,
});

const ctx = (g: Gym, p = profile()): EligibilityContext => ({
  profile: p,
  availableEquipmentIds: gymEquipmentIds(g),
});

const slot = (over: Partial<ExerciseSlot> & { id: string }): ExerciseSlot => ({
  movementPattern: 'horizontal_push',
  priority: 1,
  setsMin: 3, setsMax: 4,
  repsMin: 8, repsMax: 12,
  restSeconds: 90,
  ...over,
});

// --- equipment --------------------------------------------------------------

describe('gym equipment eligibility', () => {
  it('is eligible when the gym has every required item', () => {
    const ex = exercise({ id: 'e1', name: 'Bench Press', requiredEquipmentIds: ['barbell', 'bench'] });
    expect(checkEligibility(ex, ctx(gym(['barbell', 'bench']))).eligible).toBe(true);
  });

  it('is ineligible when any required item is missing', () => {
    const ex = exercise({ id: 'e1', name: 'Bench Press', requiredEquipmentIds: ['barbell', 'bench'] });
    const result = checkEligibility(ex, ctx(gym(['barbell'])));
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('equipment_unavailable');
  });

  it('collects equipment across every zone in the gym', () => {
    const g: Gym = {
      id: 'g', name: 'Multi', zones: [
        { id: 'z1', name: 'A', type: 'strength' as any, x: 0, y: 0, width: 1, height: 1, color: '', icon: '', equipmentIds: ['barbell'] },
        { id: 'z2', name: 'B', type: 'strength' as any, x: 0, y: 0, width: 1, height: 1, color: '', icon: '', equipmentIds: ['bench'] },
      ],
    };
    expect(gymEquipmentIds(g)).toEqual(new Set(['barbell', 'bench']));
  });
});

// --- fail closed ------------------------------------------------------------

describe('safety fails closed', () => {
  it('rejects an exercise that was never generation-enabled', () => {
    const ex = exercise({ id: 'e1', name: 'Untagged', generationEnabled: undefined });
    expect(checkEligibility(ex, ctx(gym([]))).reason).toBe('not_generation_enabled');
  });

  it('rejects an exercise with no movement pattern rather than guessing', () => {
    const ex = exercise({ id: 'e1', name: 'Half tagged', movementPattern: undefined });
    expect(checkEligibility(ex, ctx(gym([]))).reason).toBe('missing_movement_pattern');
  });

  it('rejects an exercise stressing an injured area', () => {
    const ex = exercise({ id: 'e1', name: 'Overhead Press', jointStress: ['Shoulders'] });
    const result = checkEligibility(ex, ctx(gym([]), profile({ injuryAreas: ['Shoulders'] })));
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('injury_conflict');
  });

  it('rejects an exercise above the user experience level', () => {
    const ex = exercise({ id: 'e1', name: 'Snatch', minExperience: 'Advanced' });
    expect(checkEligibility(ex, ctx(gym([]), profile({ experience: 'Beginner' }))).reason).toBe('experience_too_high');
  });
});

// --- eligibility precedes scoring -------------------------------------------

describe('ineligible exercises never reach selection', () => {
  it('does not select an ineligible exercise even when it is the only candidate', () => {
    const unavailable = exercise({ id: 'e1', name: 'Bench Press', requiredEquipmentIds: ['barbell'] });
    const pool = eligibleExercises([unavailable], ctx(gym([])));
    expect(pool).toHaveLength(0);
    expect(selectForSlot(slot({ id: 's1' }), pool, profile(), new Set())).toBeNull();
  });
});

// --- selection --------------------------------------------------------------

describe('slot selection', () => {
  it('picks an exercise matching the slot movement pattern', () => {
    const push = exercise({ id: 'push', name: 'Bench Press' });
    const pull = exercise({ id: 'pull', name: 'Row', movementPattern: 'horizontal_pull' });
    const picked = selectForSlot(slot({ id: 's1', movementPattern: 'horizontal_push' }), [push, pull], profile(), new Set());
    expect(picked?.id).toBe('push');
  });

  it('avoids reusing an exercise already placed in the same day', () => {
    const a = exercise({ id: 'a', name: 'A' });
    const b = exercise({ id: 'b', name: 'B' });
    const picked = selectForSlot(slot({ id: 's1' }), [a, b], profile(), new Set(['a']));
    expect(picked?.id).toBe('b');
  });

  it('is deterministic across repeated runs', () => {
    const pool = [exercise({ id: 'b', name: 'B' }), exercise({ id: 'a', name: 'A' }), exercise({ id: 'c', name: 'C' })];
    const runs = Array.from({ length: 20 }, () => selectForSlot(slot({ id: 's1' }), pool, profile(), new Set())?.id);
    expect(new Set(runs).size).toBe(1);
  });
});

// --- split ------------------------------------------------------------------

describe('split selection', () => {
  it('uses full body for 3 days', () => expect(selectSplit(3).split).toBe('full_body'));
  it('uses upper/lower for 4 days', () => expect(selectSplit(4).split).toBe('upper_lower'));
  it('returns one day name per training day', () => expect(selectSplit(4).dayNames).toHaveLength(4));
});

// --- duration ---------------------------------------------------------------

describe('duration handling', () => {
  it('drops an optional slot when the day runs over', () => {
    const pool = [
      exercise({ id: 'p1', name: 'Push' }),
      exercise({ id: 'p2', name: 'Pull', movementPattern: 'horizontal_pull' }),
    ];
    const blueprint: PlanTemplate = {
      id: 't1', name: 'T', goal: 'Muscle gain', daysPerWeek: '1', durationMin: 20, days: [],
      blueprintDays: [{
        id: 'bd1', name: 'Day 1', slots: [
          slot({ id: 's1', movementPattern: 'horizontal_push', priority: 1 }),
          slot({ id: 's2', movementPattern: 'horizontal_pull', priority: 9, optional: true }),
        ],
      }],
    };
    const result = generatePlan(blueprint, pool, gym([]), profile({ sessionMinutes: 12, daysPerWeek: 1 }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.days[0].exercises).toHaveLength(1);
      expect(result.decisions.some(d => d.dropped && d.droppedReason === 'duration')).toBe(true);
    }
  });

  it('fails rather than shipping an over-length plan of required-only work', () => {
    const pool = [exercise({ id: 'p1', name: 'Push' })];
    const blueprint: PlanTemplate = {
      id: 't1', name: 'T', goal: 'Muscle gain', daysPerWeek: '1', durationMin: 5, days: [],
      blueprintDays: [{ id: 'bd1', name: 'Day 1', slots: [slot({ id: 's1', priority: 1 })] }],
    };
    const result = generatePlan(blueprint, pool, gym([]), profile({ sessionMinutes: 1, daysPerWeek: 1 }));
    expect(result.ok).toBe(false);
    expect((result as GenerationFailure).reason).toBe('cannot_fit_duration');
  });

  it('counts rest between sets, not after the last one', () => {
    // 2 sets x 10 reps x 3s = 60s work, 1 rest gap of 60s, 60s setup = 180s = 3 min, +5 warmup
    expect(estimateDayMinutes([{ sets: 2, reps: 10, restSeconds: 60 }])).toBe(8);
  });
});

// --- failure ----------------------------------------------------------------

describe('generation failure', () => {
  it('fails when a required slot has no eligible candidate', () => {
    const blueprint: PlanTemplate = {
      id: 't1', name: 'T', goal: 'Muscle gain', daysPerWeek: '1', durationMin: 60, days: [],
      blueprintDays: [{ id: 'bd1', name: 'Day 1', slots: [slot({ id: 's1', movementPattern: 'vertical_pull' })] }],
    };
    const result = generatePlan(blueprint, [exercise({ id: 'p1', name: 'Push' })], gym([]), profile());
    expect(result.ok).toBe(false);
    expect((result as GenerationFailure).reason).toBe('no_candidate_for_slot');
  });

  it('skips an optional slot with no candidate instead of failing', () => {
    const blueprint: PlanTemplate = {
      id: 't1', name: 'T', goal: 'Muscle gain', daysPerWeek: '1', durationMin: 60, days: [],
      blueprintDays: [{
        id: 'bd1', name: 'Day 1', slots: [
          slot({ id: 's1', movementPattern: 'horizontal_push' }),
          slot({ id: 's2', movementPattern: 'vertical_pull', optional: true }),
        ],
      }],
    };
    const result = generatePlan(blueprint, [exercise({ id: 'p1', name: 'Push' })], gym([]), profile());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.days[0].exercises).toHaveLength(1);
  });
});

// --- end to end -------------------------------------------------------------

describe('end to end generation', () => {
  const library = [
    exercise({ id: 'bench', name: 'Bench Press', movementPattern: 'horizontal_push', requiredEquipmentIds: ['barbell', 'bench'] }),
    exercise({ id: 'pushup', name: 'Push-up', movementPattern: 'horizontal_push', requiredEquipmentIds: [] }),
    exercise({ id: 'row', name: 'Dumbbell Row', movementPattern: 'horizontal_pull', requiredEquipmentIds: ['dumbbell'] }),
    exercise({ id: 'curl', name: 'Biceps Curl', movementPattern: 'horizontal_pull', exerciseCategory: 'isolation', requiredEquipmentIds: ['dumbbell'] }),
  ];
  const blueprint: PlanTemplate = {
    id: 't1', name: 'Muscle Gain 1 Day', goal: 'Muscle gain', daysPerWeek: '1', durationMin: 60, days: [],
    blueprintDays: [{
      id: 'bd1', name: 'Full Body', slots: [
        slot({ id: 's1', movementPattern: 'horizontal_push', priority: 1 }),
        slot({ id: 's2', movementPattern: 'horizontal_pull', priority: 2 }),
      ],
    }],
  };

  it('generates a valid plan from an equipped gym', () => {
    const g = gym(['barbell', 'bench', 'dumbbell']);
    const p = profile({ daysPerWeek: 1, sessionMinutes: 60 });
    const result = generatePlan(blueprint, library, g, p);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.days[0].exercises.map(e => e.name)).toEqual(['Bench Press', 'Dumbbell Row']);
    expect(validatePlan(result.days, library, g, p).valid).toBe(true);
  });

  it('substitutes a bodyweight option when the gym lacks a barbell', () => {
    const g = gym(['dumbbell']);
    const result = generatePlan(blueprint, library, g, profile({ daysPerWeek: 1 }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.days[0].exercises[0].name).toBe('Push-up');
  });

  it('never prescribes a weight it has no basis for', () => {
    const result = generatePlan(blueprint, library, gym(['barbell', 'bench', 'dumbbell']), profile({ daysPerWeek: 1 }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      result.days[0].exercises.forEach(ex => {
        ex.setDetails?.forEach(sd => expect(sd.weight).toBe(''));
      });
    }
  });

  it('records why each exercise was selected', () => {
    const result = generatePlan(blueprint, library, gym(['barbell', 'bench', 'dumbbell']), profile({ daysPerWeek: 1 }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const d = result.decisions.find(x => x.slotId === 's1');
      expect(d?.selectedExerciseName).toBe('Bench Press');
      expect(d?.movementPattern).toBe('horizontal_push');
    }
  });
});

// --- validation catches what selection might miss ----------------------------

describe('validation is independent of selection', () => {
  it('rejects a plan containing an exercise the gym cannot support', () => {
    const library = [exercise({ id: 'bench', name: 'Bench Press', requiredEquipmentIds: ['barbell'] })];
    const days = [{
      id: 'd1', name: 'Day 1',
      exercises: [{
        id: 'x', name: 'Bench Press', targetMuscle: 'Chest', sets: 3, reps: '8-12',
        equipmentId: 'manual', libraryExerciseId: 'bench',
        setDetails: [{ reps: '10', weight: '', restSec: 90 }],
      }],
    }];
    const result = validatePlan(days, library, gym([]), profile({ daysPerWeek: 1 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('not eligible'))).toBe(true);
  });
});
