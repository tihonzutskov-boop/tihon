import { describe, it, expect } from 'vitest';
import {
  checkEligibility, eligibleExercises, gymEquipmentIds, selectSplit,
  selectForSlot, estimateDayMinutes, generatePlan, validatePlan, buildDefaultBlueprint,
  buildCombinedBlueprint, assignAimsToDays, aimProfile, GenerationProfile, EligibilityContext,
  buildBookendExercise, selectBookendExercise,
  roundRestSeconds,
} from './planGeneration';
import type { GenerationFailure } from './planGeneration';
import { LibraryExercise, Gym, ExerciseSlot, PlanTemplate, Exercise, ALL_JOINT_STRESS_AREAS } from '../types';
import { QUESTIONNAIRE_GOALS } from '../constants';

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

// The warm-up and cooldown are now real entries bracketing every generated
// day. Assertions about training content use this so they express "the working
// exercises" rather than depending on where the bookends sit.
const working = (day: { exercises: Exercise[] }) => day.exercises.filter(e => !e.bookend);

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

  it('excludes an exercise for every injury area a user can report', () => {
    // Eligibility compares the questionnaire's strings against an exercise's
    // jointStress by exact equality, so any area the picker offers must
    // actually exclude. A value that only exists on one side silently stops
    // filtering and quietly puts a bad exercise in someone's plan.
    for (const area of ALL_JOINT_STRESS_AREAS) {
      const ex = exercise({ id: 'e1', name: 'Loaded', jointStress: [area] });
      const result = checkEligibility(ex, ctx(gym([]), profile({ injuryAreas: [area] })));
      expect(result.eligible, `${area} did not exclude`).toBe(false);
      expect(result.reason).toBe('injury_conflict');
    }
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
      expect(working(result.days[0])).toHaveLength(1);
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
    expect((result as GenerationFailure).reason).toBe('no_day_could_be_built');
    expect((result as GenerationFailure).scope).toBe('week');
    expect((result as GenerationFailure).detail).toContain('min of primary work');
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
    expect((result as GenerationFailure).reason).toBe('no_day_could_be_built');
    expect((result as GenerationFailure).detail).toContain('Nothing at this gym');
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
    if (result.ok) expect(working(result.days[0])).toHaveLength(1);
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

    expect(working(result.days[0]).map(e => e.name)).toEqual(['Bench Press', 'Dumbbell Row']);
    expect(validatePlan(result.days, library, g, p).valid).toBe(true);
  });

  it('substitutes a bodyweight option when the gym lacks a barbell', () => {
    const g = gym(['dumbbell']);
    const result = generatePlan(blueprint, library, g, profile({ daysPerWeek: 1 }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(working(result.days[0])[0].name).toBe('Push-up');
  });

  it('never prescribes a weight it has no basis for', () => {
    const result = generatePlan(blueprint, library, gym(['barbell', 'bench', 'dumbbell']), profile({ daysPerWeek: 1 }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      working(result.days[0]).forEach(ex => {
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

describe('weekly variety across repeated slot templates', () => {
  // Two horizontal-push options and two horizontal-pull options — enough to
  // vary a 3-day full-body plan without any day going unfilled.
  const library = [
    exercise({ id: 'bench', name: 'Bench Press', movementPattern: 'horizontal_push' }),
    exercise({ id: 'incline', name: 'Incline Press', movementPattern: 'horizontal_push' }),
    exercise({ id: 'row', name: 'Barbell Row', movementPattern: 'horizontal_pull' }),
    exercise({ id: 'cablerow', name: 'Cable Row', movementPattern: 'horizontal_pull' }),
  ];
  const fullBodySlots = [
    slot({ id: 'push', movementPattern: 'horizontal_push', priority: 1 }),
    slot({ id: 'pull', movementPattern: 'horizontal_pull', priority: 2 }),
  ];
  const threeDayBlueprint: PlanTemplate = {
    id: 't1', name: 'Full Body', goal: 'General fitness', daysPerWeek: '3', durationMin: 60, days: [],
    blueprintDays: [
      { id: 'bd1', name: 'Full Body 1', slots: fullBodySlots },
      { id: 'bd2', name: 'Full Body 2', slots: fullBodySlots },
      { id: 'bd3', name: 'Full Body 3', slots: fullBodySlots },
    ],
  };

  // This was the bug: identical slot templates plus deterministic scoring
  // meant every full-body day picked the exact same exercise, so a 3-day
  // beginner plan trained the identical session three times over.
  it('varies the exercise across full-body days when the library offers alternatives', () => {
    const result = generatePlan(threeDayBlueprint, library, gym([]), profile({ daysPerWeek: 3, sessionMinutes: 60 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const pushChoices = result.days.map(d => d.exercises.find(e => e.name.includes('Press') || e.name.includes('Bench'))?.name);
    const pullChoices = result.days.map(d => d.exercises.find(e => e.name.includes('Row'))?.name);
    expect(new Set(pushChoices).size).toBeGreaterThan(1);
    expect(new Set(pullChoices).size).toBeGreaterThan(1);
  });

  // The repeat is still the right call when there is truly nothing else —
  // this is a preference, never a hard exclusion.
  it('still repeats an exercise when the library has only one option for the pattern', () => {
    const thin = [
      exercise({ id: 'bench', name: 'Bench Press', movementPattern: 'horizontal_push' }),
      exercise({ id: 'row', name: 'Barbell Row', movementPattern: 'horizontal_pull' }),
    ];
    const result = generatePlan(threeDayBlueprint, thin, gym([]), profile({ daysPerWeek: 3, sessionMinutes: 60 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    result.days.forEach(d => {
      expect(working(d).map(e => e.name).sort()).toEqual(['Barbell Row', 'Bench Press']);
    });
  });

  // A pattern that only shows up once in the week (e.g. a hinge slot on just
  // one full-body day) has no prior weekly use to avoid, so it is untouched
  // by the new preference and behaves exactly as before.
  it('does not affect a pattern that appears on only one day', () => {
    const singleDayBlueprint: PlanTemplate = {
      id: 't2', name: 'Full Body', goal: 'General fitness', daysPerWeek: '1', durationMin: 60, days: [],
      blueprintDays: [{ id: 'bd1', name: 'Full Body 1', slots: fullBodySlots }],
    };
    const result = generatePlan(singleDayBlueprint, library, gym([]), profile({ daysPerWeek: 1, sessionMinutes: 60 }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(working(result.days[0])).toHaveLength(2);
  });
});

// --- validation catches what selection might miss ----------------------------

describe('graceful skip when a required slot cannot be filled', () => {
  it('still produces a plan, minus the unfillable slot', () => {
    // Previously this returned no plan at all, so a client whose gym lacked
    // one movement got nothing rather than a shorter session.
    const library = [
      exercise({ id: 'push', name: 'Push-up', movementPattern: 'horizontal_push' }),
      exercise({ id: 'pull', name: 'Row', movementPattern: 'horizontal_pull' }),
    ];
    const bp: PlanTemplate = {
      id: 't1', name: 'T', goal: 'Muscle gain', daysPerWeek: '1', durationMin: 60, days: [],
      blueprintDays: [{
        id: 'bd1', name: 'Day 1', slots: [
          slot({ id: 's1', movementPattern: 'horizontal_push', priority: 1 }),
          slot({ id: 's2', movementPattern: 'squat', priority: 2 }),
          slot({ id: 's3', movementPattern: 'horizontal_pull', priority: 3 }),
        ],
      }],
    };
    const r = generatePlan(bp, library, gym([]), profile({ daysPerWeek: 1, sessionMinutes: 90 }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(working(r.days[0]).map(e => e.name)).toEqual(['Push-up', 'Row']);
  });

  it('records the skipped slot so the gap is not silent', () => {
    const library = [exercise({ id: 'push', name: 'Push-up', movementPattern: 'horizontal_push' })];
    const bp: PlanTemplate = {
      id: 't1', name: 'T', goal: 'Muscle gain', daysPerWeek: '1', durationMin: 60, days: [],
      blueprintDays: [{
        id: 'bd1', name: 'Day 1', slots: [
          slot({ id: 's1', movementPattern: 'horizontal_push', priority: 1 }),
          slot({ id: 's2', movementPattern: 'hinge', priority: 2 }),
        ],
      }],
    };
    const r = generatePlan(bp, library, gym([]), profile({ daysPerWeek: 1, sessionMinutes: 90 }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const skipped = r.decisions.find(d => d.droppedReason === 'no_candidate');
    expect(skipped?.movementPattern).toBe('hinge');
  });

  it('still fails when nothing can fill any slot in a day', () => {
    // An empty day is not a plan — validatePlan rejects it, so reporting the
    // gap is better than shipping a day with no exercises.
    const library = [exercise({ id: 'push', name: 'Push-up', movementPattern: 'horizontal_push' })];
    const bp: PlanTemplate = {
      id: 't1', name: 'T', goal: 'Muscle gain', daysPerWeek: '1', durationMin: 60, days: [],
      blueprintDays: [{
        id: 'bd1', name: 'Day 1', slots: [slot({ id: 's1', movementPattern: 'hinge', priority: 1 })],
      }],
    };
    const r = generatePlan(bp, library, gym([]), profile({ daysPerWeek: 1 }));
    expect(r.ok).toBe(false);
    expect((r as GenerationFailure).reason).toBe('no_day_could_be_built');
    expect((r as GenerationFailure).detail).toContain('Nothing at this gym');
  });

  it('produces a plan that passes validation after skipping', () => {
    const library = [
      exercise({ id: 'push', name: 'Push-up', movementPattern: 'horizontal_push' }),
      exercise({ id: 'pull', name: 'Row', movementPattern: 'horizontal_pull' }),
    ];
    const bp: PlanTemplate = {
      id: 't1', name: 'T', goal: 'Muscle gain', daysPerWeek: '1', durationMin: 60, days: [],
      blueprintDays: [{
        id: 'bd1', name: 'Day 1', slots: [
          slot({ id: 's1', movementPattern: 'squat', priority: 1 }),
          slot({ id: 's2', movementPattern: 'horizontal_push', priority: 2 }),
          slot({ id: 's3', movementPattern: 'horizontal_pull', priority: 3 }),
        ],
      }],
    };
    const p = profile({ daysPerWeek: 1, sessionMinutes: 90 });
    const r = generatePlan(bp, library, gym([]), p);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(validatePlan(r.days, library, gym([]), p).valid).toBe(true);
  });
});

describe('validation is independent of selection', () => {
  // The duration check has to count this session's real warm-up and cooldown.
  // It used to add a flat 5 minutes, which stayed behind when session shaping
  // introduced tier-sized bookends — so a day that genuinely overran the
  // client's stated time passed validation, in the one place whose whole job
  // is to catch exactly that independently of the generator.
  it('counts the session tier\'s real bookends in the duration check', () => {
    const library = [exercise({ id: 'e', name: 'Ex', requiredEquipmentIds: [] })];
    // 5 exercises x (5 sets, 12 reps, 180s rest) = 80 minutes of training work.
    const heavyDay = {
      id: 'd1', name: 'Day 1',
      exercises: Array.from({ length: 5 }, (_, i) => ({
        id: `x${i}`, name: 'Ex', targetMuscle: 'Chest', sets: 5, reps: '12',
        equipmentId: 'manual', libraryExerciseId: 'e',
        setDetails: Array.from({ length: 5 }, () => ({ reps: '12', weight: '', restSec: 180 })),
      })),
    };

    // A 90-minute long session reserves 20 minutes of bookends, leaving 70 for
    // training — so 80 minutes of work overruns. Under the old flat 5-minute
    // allowance this came to 85 and passed.
    const tooLong = validatePlan([heavyDay], library, gym([]), profile({ daysPerWeek: 1, sessionMinutes: 90 }));
    expect(tooLong.valid).toBe(false);
    expect(tooLong.errors.some(e => e.includes('over the 90 min target'))).toBe(true);

    // The same day fits when there is genuinely time for it, so the check is
    // reacting to the bookends rather than just calling everything too long.
    const fits = validatePlan([heavyDay], library, gym([]), profile({ daysPerWeek: 1, sessionMinutes: 110 }));
    expect(fits.errors.some(e => e.includes('target'))).toBe(false);
  });

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
    expect(working(result.days[0]).map(e => e.name).sort())
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
    if (result.ok) expect(working(result.days[0])).toHaveLength(3);
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

describe('goal selection', () => {
  it('offers Mobility as a genuinely different structure, not a rep-range variant', () => {
    const bp = buildDefaultBlueprint('Mobility', 3, 60);
    const patterns = bp[0].slots.map(s => s.movementPattern);
    expect(patterns).toEqual(
      expect.arrayContaining(['hip_mobility', 'shoulder_mobility', 'spine_mobility', 'ankle_mobility'])
    );
    // Not fatigue work: short rest, unlike every strength goal.
    expect(bp[0].slots.every(s => s.restSeconds <= 20)).toBe(true);
  });

  it('requires hip and shoulder mobility but treats spine/ankle as optional', () => {
    const bp = buildDefaultBlueprint('Mobility', 1, 60);
    const required = bp[0].slots.filter(s => !s.optional).map(s => s.movementPattern);
    expect(required).toEqual(expect.arrayContaining(['hip_mobility', 'shoulder_mobility']));
    expect(required).not.toContain('spine_mobility');
    expect(required).not.toContain('ankle_mobility');
  });

  // A mobility day has no upper/lower split — it should look the same
  // regardless of how many days a week were requested.
  it('gives every Mobility day the same structure, unlike a strength split', () => {
    const bp = buildDefaultBlueprint('Mobility', 4, 60);
    const patterns = bp.map(d => d.slots.map(s => s.movementPattern).join(','));
    expect(new Set(patterns).size).toBe(1);
  });

  // The actual bug being fixed: two goals that produced the same plan.
  it('no longer produces an identical plan for Muscle gain and General fitness', () => {
    const muscle = buildDefaultBlueprint('Muscle gain', 3, 60);
    const general = buildDefaultBlueprint('General fitness', 3, 60);
    // General fitness still resolves (old data), but is no longer offered —
    // the two remain numerically distinct so nothing regressed for it.
    expect(muscle[0].slots[0].repsMin).not.toBe(general[0].slots[0].repsMin);
  });

  it('still resolves a legacy General fitness goal rather than erroring', () => {
    const bp = buildDefaultBlueprint('General fitness', 2, 60);
    expect(bp.length).toBe(2);
    expect(bp[0].slots.length).toBeGreaterThan(0);
  });

  it('offers Mobility, not General fitness, as a new-client choice', () => {
    expect(QUESTIONNAIRE_GOALS).toContain('Mobility');
    expect(QUESTIONNAIRE_GOALS).not.toContain('General fitness');
  });
});

describe('MIXAIM-7 — secondary-aim work', () => {
  it('adds real slots for the day\'s secondary aim', () => {
    const bp = buildCombinedBlueprint(['Muscle gain', 'Mobility'], 2, 90);
    const strengthDay = bp.find(d => d.primaryAim === 'Muscle gain')!;
    const secondary = strengthDay.slots.filter(sl => sl.aimTier === 'secondary');

    expect(strengthDay.secondaryAim).toBe('Mobility');
    expect(secondary.length).toBeGreaterThan(0);
    expect(secondary.every(sl => sl.movementPattern.endsWith('_mobility'))).toBe(true);
  });

  // The narrowed MIXAIM-2: a slot appears because the day has a secondary
  // aim, never because an exercise happens to carry a secondary adaptation.
  it('adds none when the client selected a single aim', () => {
    const bp = buildCombinedBlueprint(['Muscle gain'], 3, 90);
    bp.forEach(d => {
      expect(d.secondaryAim).toBeNull();
      expect(d.slots.some(sl => sl.aimTier === 'secondary')).toBe(false);
    });
  });

  it('places all secondary work after every primary-aim slot', () => {
    const bp = buildCombinedBlueprint(['Muscle gain', 'Mobility'], 2, 90);
    bp.forEach(d => {
      const tiers = d.slots.map(sl => (sl.aimTier === 'secondary' ? 1 : 0));
      expect(tiers).toEqual([...tiers].sort((a, b) => a - b));
    });
  });

  // Only the secondary aim's essential work — pulling in its whole block
  // would put the day back to carrying two full sessions.
  it('takes only the secondary aim\'s essential work', () => {
    const bp = buildCombinedBlueprint(['Muscle gain', 'Mobility'], 2, 90);
    const strengthDay = bp.find(d => d.primaryAim === 'Muscle gain')!;
    const secondary = strengthDay.slots.filter(sl => sl.aimTier === 'secondary');
    const mobilityAlone = buildCombinedBlueprint(['Mobility'], 1, 90)[0].slots;
    expect(secondary.length).toBeLessThan(mobilityAlone.length);
  });

  // Secondary work keeps its own aim's numbers. Prescribing hip mobility at a
  // muscle-gain day's 120s rest would describe it as something it isn't.
  it('keeps the secondary aim\'s own prescription', () => {
    const bp = buildCombinedBlueprint(['Muscle gain', 'Mobility'], 2, 90);
    const strengthDay = bp.find(d => d.primaryAim === 'Muscle gain')!;
    strengthDay.slots.filter(sl => sl.aimTier === 'secondary')
      .forEach(sl => expect(sl.restSeconds).toBe(20));
  });
});

describe('aim profiles and main-block order', () => {
  it('declares the same four fields for every aim', () => {
    ['Muscle gain', 'Weight loss', 'Endurance', 'Mobility'].forEach(aim => {
      const p = aimProfile(aim);
      expect(p.intensityAxis).toBeTruthy();
      expect(p.progressionAxis).toBeTruthy();
      expect(p.orderHeuristic).toBeTruthy();
      expect(typeof p.namesOwnDays).toBe('boolean');
    });
  });

  // §2.2's actual purpose: mobility differs by its values, not by being a
  // special case in the code.
  it('gives mobility its own template through the profile, not a branch', () => {
    expect(aimProfile('Mobility').ownTemplate).not.toBeNull();
    expect(aimProfile('Muscle gain').ownTemplate).toBeNull();
    expect(aimProfile('Mobility').intensityAxis).toBe('range_control');
    expect(aimProfile('Muscle gain').intensityAxis).toBe('load');
  });

  it('falls back to a default profile for an unrecognised aim', () => {
    expect(aimProfile('Something else entirely').orderHeuristic).toBeTruthy();
  });

  it('marks only the conditioning aims for a finisher', () => {
    expect(aimProfile('Weight loss').conditioningFinisher).toBe(true);
    expect(aimProfile('Endurance').conditioningFinisher).toBe(true);
    expect(aimProfile('Muscle gain').conditioningFinisher).toBe(false);
  });

  // STRUCT-1: supporting and accessory work occupies the later part of the
  // main block, never before primary work.
  it('orders every main block primary, then supporting, then accessory', () => {
    const rank = { primary: 0, supporting: 1, accessory: 2 } as const;
    ['Muscle gain', 'Endurance', 'Mobility'].forEach(aim => {
      const slots = buildCombinedBlueprint([aim], 1, 90)[0].slots;
      const ranks = slots.map(sl => rank[sl.role as keyof typeof rank]);
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    });
  });

  // ORDER-1: a strength aim runs the heavier work first inside a role.
  it('puts compound work before isolation within a role for a load-based aim', () => {
    const slots = buildCombinedBlueprint(['Muscle gain'], 1, 90)[0].slots;
    const supporting = slots.filter(sl => sl.role === 'supporting');
    const firstIsolation = supporting.findIndex(sl => sl.exerciseCategory === 'isolation');
    const lastCompound = supporting.map(sl => sl.exerciseCategory).lastIndexOf('compound');
    if (firstIsolation !== -1 && lastCompound !== -1) {
      expect(lastCompound).toBeLessThan(firstIsolation);
    }
  });
});

describe('DROP-2 — one bad day does not take the week down', () => {
  const twoDays = (badDaySlots: ExerciseSlot[], goodDaySlots: ExerciseSlot[]): PlanTemplate => ({
    id: 't', name: 'T', goal: 'Muscle gain', daysPerWeek: '2', durationMin: 60, days: [],
    blueprintDays: [
      { id: 'bd1', name: 'Day 1', slots: goodDaySlots },
      { id: 'bd2', name: 'Day 2', slots: badDaySlots },
    ],
  });

  it('delivers the days it could build and reports the one it could not', () => {
    // Day 2 asks for a movement pattern nothing in the library covers.
    const tpl = twoDays(
      [slot({ id: 'bad', movementPattern: 'vertical_pull', priority: 1 })],
      [slot({ id: 'good', movementPattern: 'horizontal_push', priority: 1 })],
    );
    const result = generatePlan(tpl, [exercise({ id: 'p1', name: 'Push' })], gym([]), profile({ daysPerWeek: 2 }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.days).toHaveLength(1);
    expect(result.days[0].name).toBe('Day 1');
    expect(result.dayFailures).toHaveLength(1);
    expect(result.dayFailures[0].dayName).toBe('Day 2');
    expect(result.dayFailures[0].scope).toBe('day');
    expect(result.dayFailures[0].reason).toBe('no_candidate_for_slot');
  });

  it('reports no day failures when every day builds', () => {
    const tpl = twoDays(
      [slot({ id: 'a', movementPattern: 'horizontal_push', priority: 1 })],
      [slot({ id: 'b', movementPattern: 'horizontal_push', priority: 1 })],
    );
    const result = generatePlan(tpl, [exercise({ id: 'p1', name: 'Push' })], gym([]), profile({ daysPerWeek: 2 }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.dayFailures).toEqual([]);
  });

  // Only when nothing at all can be built does this become the client's
  // problem rather than one flagged day.
  it('fails at week level only when no day can be built', () => {
    const tpl = twoDays(
      [slot({ id: 'a', movementPattern: 'vertical_pull', priority: 1 })],
      [slot({ id: 'b', movementPattern: 'vertical_pull', priority: 1 })],
    );
    const result = generatePlan(tpl, [exercise({ id: 'p1', name: 'Push' })], gym([]), profile({ daysPerWeek: 2 }));
    expect(result.ok).toBe(false);
    expect((result as GenerationFailure).reason).toBe('no_day_could_be_built');
    expect((result as GenerationFailure).scope).toBe('week');
  });
});

describe('MIXAIM — aims are distributed across days, not mixed in a session', () => {
  it('gives a single aim every day', () => {
    expect(assignAimsToDays(['Muscle gain'], 3).map(d => d.primary)).toEqual(
      ['Muscle gain', 'Muscle gain', 'Muscle gain']
    );
    // One aim means there is no other one to be secondary.
    expect(assignAimsToDays(['Muscle gain'], 3).every(d => d.secondary === null)).toBe(true);
  });

  // MIXAIM-6: days handed out in aim-priority order, which is selection order.
  it('alternates days between two aims', () => {
    expect(assignAimsToDays(['Muscle gain', 'Mobility'], 4).map(d => d.primary)).toEqual(
      ['Muscle gain', 'Mobility', 'Muscle gain', 'Mobility']
    );
    // With two aims, each day's secondary is simply the other one.
    expect(assignAimsToDays(['Muscle gain', 'Mobility'], 4).map(d => d.secondary)).toEqual(
      ['Mobility', 'Muscle gain', 'Mobility', 'Muscle gain']
    );
  });

  it('gives the odd day to the higher-priority aim', () => {
    expect(assignAimsToDays(['Muscle gain', 'Mobility'], 3).map(d => d.primary)).toEqual(
      ['Muscle gain', 'Mobility', 'Muscle gain']
    );
  });

  it('falls back to a default aim when none were selected', () => {
    expect(assignAimsToDays([], 2)).toHaveLength(2);
    expect(assignAimsToDays([], 2)[0].secondary).toBeNull();
  });

  // MIXAIM-3: the primary block takes its whole prescription from the primary
  // aim — never blended with the other aim's, even on a shared pattern.
  it('builds the primary block from the primary aim alone', () => {
    const bp = buildCombinedBlueprint(['Muscle gain', 'Mobility'], 2, 60);
    const primaryWork = (d: (typeof bp)[number]) => d.slots.filter(sl => sl.aimTier !== 'secondary');

    expect(bp[0].primaryAim).toBe('Muscle gain');
    expect(primaryWork(bp[0]).every(sl => sl.restSeconds === 120 || sl.restSeconds === 60)).toBe(true);
    expect(primaryWork(bp[0]).some(sl => sl.movementPattern.endsWith('_mobility'))).toBe(false);

    expect(bp[1].primaryAim).toBe('Mobility');
    expect(primaryWork(bp[1]).every(sl =>
      sl.movementPattern.endsWith('_mobility') || sl.movementPattern === 'core')).toBe(true);
  });

  // A mobility day ignores the split entirely, so carrying "Upper" onto it
  // would name the day as something it isn't.
  it('names a mobility day for its aim, not the split it ignores', () => {
    const bp = buildCombinedBlueprint(['Muscle gain', 'Mobility'], 4, 60);
    const mobilityDays = bp.filter(d => d.primaryAim === 'Mobility');
    expect(mobilityDays.length).toBeGreaterThan(0);
    mobilityDays.forEach(d => expect(d.name).toMatch(/^Mobility/));
    // The strength aim holds two of the four days, so it gets a two-day
    // full-body split rather than a slice of the week's Upper/Lower.
    bp.filter(d => d.primaryAim !== 'Mobility').forEach(d => {
      expect(d.name).toMatch(/^Full Body/);
    });
  });

  // Regression: slicing one week-level split between aims gave the strength
  // aim every other day of an Upper/Lower split — two Upper days, no Lower,
  // so legs went untrained all week (FREQ-1). Each aim's split is sized to the
  // days that aim actually has instead.
  it('does not strand an aim on half of an alternating split', () => {
    const bp = buildCombinedBlueprint(['Muscle gain', 'Mobility'], 4, 60);
    const strengthDays = bp.filter(d => d.primaryAim === 'Muscle gain');
    expect(strengthDays).toHaveLength(2);
    expect(strengthDays.map(d => d.name)).not.toEqual(['Upper', 'Upper']);
    // Two strength days is a two-day full-body split, so both train legs.
    strengthDays.forEach(d => {
      expect(d.slots.map(sl => sl.movementPattern)).toContain('squat');
    });
  });

  it('leaves a single-aim plan on the ordinary split names', () => {
    const bp = buildCombinedBlueprint(['Muscle gain'], 3, 60);
    expect(bp.map(d => d.name)).toEqual(['Full Body 1', 'Full Body 2', 'Full Body 3']);
  });
});

describe('warm-up and cooldown', () => {
  // Previously the warm-up was an optional mobility slot, so it only appeared
  // when the library happened to carry a mobility-tagged exercise and could be
  // dropped to save time. It is now emitted structurally instead.
  it('gives every generated day a warm-up and a cooldown', () => {
    const pool = [
      exercise({ id: 'p1', name: 'Push' }),
      exercise({ id: 'p2', name: 'Pull', movementPattern: 'horizontal_pull' }),
    ];
    const blueprint: PlanTemplate = {
      id: 't1', name: 'T', goal: 'Muscle gain', daysPerWeek: '1', durationMin: 60, days: [],
      blueprintDays: [{
        id: 'bd1', name: 'Day 1', slots: [slot({ id: 's1', movementPattern: 'horizontal_push', priority: 1 })],
      }],
    };
    const result = generatePlan(blueprint, pool, gym([]), profile({ sessionMinutes: 60, daysPerWeek: 1 }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.days[0].warmup?.steps.length).toBeGreaterThan(0);
      expect(result.days[0].cooldown?.steps.length).toBeGreaterThan(0);
    }
  });

  // The point of the change: an empty library costs a better warm-up, not the
  // warm-up itself.
  it('still warms up when the library has no mobility exercise at all', () => {
    const pool = [exercise({ id: 'p1', name: 'Push' })];
    const blueprint: PlanTemplate = {
      id: 't1', name: 'T', goal: 'Muscle gain', daysPerWeek: '1', durationMin: 60, days: [],
      blueprintDays: [{
        id: 'bd1', name: 'Day 1', slots: [slot({ id: 's1', movementPattern: 'horizontal_push', priority: 1 })],
      }],
    };
    const result = generatePlan(blueprint, pool, gym([]), profile({ sessionMinutes: 60, daysPerWeek: 1 }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.days[0].warmup?.steps.length).toBeGreaterThan(0);
  });

  // The warm-up has to be findable in the room, not just described — "2
  // minutes easy cardio" is useless to a beginner who doesn't know where the
  // bike is. So it rides in the day as a real entry with a location.
  it('emits the warm-up and cooldown as real, locatable exercises', () => {
    const pool = [
      exercise({ id: 'p1', name: 'Push' }),
      exercise({ id: 'bike', name: 'Exercise Bike', movementPattern: 'mobility', exerciseCategory: 'cardio', equipmentId: 'zone-cardio' }),
    ];
    const blueprint: PlanTemplate = {
      id: 't1', name: 'T', goal: 'Muscle gain', daysPerWeek: '1', durationMin: 60, days: [],
      blueprintDays: [{ id: 'bd1', name: 'Day 1', slots: [slot({ id: 's1', movementPattern: 'horizontal_push', priority: 1 })] }],
    };
    const result = generatePlan(blueprint, pool, gym([]), profile({ daysPerWeek: 1, sessionMinutes: 60 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const day = result.days[0];
    expect(day.exercises[0].bookend).toBe('warmup');
    expect(day.exercises[day.exercises.length - 1].bookend).toBe('cooldown');
    // Backed by a real library exercise, so the map can place it.
    expect(day.exercises[0].libraryExerciseId).toBe('bike');
    expect(day.exercises[0].equipmentId).toBe('zone-cardio');
  });

  // The safety property from before still holds: a library with nothing
  // suitable costs a locatable warm-up, never the warm-up itself.
  it('names a bookend for itself, not for the machine backing it', () => {
    const bike = exercise({
      id: 'bike', name: 'Exercise Bike', exerciseCategory: 'cardio', movementPattern: 'mobility',
      equipmentId: 'zone-cardio',
    });
    const built = buildBookendExercise(
      'warmup',
      { name: 'Warm-up', minutes: 5, steps: ['2 minutes easy cardio'] },
      bike,
      'd0-warmup',
    );
    expect(built.name).toBe('Warm-up');
    // The machine is still what gives the block a place on the map.
    expect(built.equipmentId).toBe('zone-cardio');
    expect(built.libraryExerciseId).toBe('bike');
  });

  it('still emits bookends when nothing in the library can back them', () => {
    const pool = [exercise({ id: 'p1', name: 'Push' })];
    const blueprint: PlanTemplate = {
      id: 't1', name: 'T', goal: 'Muscle gain', daysPerWeek: '1', durationMin: 60, days: [],
      blueprintDays: [{ id: 'bd1', name: 'Day 1', slots: [slot({ id: 's1', movementPattern: 'horizontal_push', priority: 1 })] }],
    };
    const result = generatePlan(blueprint, pool, gym([]), profile({ daysPerWeek: 1, sessionMinutes: 60 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.days[0].exercises[0].bookend).toBe('warmup');
    expect(result.days[0].exercises[0].libraryExerciseId).toBeUndefined();
    expect(result.days[0].warmup?.steps.length).toBeGreaterThan(0);
  });

  // Bookends are in the day but are not training work — validation must not
  // hold them to the rules that govern the working exercises, or a plan whose
  // library can't back a warm-up would fail outright.
  it('does not fail validation over a bookend with no library entry', () => {
    const pool = [exercise({ id: 'p1', name: 'Push', requiredEquipmentIds: [] })];
    const blueprint: PlanTemplate = {
      id: 't1', name: 'T', goal: 'Muscle gain', daysPerWeek: '1', durationMin: 60, days: [],
      blueprintDays: [{ id: 'bd1', name: 'Day 1', slots: [slot({ id: 's1', movementPattern: 'horizontal_push', priority: 1 })] }],
    };
    const p = profile({ daysPerWeek: 1, sessionMinutes: 60 });
    const result = generatePlan(blueprint, pool, gym([]), p);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const validation = validatePlan(result.days, pool, gym([]), p);
    expect(validation.errors).toEqual([]);
  });

  it('builds a focused session short of accessories, and a full one when there is time', () => {
    const short = buildDefaultBlueprint('Muscle gain', 3, 30);
    const long = buildDefaultBlueprint('Muscle gain', 3, 90);
    expect(short[0].slots.length).toBeLessThan(long[0].slots.length);
    expect(short[0].slots.every(sl => !sl.optional)).toBe(true);
  });

  it('rests longer in a long session than a short one for the same slot', () => {
    const pool = [exercise({ id: 'p1', name: 'Push' })];
    const blueprint: PlanTemplate = {
      id: 't1', name: 'T', goal: 'Muscle gain', daysPerWeek: '1', durationMin: 90, days: [],
      blueprintDays: [{
        id: 'bd1', name: 'Day 1', slots: [slot({ id: 's1', movementPattern: 'horizontal_push', priority: 1 })],
      }],
    };
    const shortRun = generatePlan(blueprint, pool, gym([]), profile({ sessionMinutes: 30, daysPerWeek: 1 }));
    const longRun = generatePlan(blueprint, pool, gym([]), profile({ sessionMinutes: 90, daysPerWeek: 1 }));
    expect(shortRun.ok && longRun.ok).toBe(true);
    if (shortRun.ok && longRun.ok) {
      const shortRest = working(shortRun.days[0])[0].setDetails![0].restSec;
      const longRest = working(longRun.days[0])[0].setDetails![0].restSec;
      expect(longRest).toBeGreaterThan(shortRest);
    }
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

describe('cardio is bookend-only', () => {
  const bike = exercise({
    id: 'bike', name: 'Gym Bike', exerciseCategory: 'cardio',
    movementPattern: 'conditioning', equipmentId: 'zone-cardio',
  });

  it('never fills a main slot with cardio, even as the only candidate', () => {
    // The case a scoring penalty could not cover: nothing else matches the
    // pattern, so a merely-unlikely cardio pick would win by default.
    const picked = selectForSlot(
      slot({ id: 's1', movementPattern: 'conditioning', priority: 1 }),
      [bike],
      profile({}),
      new Set(),
    );
    expect(picked).toBeNull();
  });

  it('still lets cardio back the warm-up and the cooldown', () => {
    expect(selectBookendExercise('warmup', [bike])?.id).toBe('bike');
    expect(selectBookendExercise('cooldown', [bike])?.id).toBe('bike');
  });

  it('keeps cardio eligible — it is a placement rule, not a safety one', () => {
    // checkEligibility answers whether this person can perform this exercise
    // at this gym. Cardio passing that and still being kept out of the main
    // block is the distinction the two layers exist to express.
    const ctx = { availableEquipmentIds: new Set<string>(), profile: profile({}) };
    expect(checkEligibility(bike, ctx).eligible).toBe(true);
  });

  it('leaves no cardio anywhere in the training block of a generated plan', () => {
    const library = [
      bike,
      exercise({ id: 'squat', name: 'Squat', movementPattern: 'squat', exerciseCategory: 'compound' }),
      exercise({ id: 'push', name: 'Push-up', movementPattern: 'horizontal_push', exerciseCategory: 'compound' }),
      exercise({ id: 'row', name: 'Row', movementPattern: 'horizontal_pull', exerciseCategory: 'compound' }),
    ];
    // Weight loss appends a conditioning finisher to the main block, which is
    // the one slot cardio used to reach.
    const blueprint: PlanTemplate = {
      id: 't1', name: 'T', goal: 'Weight loss', daysPerWeek: '3', durationMin: 60, days: [],
      blueprintDays: buildDefaultBlueprint('Weight loss', 3),
    };
    const run = generatePlan(blueprint, library, gym([]), profile({ goal: 'Weight loss', daysPerWeek: 3 }));
    expect(run.ok).toBe(true);
    if (!run.ok) return;

    let checkedSomething = false;
    for (const day of run.days) {
      for (const ex of day.exercises) {
        if (ex.bookend) continue;
        checkedSomething = true;
        expect(ex.libraryExerciseId).not.toBe('bike');
      }
    }
    expect(checkedSomething).toBe(true);
  });
});

describe('rest prescription', () => {
  it('prescribes rest in whole ten-second steps, never an arbitrary number', () => {
    const pool = [exercise({ id: 'p1', name: 'Push' })];
    const blueprint: PlanTemplate = {
      id: 't1', name: 'T', goal: 'Muscle gain', daysPerWeek: '1', durationMin: 60, days: [],
      blueprintDays: [{
        id: 'bd1', name: 'Day 1', slots: [slot({ id: 's1', movementPattern: 'horizontal_push', priority: 1 })],
      }],
    };
    const rests: number[] = [];
    // Every session length, so every rest multiplier is exercised.
    for (const sessionMinutes of [30, 45, 60, 75, 90]) {
      const run = generatePlan(blueprint, pool, gym([]), profile({ sessionMinutes, daysPerWeek: 1 }));
      expect(run.ok).toBe(true);
      if (!run.ok) continue;
      for (const day of run.days) {
        for (const ex of day.exercises) {
          for (const detail of ex.setDetails || []) rests.push(detail.restSec);
        }
      }
    }
    // Guards against the loop above silently checking nothing.
    expect(rests.length).toBeGreaterThan(0);
    for (const rest of rests) {
      expect(rest % 10).toBe(0);
      expect(rest % 2).toBe(0);
    }
  });

  describe('roundRestSeconds', () => {
    it('snaps the multiplier\'s arbitrary output onto readable steps', () => {
      // What each base rest becomes once scaled for a longer session.
      expect(roundRestSeconds(69)).toBe(70);
      expect(roundRestSeconds(103.5)).toBe(100);
      expect(roundRestSeconds(121.5)).toBe(120);
      expect(roundRestSeconds(162)).toBe(160);
    });

    it('leaves a rest already on a step exactly where it is', () => {
      for (const rest of [20, 30, 60, 90, 120]) expect(roundRestSeconds(rest)).toBe(rest);
    });

    it('rounds the one odd base rest up rather than down', () => {
      expect(roundRestSeconds(45)).toBe(50);
    });

    it('never returns a rest of nothing', () => {
      expect(roundRestSeconds(0)).toBe(10);
      expect(roundRestSeconds(3)).toBe(10);
    });
  });
});

describe('muscle tags', () => {
  it('prefers an exercise that trains something not yet hit that day', () => {
    const chestAgain = exercise({ id: 'a-chest', name: 'Another Press', primaryMuscles: ['Chest'] });
    const freshBack = exercise({ id: 'z-back', name: 'Row Variant', primaryMuscles: ['Lats'] });
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

    const names = working(result.days[0]).map(e => e.name);
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
    if (result.ok) expect(working(result.days[0])).toHaveLength(1);
  });
});
