import { describe, it, expect } from 'vitest';
import {
  checkEligibility, eligibleExercises, gymEquipmentIds, selectSplit,
  selectForSlot, estimateDayMinutes, generatePlan, validatePlan, buildDefaultBlueprint,
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

  it('fills a shoulder_abduction slot with a tagged lateral raise', () => {
    const raise = exercise({ id: 'raise', name: 'Lateral Raises', movementPattern: 'shoulder_abduction' });
    const bench = exercise({ id: 'bench', name: 'Bench Press', movementPattern: 'horizontal_push' });
    const picked = selectForSlot(
      slot({ id: 's1', movementPattern: 'shoulder_abduction' }), [raise, bench], profile(), new Set()
    );
    expect(picked?.id).toBe('raise');
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

// --- default blueprints (fully automatic, no admin authoring) ----------------

describe('default blueprints', () => {
  it('builds one day per training day', () => {
    expect(buildDefaultBlueprint('Muscle gain', 4)).toHaveLength(4);
    expect(buildDefaultBlueprint('Muscle gain', 2)).toHaveLength(2);
  });

  it('uses upper/lower at 4 days and full body at 3', () => {
    expect(buildDefaultBlueprint('Muscle gain', 4).map(d => d.name)).toEqual(['Upper', 'Lower', 'Upper', 'Lower']);
    expect(buildDefaultBlueprint('Muscle gain', 3).every(d => d.name.startsWith('Full Body'))).toBe(true);
  });

  it('prescribes heavier low-rep work for muscle gain than for endurance', () => {
    // Compare the main compound work, not the warm-up that now opens each day.
    const firstCompound = (goal: string) =>
      buildDefaultBlueprint(goal, 3)[0].slots.find(s => s.exerciseCategory === 'compound')!;
    const gain = firstCompound('Muscle gain');
    const endure = firstCompound('Endurance');
    expect(gain.repsMax).toBeLessThan(endure.repsMin);
    expect(gain.restSeconds).toBeGreaterThan(endure.restSeconds);
  });

  it('adds a conditioning finisher only for calorie-focused goals', () => {
    const hasConditioning = (goal: string) =>
      buildDefaultBlueprint(goal, 3)[0].slots.some(s => s.movementPattern === 'conditioning');
    expect(hasConditioning('Weight loss')).toBe(true);
    expect(hasConditioning('Endurance')).toBe(true);
    expect(hasConditioning('Muscle gain')).toBe(false);
  });

  it('always leaves at least one required slot so a day is never all-optional', () => {
    for (const goal of ['Muscle gain', 'Weight loss', 'General fitness', 'Endurance']) {
      for (const days of [1, 2, 3, 4]) {
        buildDefaultBlueprint(goal, days).forEach(d => {
          expect(d.slots.some(s => !s.optional)).toBe(true);
        });
      }
    }
  });

  it('gives Upper and Push days an optional shoulder_abduction slot', () => {
    // Lateral raises, front raises and rear delt flyes had no movement
    // pattern to fill, so they could never be selected even when tagged.
    const upperDay = buildDefaultBlueprint('Muscle gain', 4)[0];
    expect(upperDay.name).toBe('Upper');
    const upperSlot = upperDay.slots.find(s => s.movementPattern === 'shoulder_abduction');
    expect(upperSlot).toBeDefined();
    expect(upperSlot!.optional).toBe(true);

    const pushDay = buildDefaultBlueprint('Muscle gain', 5)[0];
    expect(pushDay.name).toBe('Push');
    const pushSlot = pushDay.slots.find(s => s.movementPattern === 'shoulder_abduction');
    expect(pushSlot).toBeDefined();
    expect(pushSlot!.optional).toBe(true);
  });

  it('falls back to a known prescription for an unrecognized goal', () => {
    const slots = buildDefaultBlueprint('Something Unknown', 3)[0].slots;
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].setsMin).toBeGreaterThan(0);
    expect(slots[0].repsMin).toBeGreaterThan(0);
  });

  it('is deterministic for the same goal and day count', () => {
    const a = JSON.stringify(buildDefaultBlueprint('Muscle gain', 4));
    const b = JSON.stringify(buildDefaultBlueprint('Muscle gain', 4));
    expect(a).toBe(b);
  });

  it('generates a real plan end to end with no admin-authored blueprint', () => {
    const library = [
      exercise({ id: 'squat', name: 'Goblet Squat', movementPattern: 'squat' }),
      exercise({ id: 'push', name: 'Push-up', movementPattern: 'horizontal_push' }),
      exercise({ id: 'row', name: 'Dumbbell Row', movementPattern: 'horizontal_pull' }),
    ];
    const template: PlanTemplate = {
      id: 'auto', name: 'Auto', goal: 'Muscle gain', daysPerWeek: '1', durationMin: 60, days: [],
      blueprintDays: buildDefaultBlueprint('Muscle gain', 1),
    };
    const p = profile({ daysPerWeek: 1, sessionMinutes: 60 });
    const result = generatePlan(template, library, gym([]), p);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.days[0].exercises.map(e => e.name).sort())
      .toEqual(['Dumbbell Row', 'Goblet Squat', 'Push-up']);
    expect(validatePlan(result.days, library, gym([]), p).valid).toBe(true);
  });

  it('still succeeds when only the required patterns are tagged', () => {
    // Optional slots (hinge, vertical push, core) have no candidates here —
    // they should be skipped rather than failing the whole generation.
    const library = [
      exercise({ id: 'squat', name: 'Squat', movementPattern: 'squat' }),
      exercise({ id: 'push', name: 'Push-up', movementPattern: 'horizontal_push' }),
      exercise({ id: 'row', name: 'Row', movementPattern: 'horizontal_pull' }),
    ];
    const template: PlanTemplate = {
      id: 'auto', name: 'Auto', goal: 'General fitness', daysPerWeek: '1', durationMin: 60, days: [],
      blueprintDays: buildDefaultBlueprint('General fitness', 1),
    };
    const result = generatePlan(template, library, gym([]), profile({ daysPerWeek: 1 }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.days[0].exercises).toHaveLength(3);
  });
});

// --- expanded splits, warm-ups, and muscle tags ------------------------------

describe('split coverage at higher day counts', () => {
  it('produces exactly as many days as requested, including above 4', () => {
    [1, 2, 3, 4, 5, 6].forEach(n => {
      expect(selectSplit(n).dayNames).toHaveLength(n);
      expect(buildDefaultBlueprint('Muscle gain', n)).toHaveLength(n);
    });
  });

  it('switches to push/pull/legs at 5+ days', () => {
    expect(selectSplit(5).split).toBe('push_pull_legs');
    expect(selectSplit(6).dayNames).toEqual(['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs']);
  });
});

describe('warm-up slots', () => {
  it('opens every day with an optional mobility slot', () => {
    ['Muscle gain', 'Weight loss', 'Endurance', 'General fitness'].forEach(goal => {
      buildDefaultBlueprint(goal, 4).forEach(day => {
        expect(day.slots[0].movementPattern).toBe('mobility');
        expect(day.slots[0].optional).toBe(true);
      });
    });
  });

  it('leaves the warm-up uncategorized so any mobility exercise can fill it', () => {
    expect(buildDefaultBlueprint('Muscle gain', 3)[0].slots[0].exerciseCategory).toBeUndefined();
  });

  it('still generates when no mobility exercise is tagged', () => {
    const library = [
      exercise({ id: 'squat', name: 'Squat', movementPattern: 'squat' }),
      exercise({ id: 'push', name: 'Push-up', movementPattern: 'horizontal_push' }),
      exercise({ id: 'row', name: 'Row', movementPattern: 'horizontal_pull' }),
    ];
    const tpl: PlanTemplate = {
      id: 't', name: 'T', goal: 'Muscle gain', daysPerWeek: '1', durationMin: 60, days: [],
      blueprintDays: buildDefaultBlueprint('Muscle gain', 1),
    };
    const result = generatePlan(tpl, library, gym([]), profile({ daysPerWeek: 1 }));
    expect(result.ok).toBe(true);
  });
});

describe('muscle tags', () => {
  it('prefers an exercise that trains something not yet hit that day', () => {
    const chestAgain = exercise({ id: 'a-chest', name: 'Another Press', primaryMuscles: ['Chest'] });
    const freshBack = exercise({ id: 'z-back', name: 'Row Variant', primaryMuscles: ['Back'] });
    // 'a-chest' sorts first on id, so only the muscle penalty can flip this.
    const picked = selectForSlot(
      slot({ id: 's1' }), [chestAgain, freshBack], profile(), new Set(), new Set(['Chest'] as any)
    );
    expect(picked?.id).toBe('z-back');
  });

  it('does not penalize exercises that have no muscle tags yet', () => {
    const untagged = exercise({ id: 'a', name: 'Untagged' });
    const tagged = exercise({ id: 'b', name: 'Tagged', primaryMuscles: ['Chest'] });
    const picked = selectForSlot(
      slot({ id: 's1' }), [untagged, tagged], profile(), new Set(), new Set(['Chest'] as any)
    );
    expect(picked?.id).toBe('a');
  });

  it('warns when a week misses a major muscle group', () => {
    const library = [exercise({ id: 'push', name: 'Push-up', primaryMuscles: ['Chest'] })];
    const days = [{
      id: 'd1', name: 'Day 1',
      exercises: [{
        id: 'x', name: 'Push-up', targetMuscle: 'Chest', sets: 3, reps: '8-12',
        equipmentId: 'manual', libraryExerciseId: 'push',
        setDetails: [{ reps: '10', weight: '', restSec: 60 }],
      }],
    }];
    const result = validatePlan(days, library, gym([]), profile({ daysPerWeek: 1 }));
    expect(result.valid).toBe(true); // a gap is a warning, never a reason to withhold a plan
    expect(result.warnings.some(w => w.includes('Back'))).toBe(true);
  });

  it('stays silent about balance while the library is still untagged', () => {
    const library = [exercise({ id: 'push', name: 'Push-up' })];
    const days = [{
      id: 'd1', name: 'Day 1',
      exercises: [{
        id: 'x', name: 'Push-up', targetMuscle: 'Chest', sets: 3, reps: '8-12',
        equipmentId: 'manual', libraryExerciseId: 'push',
        setDetails: [{ reps: '10', weight: '', restSec: 60 }],
      }],
    }];
    expect(validatePlan(days, library, gym([]), profile({ daysPerWeek: 1 })).warnings).toHaveLength(0);
  });
});

// --- regressions -------------------------------------------------------------

describe('thin library does not break generation', () => {
  it('skips a repeat slot instead of duplicating an exercise', () => {
    // The Upper day asks for horizontal_push twice (compound + isolation
    // accessory). With one push exercise tagged, the accessory slot must be
    // skipped — duplicating it produced a plan the validator then rejected,
    // so the client got nothing at all.
    const library = [
      exercise({ id: 'bench', name: 'Bench Press', movementPattern: 'horizontal_push' }),
      exercise({ id: 'row', name: 'Row', movementPattern: 'horizontal_pull' }),
    ];
    const tpl: PlanTemplate = {
      id: 't', name: 'T', goal: 'Muscle gain', daysPerWeek: '1', durationMin: 90, days: [],
      blueprintDays: [buildDefaultBlueprint('Muscle gain', 4)[0]],
    };
    const p = profile({ daysPerWeek: 1, sessionMinutes: 90 });
    const result = generatePlan(tpl, library, gym([]), p);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const names = result.days[0].exercises.map(e => e.name);
    expect(new Set(names).size).toBe(names.length);           // no duplicates
    expect(validatePlan(result.days, library, gym([]), p).valid).toBe(true);
  });

  it('never selects the same exercise twice for one day', () => {
    const only = [exercise({ id: 'solo', name: 'Solo Push', movementPattern: 'horizontal_push' })];
    const tpl: PlanTemplate = {
      id: 't', name: 'T', goal: 'Muscle gain', daysPerWeek: '1', durationMin: 90, days: [],
      blueprintDays: [{
        id: 'd', name: 'Day', slots: [
          slot({ id: 's1', movementPattern: 'horizontal_push', priority: 1 }),
          slot({ id: 's2', movementPattern: 'horizontal_push', priority: 2, optional: true }),
        ],
      }],
    };
    const result = generatePlan(tpl, only, gym([]), profile({ daysPerWeek: 1, sessionMinutes: 90 }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.days[0].exercises).toHaveLength(1);
  });
});
