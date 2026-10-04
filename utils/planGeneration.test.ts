import { describe, it, expect } from 'vitest';
import {
  checkEligibility, eligibleExercises, gymEquipmentIds, selectSplit,
  selectForSlot, estimateDayMinutes, generatePlan, validatePlan, buildDefaultBlueprint,
  buildCombinedBlueprint, assignAimsToDays, aimProfile, GenerationProfile, EligibilityContext,
  buildBookendExercise, selectBookendExercise, isBookendExercise,
  roundRestSeconds, parseVideoMinutes, selectBookendVideos, videoMinutesOf,
} from './planGeneration';
import { zone2MinutesFor, maxExercisesFor } from './sessionShape';
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
    // Weight loss ends with zone-2 cardio instead (see 'zone-2 cardio').
    expect(hasConditioning('Weight loss')).toBe(false);
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
      exercise({ id: 'row', name: 'Lat Pulldown', movementPattern: 'vertical_pull' }),
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
      .toEqual(['Goblet Squat', 'Lat Pulldown', 'Push-up']);
    expect(validatePlan(result.days, library, gym([]), p).valid).toBe(true);
  });

  it('still succeeds when only the required patterns are tagged', () => {
    // Optional slots (hinge, vertical push, core) have no candidates here —
    // they should be skipped rather than failing the whole generation.
    const library = [
      exercise({ id: 'squat', name: 'Squat', movementPattern: 'squat' }),
      exercise({ id: 'push', name: 'Push-up', movementPattern: 'horizontal_push' }),
      exercise({ id: 'row', name: 'Pulldown', movementPattern: 'vertical_pull' }),
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

  it('lists every aim a client can end up with, for the admin roster to group by', () => {
    // The questionnaire offers friendlier names that resolve onto these; a
    // main goal missing from this list would leave its clients ungrouped.
    for (const aim of ['Muscle gain', 'Weight loss', 'General fitness', 'Endurance', 'Mobility']) {
      expect(QUESTIONNAIRE_GOALS).toContain(aim);
    }
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
    expect(aimProfile('Endurance').conditioningFinisher).toBe(true);
    expect(aimProfile('Weight loss').conditioningFinisher).toBe(false);
    expect(aimProfile('Muscle gain').conditioningFinisher).toBe(false);
  });

  it('gives only weight loss a zone-2 finisher, and never alongside the conditioning one', () => {
    for (const aim of ['Muscle gain', 'Weight loss', 'General fitness', 'Endurance', 'Mobility']) {
      const p = aimProfile(aim);
      expect(p.zone2Finisher, aim).toBe(aim === 'Weight loss');
      expect(p.zone2Finisher && p.conditioningFinisher, aim).toBe(false);
    }
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

  describe('secondary goals', () => {
    it('never own a day — they ride along on the main goal\'s days', () => {
      const days = assignAimsToDays(['Muscle gain'], 3, ['Mobility']);
      expect(days.map(d => d.primary)).toEqual(['Muscle gain', 'Muscle gain', 'Muscle gain']);
      expect(days.map(d => d.secondary)).toEqual(['Mobility', 'Mobility', 'Mobility']);
    });

    it('take the secondary slot instead of the next main goal when the client chose some', () => {
      const days = assignAimsToDays(['Muscle gain', 'Endurance'], 4, ['Mobility']);
      expect(days.map(d => d.primary)).toEqual(['Muscle gain', 'Endurance', 'Muscle gain', 'Endurance']);
      expect(days.every(d => d.secondary === 'Mobility')).toBe(true);
    });

    it('rotate across the days when there are several', () => {
      const days = assignAimsToDays(['Weight loss'], 4, ['Mobility', 'Muscle gain']);
      expect(days.map(d => d.secondary)).toEqual(['Mobility', 'Muscle gain', 'Mobility', 'Muscle gain']);
    });

    it('ignore an aim that is already a main goal, and repeats', () => {
      const days = assignAimsToDays(['Muscle gain'], 2, ['Muscle gain', 'Mobility', 'Mobility']);
      expect(days.map(d => d.secondary)).toEqual(['Mobility', 'Mobility']);
    });

    it('change nothing when there are none', () => {
      expect(assignAimsToDays(['Muscle gain', 'Mobility'], 3, [])).toEqual(
        assignAimsToDays(['Muscle gain', 'Mobility'], 3)
      );
    });

    it('add the secondary aim\'s essential work to every day, under its own prescription', () => {
      const bp = buildCombinedBlueprint(['Muscle gain'], 3, 60, ['Mobility']);
      expect(bp.every(d => d.primaryAim === 'Muscle gain' && d.secondaryAim === 'Mobility')).toBe(true);
      expect(bp.every(d => d.slots.some(sl => sl.aimTier === 'secondary'))).toBe(true);
      const withoutSecondary = buildCombinedBlueprint(['Muscle gain'], 3, 60);
      expect(bp[0].slots.length).toBeGreaterThan(withoutSecondary[0].slots.length);
    });

    it('do not turn a training day into a mobility day', () => {
      const bp = buildCombinedBlueprint(['Muscle gain'], 3, 60, ['Mobility']);
      expect(bp.map(d => d.name)).toEqual(buildCombinedBlueprint(['Muscle gain'], 3, 60).map(d => d.name));
    });
  });

  // MIXAIM-3: the primary block takes its whole prescription from the primary
  // aim — never blended with the other aim's, even on a shared pattern.
  it('builds the primary block from the primary aim alone', () => {
    const bp = buildCombinedBlueprint(['Muscle gain', 'Mobility'], 2, 60);
    const primaryWork = (d: (typeof bp)[number]) => d.slots.filter(sl => sl.aimTier !== 'secondary');

    expect(bp[0].primaryAim).toBe('Muscle gain');
    expect(primaryWork(bp[0]).every(sl => sl.restSeconds === 120)).toBe(true);
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
  // Previously asserted the opposite: the bookend was named "Warm-up" and the
  // machine deliberately kept out of the title, because a bare machine name
  // read as equipment prescribed with no instruction. Per-exercise notes are
  // what changed that — "Treadmill" plus what to do on it is an instruction,
  // where "Treadmill" alone was not.
  it('names the backing exercise and keeps its place on the map', () => {
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
    expect(built.name).toBe('Exercise Bike');
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

  it('rests the same whatever the session length', () => {
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
      expect(longRest).toBe(shortRest);
      expect(shortRest).toBe(90);
    }
  });

  it('still generates when no mobility exercise is tagged', () => {
    const library = [
      exercise({ id: 'squat', name: 'Squat', movementPattern: 'squat' }),
      exercise({ id: 'push', name: 'Push-up', movementPattern: 'horizontal_push' }),
      exercise({ id: 'row', name: 'Row', movementPattern: 'vertical_pull' }),
    ];
    const tpl: PlanTemplate = {
      id: 't', name: 'T', goal: 'Muscle gain', daysPerWeek: '1', durationMin: 60, days: [],
      blueprintDays: buildDefaultBlueprint('Muscle gain', 1),
    };
    const result = generatePlan(tpl, library, gym([]), profile({ daysPerWeek: 1 }));
    expect(result.ok).toBe(true);
  });
});

describe('the bookend matches what the day trains', () => {
  // Mirrors the live library's cardio, muscle tags and all.
  const tread = exercise({ id: 'tread', name: 'Treadmill', exerciseCategory: 'cardio',
    movementPattern: 'conditioning', bookendRoles: ['warmup', 'cooldown'],
    primaryMuscles: ['Quads', 'Calves'] });
  const stair = exercise({ id: 'stair', name: 'Stairmaster', exerciseCategory: 'cardio',
    movementPattern: 'conditioning', bookendRoles: ['warmup', 'cooldown'],
    primaryMuscles: ['Quads', 'Glutes'] });
  const rower = exercise({ id: 'rower', name: 'Air Rower', exerciseCategory: 'cardio',
    movementPattern: 'conditioning', bookendRoles: ['warmup', 'cooldown'],
    primaryMuscles: ['Lats'] });
  const pool = [tread, stair, rower];

  it('warms up an upper day on something that drives the upper body', () => {
    const upper = new Set(['Chest', 'Lats', 'Shoulders', 'Triceps'] as any);
    expect(selectBookendExercise('warmup', pool, upper as any)?.id).toBe('rower');
  });

  it('warms up a leg day on something that drives the legs', () => {
    const legs = new Set(['Quads', 'Glutes', 'Hamstrings'] as any);
    expect(selectBookendExercise('warmup', pool, legs as any)?.id).toBe('stair');
  });

  it('prefers the closer match when several overlap', () => {
    // Treadmill matches Quads and Calves; Stairmaster only Quads.
    const calves = new Set(['Quads', 'Calves'] as any);
    expect(selectBookendExercise('warmup', pool, calves as any)?.id).toBe('tread');
  });

  it('lets an explicit tag outrank the day', () => {
    // Untagged but perfectly matching, against tagged and not matching.
    const matchingUntagged = exercise({ id: 'bike', name: 'Bike', exerciseCategory: 'cardio',
      movementPattern: 'conditioning', primaryMuscles: ['Quads', 'Glutes', 'Hamstrings'] });
    const legs = new Set(['Quads', 'Glutes', 'Hamstrings'] as any);
    expect(selectBookendExercise('warmup', [matchingUntagged, rower], legs as any)?.id).toBe('rower');
  });

  it('still picks something when the day trains nothing it matches', () => {
    const unrelated = new Set(['Neck'] as any);
    expect(selectBookendExercise('warmup', pool, unrelated as any)).not.toBeNull();
  });

  it('behaves as before when no day muscles are given', () => {
    expect(selectBookendExercise('warmup', pool)).not.toBeNull();
  });
});

describe('bookend notes', () => {
  const block = { name: 'Warm-up', minutes: 5, steps: ['2 minutes easy cardio', 'Arm circles'] };
  const coolBlock = { name: 'Cooldown', minutes: 5, steps: ['2 minutes walking'] };
  const treadmill = exercise({
    id: 'tread', name: 'Treadmill', exerciseCategory: 'cardio', movementPattern: 'conditioning',
    bookendRoles: ['warmup', 'cooldown'],
    warmupNote: 'Easy pace for 5 minutes — you should still be able to talk.',
    cooldownNote: 'Walking pace for 3 minutes, let your breathing settle.',
  });

  it('names the exercise being done, not the block', () => {
    expect(buildBookendExercise('warmup', block, treadmill, 'x').name).toBe('Treadmill');
  });

  it('carries the note for the end of the session it is filling', () => {
    expect(buildBookendExercise('warmup', block, treadmill, 'x').notes).toBe(treadmill.warmupNote);
    expect(buildBookendExercise('cooldown', coolBlock, treadmill, 'x').notes).toBe(treadmill.cooldownNote);
  });

  it('falls back to the block steps when no note is written', () => {
    const untagged = exercise({
      id: 'bike', name: 'Bike', exerciseCategory: 'cardio', movementPattern: 'conditioning',
    });
    expect(buildBookendExercise('warmup', block, untagged, 'x').notes)
      .toBe('2 minutes easy cardio · Arm circles');
  });

  it('does not use the warm-up note for the cooldown when only one is written', () => {
    const warmOnly = exercise({
      id: 'w', name: 'Rower', exerciseCategory: 'cardio', movementPattern: 'conditioning',
      warmupNote: 'Build to a steady pace.',
    });
    expect(buildBookendExercise('cooldown', coolBlock, warmOnly, 'x').notes).toBe('2 minutes walking');
  });

  it('still names the block when the library cannot fill it', () => {
    const built = buildBookendExercise('warmup', block, null, 'x');
    expect(built.name).toBe('Warm-up');
    expect(built.notes).toBe('2 minutes easy cardio · Arm circles');
  });

  it('ignores a note that is only whitespace', () => {
    const blank = exercise({
      id: 'b', name: 'Bike', exerciseCategory: 'cardio', movementPattern: 'conditioning',
      warmupNote: '   ',
    });
    expect(buildBookendExercise('warmup', block, blank, 'x').notes)
      .toBe('2 minutes easy cardio · Arm circles');
  });
});

describe('bookendRoles — one exercise can serve both ends', () => {
  it('picks an exercise marked for both, for both', () => {
    const bike = exercise({
      id: 'bike', name: 'Gym Bike', exerciseCategory: 'cardio',
      movementPattern: 'conditioning', bookendRoles: ['warmup', 'cooldown'],
    });
    expect(selectBookendExercise('warmup', [bike])?.id).toBe('bike');
    expect(selectBookendExercise('cooldown', [bike])?.id).toBe('bike');
  });

  it('honours a role the exercise is not marked for', () => {
    // Marked warm-up only, and something else is marked for the cooldown.
    const warmOnly = exercise({
      id: 'warm', name: 'Easy Bike', exerciseCategory: 'cardio',
      movementPattern: 'conditioning', bookendRoles: ['warmup'],
    });
    const coolOnly = exercise({
      id: 'cool', name: 'Hamstring Stretch', exerciseCategory: 'mobility',
      movementPattern: 'mobility', bookendRoles: ['cooldown'],
    });
    expect(selectBookendExercise('warmup', [warmOnly, coolOnly])?.id).toBe('warm');
    expect(selectBookendExercise('cooldown', [warmOnly, coolOnly])?.id).toBe('cool');
  });

  it('still honours the old single-value tagging, unmigrated', () => {
    const legacy = exercise({
      id: 'legacy', name: 'Legacy Warmup', exerciseCategory: 'warmup',
      movementPattern: 'conditioning',
    });
    expect(selectBookendExercise('warmup', [legacy])?.id).toBe('legacy');
  });

  it('leaves an exercise marked for neither out of contention when something is marked', () => {
    const marked = exercise({
      id: 'marked', name: 'Marked', exerciseCategory: 'cardio',
      movementPattern: 'conditioning', bookendRoles: ['warmup'],
    });
    const unmarked = exercise({
      id: 'unmarked', name: 'Unmarked Cardio', exerciseCategory: 'cardio',
      movementPattern: 'conditioning',
    });
    expect(selectBookendExercise('warmup', [unmarked, marked])?.id).toBe('marked');
  });
});

describe('a warm-up or cool-down needs no movement pattern', () => {
  const noPattern = (over: Partial<LibraryExercise> & { id: string; name: string }) =>
    exercise({ movementPattern: undefined, ...over });

  it('counts an exercise marked for either end, or typed as one, as a bookend', () => {
    expect(isBookendExercise({ bookendRoles: ['warmup'] })).toBe(true);
    expect(isBookendExercise({ bookendRoles: ['cooldown'] })).toBe(true);
    expect(isBookendExercise({ exerciseCategory: 'warmup' })).toBe(true);
    expect(isBookendExercise({ exerciseCategory: 'cooldown' })).toBe(true);
    expect(isBookendExercise({ exerciseCategory: 'compound', bookendRoles: [] })).toBe(false);
    expect(isBookendExercise({})).toBe(false);
  });

  it('is eligible without one when it is a warm-up or cool-down', () => {
    const treadmill = noPattern({ id: 'tread', name: 'Treadmill Walk', exerciseCategory: 'cardio', bookendRoles: ['warmup'] });
    const stretch = noPattern({ id: 'stretch', name: 'Quad Stretch', exerciseCategory: 'cooldown' });
    expect(checkEligibility(treadmill, ctx(gym([]))).eligible).toBe(true);
    expect(checkEligibility(stretch, ctx(gym([]))).eligible).toBe(true);
  });

  it('still needs one for anything else', () => {
    const press = noPattern({ id: 'press', name: 'Machine Press', exerciseCategory: 'compound' });
    expect(checkEligibility(press, ctx(gym([])))).toEqual({ eligible: false, reason: 'missing_movement_pattern' });
  });

  it('still needs a type', () => {
    const untyped = noPattern({ id: 'u', name: 'Untyped', exerciseCategory: undefined, bookendRoles: ['warmup'] });
    expect(checkEligibility(untyped, ctx(gym([])))).toEqual({ eligible: false, reason: 'missing_category' });
  });

  it('is picked for the warm-up of a generated day, and never for the main work', () => {
    const treadmill = noPattern({
      id: 'tread', name: 'Treadmill Walk', exerciseCategory: 'cardio', bookendRoles: ['warmup', 'cooldown'],
      primaryMuscles: ['Chest'],
    });
    const push = exercise({ id: 'push', name: 'Push-up', primaryMuscles: ['Chest'] });
    const blueprint: PlanTemplate = {
      id: 't1', name: 'T', goal: 'Muscle gain', daysPerWeek: '1', durationMin: 60, days: [],
      blueprintDays: [{ id: 'bd1', name: 'Day 1', slots: [slot({ id: 's1', movementPattern: 'horizontal_push', priority: 1 })] }],
    };
    const result = generatePlan(blueprint, [treadmill, push], gym([]), profile({ daysPerWeek: 1, sessionMinutes: 60 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const day = result.days[0];
    expect(day.exercises[0].bookend).toBe('warmup');
    expect(day.exercises[0].libraryExerciseId).toBe('tread');
    expect(day.exercises[day.exercises.length - 1].libraryExerciseId).toBe('tread');
    expect(working(day).map(e => e.libraryExerciseId)).toEqual(['push']);
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
      exercise({ id: 'row', name: 'Row', movementPattern: 'vertical_pull', exerciseCategory: 'compound' }),
    ];
    // Weight loss ends with a zone-2 cardio block of its own (it is checked
    // separately); everything else in the day is training work.
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
        if (ex.bookend || ex.finisher) continue;
        checkedSomething = true;
        expect(ex.libraryExerciseId).not.toBe('bike');
      }
    }
    expect(checkedSomething).toBe(true);
  });
});

describe('rest per goal', () => {
  const restFor = (goal: string) => {
    const slots = buildDefaultBlueprint(goal, 3, 60)[0].slots;
    return {
      compound: slots.find(s => s.exerciseCategory === 'compound')!.restSeconds,
      isolation: slots.find(s => s.exerciseCategory === 'isolation')!.restSeconds,
    };
  };

  it('rests 2 min between every set for muscle growth', () => {
    expect(restFor('Muscle gain')).toEqual({ compound: 120, isolation: 120 });
  });

  it('rests 45 s / 30 s for fat loss', () => {
    expect(restFor('Weight loss')).toEqual({ compound: 45, isolation: 30 });
  });

  it('rests 30 s throughout for better fitness', () => {
    expect(restFor('Endurance')).toEqual({ compound: 30, isolation: 30 });
  });

  it('rests 1 min 30 / 1 min for a healthy lifestyle', () => {
    expect(restFor('General fitness')).toEqual({ compound: 90, isolation: 60 });
  });

  it('carries the table value through to the generated plan unchanged', () => {
    const pool = [exercise({ id: 'p1', name: 'Push' })];
    const blueprint: PlanTemplate = {
      id: 't1', name: 'T', goal: 'Weight loss', daysPerWeek: '1', durationMin: 90, days: [],
      blueprintDays: buildDefaultBlueprint('Weight loss', 1, 90),
    };
    const run = generatePlan(blueprint, pool, gym([]), profile({ sessionMinutes: 90, daysPerWeek: 1 }));
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    const push = working(run.days[0]).find(e => e.libraryExerciseId === 'p1')!;
    expect(push.setDetails![0].restSec).toBe(45);
  });
});

describe('reps and sets per goal', () => {
  const rx = (goal: string) => {
    const slots = buildDefaultBlueprint(goal, 3, 60)[0].slots;
    const pick = (category: string) => {
      const s = slots.find(sl => sl.exerciseCategory === category)!;
      return { sets: [s.setsMin, s.setsMax], reps: [s.repsMin, s.repsMax] };
    };
    return { compound: pick('compound'), isolation: pick('isolation') };
  };

  it('builds muscle with 8-10 reps and 3-4 sets, and 10-12 reps on single-joint work', () => {
    expect(rx('Muscle gain').compound).toEqual({ sets: [3, 4], reps: [8, 10] });
    expect(rx('Muscle gain').isolation.reps).toEqual([10, 12]);
  });

  it('tones up with 12-15 reps and 2-3 sets, a little higher on single-joint work', () => {
    expect(rx('General fitness')).toEqual({
      compound: { sets: [2, 3], reps: [12, 15] },
      isolation: { sets: [2, 3], reps: [14, 18] },
    });
  });

  it('loses fat with 15-20 reps and 3 sets of the big lifts', () => {
    expect(rx('Weight loss').compound).toEqual({ sets: [3, 3], reps: [15, 20] });
    expect(rx('Weight loss').isolation.reps).toEqual([15, 20]);
  });

  it('steps the rep ranges apart rather than letting them overlap', () => {
    const mid = (goal: string) => { const [a, b] = rx(goal).compound.reps; return (a + b) / 2; };
    expect(mid('Muscle gain')).toBeLessThan(mid('General fitness'));
    expect(mid('General fitness')).toBeLessThan(mid('Weight loss'));
  });

  it('gives a beginner the lower set count', () => {
    const pool = [exercise({ id: 'p1', name: 'Push' })];
    const run = (goal: string) => {
      const blueprint: PlanTemplate = {
        id: 't', name: 'T', goal, daysPerWeek: '1', durationMin: 90, days: [],
        blueprintDays: buildDefaultBlueprint(goal, 1, 90),
      };
      const r = generatePlan(blueprint, pool, gym([]), profile({ goal, sessionMinutes: 90 }));
      return r.ok ? working(r.days[0]).find(e => e.libraryExerciseId === 'p1')!.setDetails! : [];
    };
    expect(run('General fitness')).toHaveLength(2);
    expect(run('Weight loss')).toHaveLength(3);
    expect(run('Muscle gain')).toHaveLength(3);
  });
});

describe('rest prescription', () => {
  it('prescribes rest in whole five-second steps, never an arbitrary number', () => {
    const pool = [exercise({ id: 'p1', name: 'Push' })];
    const blueprint: PlanTemplate = {
      id: 't1', name: 'T', goal: 'Muscle gain', daysPerWeek: '1', durationMin: 60, days: [],
      blueprintDays: [{
        id: 'bd1', name: 'Day 1', slots: [slot({ id: 's1', movementPattern: 'horizontal_push', priority: 1 })],
      }],
    };
    const rests: number[] = [];
    // Every session length, to show none of them changes the steps.
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
      // Five-second steps under a minute, half-minutes over it.
      expect(rest % (rest > 60 ? 30 : 5)).toBe(0);
    }
  });

  describe('roundRestSeconds', () => {
    it('keeps short rests on five-second steps', () => {
      expect(roundRestSeconds(22)).toBe(20);
      expect(roundRestSeconds(34)).toBe(35);
      expect(roundRestSeconds(41)).toBe(40);
      expect(roundRestSeconds(52)).toBe(50);
    });

    it('snaps anything past a minute onto half-minutes', () => {
      // Nobody waiting between sets counts to 140, so past the minute mark the
      // step widens to the unit people actually use.
      expect(roundRestSeconds(69)).toBe(60);
      expect(roundRestSeconds(81)).toBe(90);
      expect(roundRestSeconds(103.5)).toBe(90);
      expect(roundRestSeconds(121.5)).toBe(120);
      expect(roundRestSeconds(138)).toBe(150);
      expect(roundRestSeconds(162)).toBe(150);
    });

    it('produces only rests that can be said as minutes and halves past a minute', () => {
      for (const seconds of [20, 30, 45, 60, 70, 95, 110, 130]) {
        const rest = roundRestSeconds(seconds);
        if (rest > 60) expect(rest % 30).toBe(0);
        else expect(rest % 5).toBe(0);
      }
    });

    it('leaves a rest already on a step exactly where it is', () => {
      for (const rest of [20, 30, 45, 60, 90, 120, 150]) expect(roundRestSeconds(rest)).toBe(rest);
    });

    it('never returns a rest of nothing', () => {
      expect(roundRestSeconds(0)).toBe(5);
      expect(roundRestSeconds(2)).toBe(5);
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
      exercise({ id: 'row', name: 'Row', movementPattern: 'vertical_pull' }),
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

// --- focus areas (the third level of goals) ---------------------------------

describe('focus areas', () => {
  const focusSlots = (day: { slots: ExerciseSlot[] }) => day.slots.filter(sl => sl.focusArea);
  const patternsOf = (slots: ExerciseSlot[]) => slots.map(sl => sl.movementPattern);

  it('changes nothing when no area is chosen', () => {
    expect(buildCombinedBlueprint(['Muscle gain'], 4, 60, [], [])).toEqual(buildCombinedBlueprint(['Muscle gain'], 4, 60));
  });

  it('adds arm work to the days that train the upper body, not the leg days', () => {
    const bp = buildCombinedBlueprint(['Muscle gain'], 4, 90, [], ['Arms']);
    const upper = bp.filter(d => d.name === 'Upper');
    const lower = bp.filter(d => d.name === 'Lower');
    expect(upper.length).toBeGreaterThan(0);
    upper.forEach(d => expect(patternsOf(focusSlots(d)).sort()).toEqual(['elbow_extension', 'elbow_flexion']));
    lower.forEach(d => expect(focusSlots(d)).toHaveLength(0));
  });

  it('adds only the half of the arms a push or pull day trains', () => {
    const bp = buildCombinedBlueprint(['Muscle gain'], 5, 90, [], ['Arms']);
    const push = bp.find(d => d.name === 'Push')!;
    const pull = bp.find(d => d.name === 'Pull')!;
    expect(patternsOf(focusSlots(push))).toEqual(['elbow_extension']);
    expect(patternsOf(focusSlots(pull))).toEqual(['elbow_flexion']);
  });

  it('adds glute work to the days that train the legs', () => {
    const bp = buildCombinedBlueprint(['Muscle gain'], 4, 90, [], ['Glutes']);
    bp.filter(d => d.name === 'Lower').forEach(d => expect(patternsOf(focusSlots(d))).toEqual(['hip_extension']));
    bp.filter(d => d.name === 'Upper').forEach(d => expect(focusSlots(d)).toHaveLength(0));
  });

  it('adds core work to any day', () => {
    const bp = buildCombinedBlueprint(['Muscle gain'], 4, 90, [], ['Core']);
    expect(bp.every(d => patternsOf(focusSlots(d)).includes('core'))).toBe(true);
  });

  it('gives a full-body day every area asked for, since it trains them all', () => {
    const bp = buildCombinedBlueprint(['Muscle gain'], 3, 90, [], ['Glutes', 'Arms', 'Chest']);
    bp.forEach(d => {
      const areas = new Set(focusSlots(d).map(sl => sl.focusArea));
      expect(areas).toEqual(new Set(['Glutes', 'Arms', 'Chest']));
    });
  });

  it('treats a repeated area as one', () => {
    const once = buildCombinedBlueprint(['Muscle gain'], 4, 90, [], ['Arms']);
    const twice = buildCombinedBlueprint(['Muscle gain'], 4, 90, [], ['Arms', 'Arms']);
    expect(twice).toEqual(once);
  });

  it('leaves a mobility day alone', () => {
    const bp = buildCombinedBlueprint(['Muscle gain', 'Mobility'], 4, 90, [], ['Arms', 'Core']);
    const mobility = bp.filter(d => d.primaryAim === 'Mobility');
    expect(mobility.length).toBeGreaterThan(0);
    mobility.forEach(d => expect(focusSlots(d)).toHaveLength(0));
    expect(bp.filter(d => d.primaryAim === 'Muscle gain').every(d => focusSlots(d).length > 0)).toBe(true);
  });

  it('keeps the work in a short session, where finishing work is left out', () => {
    const short = buildCombinedBlueprint(['Muscle gain'], 3, 30, [], ['Arms']);
    const noFocus = buildCombinedBlueprint(['Muscle gain'], 3, 30);
    expect(short[0].slots.length).toBeGreaterThan(noFocus[0].slots.length);
    expect(focusSlots(short[0]).length).toBeGreaterThan(0);
  });

  it('ranks the work as supporting, so it is not protected like a main lift', () => {
    const bp = buildCombinedBlueprint(['Muscle gain'], 4, 90, [], ['Arms', 'Core']);
    bp.forEach(d => focusSlots(d).forEach(sl => {
      expect(sl.role).toBe('supporting');
      expect(sl.optional).toBe(true);
    }));
  });

  it('prefers an exercise that trains the area when it has a choice', () => {
    const hamstringsOnly = exercise({ id: 'a-ham', name: 'Hamstring', movementPattern: 'hinge', primaryMuscles: ['Hamstrings'] });
    const glutes = exercise({ id: 'b-glute', name: 'Glute', movementPattern: 'hinge', primaryMuscles: ['Glutes'] });
    const hinge = slot({ id: 's1', movementPattern: 'hinge' });
    // With no focus the tie goes to the lower id.
    expect(selectForSlot(hinge, [hamstringsOnly, glutes], profile(), new Set())?.id).toBe('a-ham');
    expect(selectForSlot(hinge, [hamstringsOnly, glutes], profile({ focusAreas: ['Glutes'] }), new Set())?.id).toBe('b-glute');
  });

  it('does not let a focus bring back an exercise already used this week', () => {
    const used = exercise({ id: 'b-glute', name: 'Glute', movementPattern: 'hinge', primaryMuscles: ['Glutes'] });
    const fresh = exercise({ id: 'a-other', name: 'Other', movementPattern: 'hinge', primaryMuscles: ['Hamstrings'] });
    const picked = selectForSlot(
      slot({ id: 's1', movementPattern: 'hinge' }), [used, fresh], profile({ focusAreas: ['Glutes'] }),
      new Set(), new Set(), new Set(['b-glute']),
    );
    expect(picked?.id).toBe('a-other');
  });

  // DROP-1: the work the client asked for is the last optional work to go.
  it('is the last optional work a session gives up', () => {
    const pool = [
      exercise({ id: 'p1', name: 'Push', movementPattern: 'horizontal_push' }),
      exercise({ id: 'p2', name: 'Pull', movementPattern: 'horizontal_pull' }),
      exercise({ id: 'p3', name: 'Curl', movementPattern: 'elbow_flexion' }),
    ];
    const blueprint: PlanTemplate = {
      id: 't1', name: 'T', goal: 'Muscle gain', daysPerWeek: '1', durationMin: 22, days: [],
      blueprintDays: [{
        id: 'bd1', name: 'Day 1', slots: [
          slot({ id: 's1', movementPattern: 'horizontal_push', priority: 1, role: 'primary' }),
          slot({ id: 's2', movementPattern: 'horizontal_pull', priority: 5, optional: true, role: 'accessory' }),
          slot({ id: 's3', movementPattern: 'elbow_flexion', priority: 9, optional: true, role: 'supporting', focusArea: 'Arms' }),
        ],
      }],
    };
    // Each exercise takes 5 min. A 22-minute session has 14 left after the
    // warm-up and cooldown: room for two of the three, so one has to go.
    const result = generatePlan(blueprint, pool, gym([]), profile({ sessionMinutes: 22 }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(working(result.days[0]).map(e => e.name)).toEqual(['Push', 'Curl']);
    }
  });

  it('is still dropped before main work when the session is too short for both', () => {
    const pool = [
      exercise({ id: 'p1', name: 'Push', movementPattern: 'horizontal_push' }),
      exercise({ id: 'p3', name: 'Curl', movementPattern: 'elbow_flexion' }),
    ];
    const blueprint: PlanTemplate = {
      id: 't1', name: 'T', goal: 'Muscle gain', daysPerWeek: '1', durationMin: 14, days: [],
      blueprintDays: [{
        id: 'bd1', name: 'Day 1', slots: [
          slot({ id: 's1', movementPattern: 'horizontal_push', priority: 1, role: 'primary' }),
          slot({ id: 's3', movementPattern: 'elbow_flexion', priority: 9, optional: true, role: 'supporting', focusArea: 'Arms' }),
        ],
      }],
    };
    // A 14-minute session has 9 left after the warm-up and cooldown: room for
    // one exercise, not two. The main lift stays and the focus work goes.
    const result = generatePlan(blueprint, pool, gym([]), profile({ sessionMinutes: 14 }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(working(result.days[0]).map(e => e.name)).toEqual(['Push']);
  });

  it('shows up in a generated week, on the days that train the area', () => {
    const library = [
      ...(['horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull', 'squat', 'hinge', 'lunge'] as const)
        .map(p => exercise({ id: `${p}-1`, name: p, movementPattern: p })),
      exercise({ id: 'ef-1', name: 'curl-1', movementPattern: 'elbow_flexion', exerciseCategory: 'isolation' }),
      exercise({ id: 'ef-2', name: 'curl-2', movementPattern: 'elbow_flexion', exerciseCategory: 'isolation' }),
      exercise({ id: 'ee-1', name: 'ext-1', movementPattern: 'elbow_extension', exerciseCategory: 'isolation' }),
      exercise({ id: 'ee-2', name: 'ext-2', movementPattern: 'elbow_extension', exerciseCategory: 'isolation' }),
    ];
    const generate = (focusAreas: ('Arms')[]) => {
      const blueprintDays = buildCombinedBlueprint(['Muscle gain'], 4, 90, [], focusAreas);
      const p = profile({ daysPerWeek: 4, sessionMinutes: 90, focusAreas });
      return generatePlan({ id: 't', name: 'T', goal: 'Muscle gain', daysPerWeek: '4', durationMin: 90, days: [], blueprintDays },
        library, gym([]), p);
    };
    const armWork = (day: { exercises: Exercise[] }) =>
      working(day).filter(e => e.name.startsWith('curl') || e.name.startsWith('ext')).length;
    const without = generate([]);
    const withArms = generate(['Arms']);
    expect(without.ok && withArms.ok).toBe(true);
    if (without.ok && withArms.ok) {
      const upperDays = without.days.map((d, i) => i).filter(i => without.days[i].name === 'Upper');
      const lowerDays = without.days.map((d, i) => i).filter(i => without.days[i].name === 'Lower');
      for (const i of upperDays) expect(armWork(withArms.days[i])).toBeGreaterThan(armWork(without.days[i]));
      for (const i of lowerDays) expect(armWork(withArms.days[i])).toBe(armWork(without.days[i]));
    }
  });
});

// --- zone-2 cardio (the finisher for Lose weight) ---------------------------

describe('zone-2 cardio', () => {
  const bike = exercise({
    id: 'bike', name: 'Gym Bike', exerciseCategory: 'cardio',
    movementPattern: 'conditioning', equipmentId: 'zone-cardio',
  });
  const rower = exercise({
    id: 'rower', name: 'Rower', exerciseCategory: 'cardio',
    movementPattern: 'conditioning', equipmentId: 'zone-cardio',
  });
  const lifts = [
    exercise({ id: 'squat', name: 'Squat', movementPattern: 'squat' }),
    exercise({ id: 'push', name: 'Push-up', movementPattern: 'horizontal_push' }),
    exercise({ id: 'row', name: 'Pulldown', movementPattern: 'vertical_pull' }),
    exercise({ id: 'hinge', name: 'Deadlift', movementPattern: 'hinge' }),
    exercise({ id: 'press', name: 'Press', movementPattern: 'vertical_push' }),
    exercise({ id: 'plank', name: 'Plank', movementPattern: 'core', exerciseCategory: 'isolation' }),
  ];

  const plan = (library: LibraryExercise[], sessionMinutes: number, days = 3, goal = 'Weight loss') => {
    const blueprintDays = buildCombinedBlueprint([goal], days, sessionMinutes);
    return generatePlan(
      { id: 't', name: 'T', goal, daysPerWeek: String(days), durationMin: sessionMinutes, days: [], blueprintDays },
      library, gym([]), profile({ goal, daysPerWeek: days, sessionMinutes }),
    );
  };
  const zoneOf = (day: { exercises: Exercise[] }) => day.exercises.find(e => e.finisher === 'zone2');

  it('sizes the block to the session: 10, 15 and 20 minutes', () => {
    expect(zone2MinutesFor(30)).toBe(10);
    expect(zone2MinutesFor(45)).toBe(10);
    expect(zone2MinutesFor(60)).toBe(15);
    expect(zone2MinutesFor(90)).toBe(20);
  });

  it('asks for the block only on weight-loss days', () => {
    expect(buildCombinedBlueprint(['Weight loss'], 3, 45).every(d => d.zone2Minutes === 10)).toBe(true);
    expect(buildCombinedBlueprint(['Weight loss'], 3, 60).every(d => d.zone2Minutes === 15)).toBe(true);
    expect(buildCombinedBlueprint(['Weight loss'], 3, 90).every(d => d.zone2Minutes === 20)).toBe(true);
    for (const aim of ['Muscle gain', 'General fitness', 'Endurance', 'Mobility']) {
      expect(buildCombinedBlueprint([aim], 3, 60).every(d => d.zone2Minutes === undefined), aim).toBe(true);
    }
  });

  it('puts the cardio after the weights and before the cool-down', () => {
    const run = plan([...lifts, bike], 60);
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    run.days.forEach(day => {
      const kinds = day.exercises.map(e => e.bookend ?? (e.finisher ? 'zone2' : 'lift'));
      expect(kinds[0]).toBe('warmup');
      expect(kinds[kinds.length - 1]).toBe('cooldown');
      expect(kinds[kinds.length - 2]).toBe('zone2');
      expect(kinds.filter(k => k === 'zone2')).toHaveLength(1);
    });
  });

  it('is a timed block on a real cardio machine, with the pace explained', () => {
    const run = plan([...lifts, bike], 60);
    if (!run.ok) throw new Error('plan failed');
    const z = zoneOf(run.days[0])!;
    expect(z).toMatchObject({
      libraryExerciseId: 'bike', isCardio: true, cardioMinutes: 15, sets: 0, finisher: 'zone2', targetMuscle: 'Zone 2 cardio',
    });
    expect(z.bookend).toBeUndefined();
    expect(z.notes).toMatch(/talk/i);
  });

  it('runs 20 minutes in a 90 minute session', () => {
    const run = plan([...lifts, bike], 90);
    if (!run.ok) throw new Error('plan failed');
    expect(zoneOf(run.days[0])!.cardioMinutes).toBe(20);
  });

  it('uses a different machine on a different day when the gym has two', () => {
    const run = plan([...lifts, bike, rower], 60);
    if (!run.ok) throw new Error('plan failed');
    const used = run.days.map(d => zoneOf(d)!.libraryExerciseId);
    expect(used[0]).not.toBe(used[1]);
  });

  it('takes the place of the conditioning finisher rather than adding to it', () => {
    const run = plan([...lifts, bike], 90);
    if (!run.ok) throw new Error('plan failed');
    expect(buildCombinedBlueprint(['Weight loss'], 3, 90)[0].slots.some(s => s.movementPattern === 'conditioning')).toBe(false);
    run.days.forEach(d => expect(d.exercises.filter(e => e.isCardio && !e.bookend)).toHaveLength(1));
  });

  it('trims the weights to make room for it before it gives up any minutes', () => {
    // 45 min holds five exercises. Of the six asked for, the press goes: the abs
    // are the last to give up, and the hinge and the press come before them.
    const run = plan([...lifts, bike], 45);
    if (!run.ok) throw new Error('plan failed');
    const day = run.days[0];
    expect(zoneOf(day)!.cardioMinutes).toBe(10);
    const names = working(day).filter(e => !e.finisher).map(e => e.name);
    expect(names).toEqual(['Squat', 'Push-up', 'Pulldown', 'Deadlift', 'Plank']);
  });

  it('shrinks to fit when even the main lifts leave too little room, and never cuts them', () => {
    // 30 min: 20 left; 10 asked for cardio leaves 10 for three main lifts that
    // need 13, so it shrinks to 5.
    const run = plan([...lifts, bike], 30);
    if (!run.ok) throw new Error('plan failed');
    const day = run.days[0];
    expect(zoneOf(day)!.cardioMinutes).toBe(5);
    expect(working(day).filter(e => !e.finisher).map(e => e.name)).toEqual(['Squat', 'Push-up', 'Pulldown']);
  });

  it('is left out for a day when there is no room for it even at the shortest', () => {
    // With 90 s rests the three main lifts take 17 min of the 20 left at 30 min:
    // they fit alone, but not beside even five minutes of cardio.
    const heavy = buildCombinedBlueprint(['Weight loss'], 1, 30).map(d => ({
      ...d, slots: d.slots.map(s => ({ ...s, restSeconds: 90 })),
    }));
    const run = generatePlan(
      { id: 't', name: 'T', goal: 'Weight loss', daysPerWeek: '1', durationMin: 30, days: [], blueprintDays: heavy },
      [...lifts, bike], gym([]), profile({ goal: 'Weight loss', sessionMinutes: 30 }),
    );
    if (!run.ok) throw new Error('plan failed');
    expect(zoneOf(run.days[0])).toBeUndefined();
    expect(working(run.days[0]).length).toBe(3);
    expect(run.decisions.find(d => d.slotId === 'zone2')).toMatchObject({ dropped: true, droppedReason: 'duration' });
  });

  it('builds the day without it, and says so, when the gym has no cardio', () => {
    const run = plan(lifts, 60);
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    run.days.forEach(d => expect(zoneOf(d)).toBeUndefined());
    const decision = run.decisions.find(d => d.slotId === 'zone2');
    expect(decision).toMatchObject({ dropped: true, droppedReason: 'no_candidate' });
  });

  it('does not touch plans for other goals', () => {
    const run = plan([...lifts, bike], 60, 3, 'Muscle gain');
    if (!run.ok) throw new Error('plan failed');
    run.days.forEach(d => expect(zoneOf(d)).toBeUndefined());
    expect(run.decisions.some(d => d.slotId === 'zone2')).toBe(false);
  });

  it('passes validation, counting the cardio minutes toward the session length', () => {
    const library = [...lifts, bike];
    const run = plan(library, 60);
    if (!run.ok) throw new Error('plan failed');
    const p = profile({ goal: 'Weight loss', daysPerWeek: 3, sessionMinutes: 60 });
    expect(validatePlan(run.days, library, gym([]), p)).toMatchObject({ valid: true, errors: [] });

    // The same plan against a shorter session is over length once the cardio counts.
    const tooShort = profile({ goal: 'Weight loss', daysPerWeek: 3, sessionMinutes: 45 });
    const verdict = validatePlan(run.days, library, gym([]), tooShort);
    expect(verdict.errors.some(e => /over the 45 min target/.test(e))).toBe(true);
  });

  it('still rejects a cardio block that is not a real library exercise', () => {
    const library = [...lifts, bike];
    const run = plan(library, 60);
    if (!run.ok) throw new Error('plan failed');
    const forged = run.days.map(d => ({
      ...d, exercises: d.exercises.map(e => e.finisher ? { ...e, libraryExerciseId: 'ghost' } : e),
    }));
    const p = profile({ goal: 'Weight loss', daysPerWeek: 3, sessionMinutes: 60 });
    expect(validatePlan(forged, library, gym([]), p).valid).toBe(false);
  });
});

// --- warm-up and cool-down: cardio, then stretching from videos --------------

describe('warm-up and cool-down built from videos', () => {
  const video = (over: Partial<LibraryExercise> & { id: string }) => exercise({
    name: over.id, exerciseType: 'video', movementPattern: undefined, exerciseCategory: 'mobility',
    bookendRoles: ['warmup'], videoUrl: 'https://youtu.be/x', videoDurationLabel: '2 min', targetMuscle: 'Full body',
    ...over,
  } as any);
  const bike = exercise({
    id: 'bike', name: 'Gym Bike', exerciseCategory: 'cardio', movementPattern: 'conditioning',
    equipmentId: 'zone-cardio', bookendRoles: ['warmup', 'cooldown'],
  });
  const lifts = [
    exercise({ id: 'squat', name: 'Squat', movementPattern: 'squat', primaryMuscles: ['Quads', 'Glutes'] }),
    exercise({ id: 'push', name: 'Push-up', movementPattern: 'horizontal_push' }),
    exercise({ id: 'row', name: 'Pulldown', movementPattern: 'vertical_pull' }),
  ];
  const warmVid = (n: number, minutes = '2 min', over: any = {}) => video({ id: `w${n}`, videoDurationLabel: minutes, ...over });
  const coolVid = (n: number, minutes = '3 min', over: any = {}) => video({ id: `c${n}`, bookendRoles: ['cooldown'], videoDurationLabel: minutes, ...over });

  describe('reading a length', () => {
    it('reads minutes however they are written', () => {
      expect(parseVideoMinutes('10 min')).toBe(10);
      expect(parseVideoMinutes('10 minutes')).toBe(10);
      expect(parseVideoMinutes('8mins')).toBe(8);
      expect(parseVideoMinutes('7m')).toBe(7);
      expect(parseVideoMinutes('7,5 min')).toBe(8);
      expect(parseVideoMinutes('12:30')).toBe(13);
      expect(parseVideoMinutes('1:05:00')).toBe(65);
      expect(parseVideoMinutes('90 sec')).toBe(2);
    });

    it('reads nothing from a label with no length in it', () => {
      for (const l of ['', '   ', 'Follow-along video', 'short', undefined, null, '0 min', '0:00']) {
        expect(parseVideoMinutes(l as any), String(l)).toBeNull();
      }
    });

    it('counts an unreadable length as three minutes', () => {
      expect(videoMinutesOf({ videoDurationLabel: 'Follow-along video' })).toBe(3);
      expect(videoMinutesOf({ videoDurationLabel: '5 min' })).toBe(5);
    });
  });

  describe('choosing the videos', () => {
    it('takes tagged videos until the time is filled', () => {
      const pool = [warmVid(1, '2 min'), warmVid(2, '2 min'), warmVid(3, '2 min')];
      expect(selectBookendVideos('warmup', pool, 4).map(v => v.id)).toEqual(['w1', 'w2']);
    });

    it('lets a set run a little past the time rather than stop short', () => {
      expect(selectBookendVideos('warmup', [warmVid(1, '5 min')], 4).map(v => v.id)).toEqual(['w1']);
      // But not by much: 7 minutes against 4 asked is too far.
      expect(selectBookendVideos('warmup', [warmVid(1, '7 min')], 4)).toEqual([]);
    });

    it('passes over a video that does not fit and takes one that does', () => {
      const pool = [warmVid(1, '9 min'), warmVid(2, '3 min')];
      expect(selectBookendVideos('warmup', pool, 4).map(v => v.id)).toEqual(['w2']);
    });

    it('chooses for this end only: a cooldown video is never a warm-up video', () => {
      expect(selectBookendVideos('warmup', [coolVid(1)], 4)).toEqual([]);
      expect(selectBookendVideos('cooldown', [coolVid(1)], 3).map(v => v.id)).toEqual(['c1']);
    });

    it('ignores a video with no tag for the end, and one not enabled for generation', () => {
      const pool = [video({ id: 'plain', bookendRoles: [] }), warmVid(2, '2 min', { generationEnabled: false })];
      expect(selectBookendVideos('warmup', pool, 4)).toEqual([]);
    });

    it('prefers videos for the muscles the day trains', () => {
      const legs = warmVid(1, '2 min', { primaryMuscles: ['Quads'] });
      const arms = warmVid(0, '2 min', { primaryMuscles: ['Biceps'] });
      // w0 sorts first by id, so only the muscle match can put w1 ahead.
      expect(selectBookendVideos('warmup', [arms, legs], 2, new Set(['Quads'] as any)).map(v => v.id)).toEqual(['w1']);
    });

    it('rotates rather than repeating a video it used earlier in the week', () => {
      const pool = [warmVid(1), warmVid(2)];
      expect(selectBookendVideos('warmup', pool, 2).map(v => v.id)).toEqual(['w1']);
      expect(selectBookendVideos('warmup', pool, 2, [], { usedEarlierInWeek: new Set(['w1']) }).map(v => v.id)).toEqual(['w2']);
    });

    it('never goes past the room the session has for them', () => {
      expect(selectBookendVideos('warmup', [warmVid(1, '5 min')], 6, [], { maxMinutes: 4 })).toEqual([]);
    });

    it('asks for nothing when there is no time to fill', () => {
      expect(selectBookendVideos('warmup', [warmVid(1)], 0)).toEqual([]);
    });
  });

  describe('the cardio at each end is never a video', () => {
    it('is picked from what is not a video, however well a video is tagged', () => {
      const w = warmVid(1, '2 min', { primaryMuscles: ['Quads', 'Glutes', 'Hamstrings'] });
      expect(selectBookendExercise('warmup', [bike, w], new Set(['Quads', 'Glutes', 'Hamstrings'] as any))?.id).toBe('bike');
    });

    it('finds nothing when the library holds only videos', () => {
      expect(selectBookendExercise('warmup', [warmVid(1)])).toBeNull();
    });
  });

  describe('in a generated plan', () => {
    const run = (library: LibraryExercise[], sessionMinutes: number, days = 3) => {
      const blueprintDays = buildCombinedBlueprint(['Muscle gain'], days, sessionMinutes);
      const p = profile({ daysPerWeek: days, sessionMinutes });
      const r = generatePlan(
        { id: 't', name: 'T', goal: 'Muscle gain', daysPerWeek: String(days), durationMin: sessionMinutes, days: [], blueprintDays },
        library, gym([]), p,
      );
      if (!r.ok) throw new Error('plan failed');
      return { days: r.days, p };
    };
    const ends = (day: { exercises: Exercise[] }, kind: 'warmup' | 'cooldown') => day.exercises.filter(e => e.bookend === kind);

    it('is just 10 minutes of cardio at 45 minutes, whatever videos exist', () => {
      const lib = [...lifts, bike, warmVid(1), warmVid(2), warmVid(3)];
      const day = run(lib, 45).days[0];
      expect(ends(day, 'warmup')).toHaveLength(1);
      expect(ends(day, 'warmup')[0]).toMatchObject({ libraryExerciseId: 'bike', cardioMinutes: 10 });
      expect(day.warmup!.minutes).toBe(10);
    });

    it('adds about five minutes of dynamic stretching videos after the cardio at 60 minutes', () => {
      const lib = [...lifts, bike, warmVid(1), warmVid(2), warmVid(3)];
      const day = run(lib, 60).days[0];
      const warm = ends(day, 'warmup');
      // Two 2-minute videos make 4, short of the 5 asked for, so a third is taken.
      expect(warm.map(e => e.libraryExerciseId)).toEqual(['bike', 'w1', 'w2', 'w3']);
      expect(warm[0].cardioMinutes).toBe(10);
      expect(warm.slice(1).map(e => e.cardioMinutes)).toEqual([2, 2, 2]);
      expect(day.warmup!.minutes).toBe(16);
      // The cardio opens the day and the videos follow it before any lifting.
      expect(day.exercises.slice(0, 4).map(e => e.bookend)).toEqual(['warmup', 'warmup', 'warmup', 'warmup']);
    });

    it('adds five minutes of activation videos at 75 minutes, for a 15 minute warm-up', () => {
      const lib = [...lifts, bike, warmVid(1, '5 min'), warmVid(2, '5 min'), warmVid(3, '5 min')];
      const day = run(lib, 75).days[0];
      const videos = ends(day, 'warmup').slice(1);
      expect(videos.map(e => e.cardioMinutes)).toEqual([5]);
      expect(day.warmup!.minutes).toBe(15);
    });

    it('closes with a five minute walk and then stretching videos', () => {
      const lib = [...lifts, bike, coolVid(1, '4 min'), coolVid(2, '4 min'), coolVid(3, '4 min')];
      const day = run(lib, 60).days[0];
      const cool = ends(day, 'cooldown');
      // 5 minutes of stretching asked for: one 4-minute video, and a second would run too far over.
      expect(cool.map(e => e.libraryExerciseId)).toEqual(['bike', 'c1']);
      expect(cool[0].cardioMinutes).toBe(5);
      expect(day.cooldown!.minutes).toBe(9);
      expect(day.exercises[day.exercises.length - 1].bookend).toBe('cooldown');
    });

    it('counts the real length of the videos when fitting the weights', () => {
      const six = [
        ...lifts,
        exercise({ id: 'hinge', name: 'Deadlift', movementPattern: 'hinge' }),
        exercise({ id: 'press', name: 'Press', movementPattern: 'vertical_push' }),
        exercise({ id: 'plank', name: 'Plank', movementPattern: 'core', exerciseCategory: 'isolation' }),
        bike,
      ];
      // Long rests make the six lifts take about 31 minutes between them. At 54
      // minutes, 2-minute videos leave room for all six; 5-minute ones do not.
      const heavy = buildCombinedBlueprint(['Muscle gain'], 1, 54).map(d => ({
        ...d, slots: d.slots.map(sl => ({ ...sl, restSeconds: 120 })),
      }));
      const lifted = (videoLength: string) => {
        const lib = [...six, warmVid(1, videoLength), warmVid(2, videoLength), coolVid(1, videoLength), coolVid(2, videoLength)];
        const r = generatePlan(
          { id: 't', name: 'T', goal: 'Muscle gain', daysPerWeek: '1', durationMin: 54, days: [], blueprintDays: heavy },
          lib, gym([]), profile({ sessionMinutes: 54 }),
        );
        if (!r.ok) throw new Error('plan failed');
        return working(r.days[0]).length;
      };
      expect(lifted('2 min')).toBe(6);
      expect(lifted('5 min')).toBe(5);
    });

    it('rotates the stretching videos across the week', () => {
      const lib = [...lifts, bike, ...[1, 2, 3, 4, 5, 6].map(n => warmVid(n, '2 min'))];
      const { days } = run(lib, 60);
      const videos = (d: { exercises: Exercise[] }) => ends(d, 'warmup').slice(1).map(e => e.libraryExerciseId);
      // Six videos at three a day: the second day uses the three the first did not.
      expect(videos(days[0]).filter(id => videos(days[1]).includes(id))).toEqual([]);
    });

    it('writes the stretching out when there are no videos, for the muscles the day trains', () => {
      const day = run([...lifts, bike], 60).days[0];
      expect(ends(day, 'warmup')).toHaveLength(1);
      expect(day.warmup!.minutes).toBe(15);
      expect(day.cooldown!.minutes).toBe(10);
      const extra = day.warmup!.extra!.join(' ');
      expect(extra).toMatch(/Dynamic stretching, about 5 minutes/);
      expect(extra).toMatch(/squats/i);   // the day squats
      expect(extra).toMatch(/arm circles|push-ups/i); // and pushes
      expect(day.cooldown!.extra!.join(' ')).toMatch(/Stretch what you trained, holding each 30 seconds/);
    });

    it('leaves the written steps for a part that has no video when the other end does', () => {
      const day = run([...lifts, bike, warmVid(1), warmVid(2)], 60).days[0];
      // Warm-up is videos now; the cooldown has none tagged, so it is written out.
      expect(day.warmup!.extra!.join(' ')).not.toMatch(/Dynamic stretching/);
      expect(day.cooldown!.extra!.join(' ')).toMatch(/Stretch what you trained/);
    });

    it('still builds the warm-up when the gym has videos but no cardio', () => {
      // The lifts carry no muscle tags here: a lift whose muscles match the day would
      // otherwise score as a warm-up, as it always could.
      const bare = lifts.map(l => ({ ...l, primaryMuscles: undefined }));
      const day = run([...bare, warmVid(1), warmVid(2)], 60).days[0];
      const warm = ends(day, 'warmup');
      expect(warm[0].libraryExerciseId).toBeUndefined();
      expect(warm.slice(1).map(e => e.libraryExerciseId)).toEqual(['w1', 'w2']);
    });

    it('leaves out a video too long for the session', () => {
      const day = run([...lifts, bike, warmVid(1, '40 min')], 60).days[0];
      expect(ends(day, 'warmup')).toHaveLength(1);
      expect(day.warmup!.minutes).toBe(15);
    });

    it('passes validation, counting the videos toward the session length', () => {
      const lib = [...lifts, bike, warmVid(1), warmVid(2), coolVid(1), coolVid(2)];
      const { days, p } = run(lib, 60);
      expect(validatePlan(days, lib, gym([]), p)).toMatchObject({ valid: true, errors: [] });
    });
  });
});

// --- the strength session ---------------------------------------------------

describe('the strength session', () => {
  const lib = (extra: LibraryExercise[] = []) => [
    exercise({ id: 'squat', name: 'Squat', movementPattern: 'squat' }),
    exercise({ id: 'push', name: 'Press-up', movementPattern: 'horizontal_push' }),
    exercise({ id: 'pull', name: 'Pulldown', movementPattern: 'vertical_pull' }),
    exercise({ id: 'hinge', name: 'Hinge', movementPattern: 'hinge' }),
    exercise({ id: 'press', name: 'Overhead press', movementPattern: 'vertical_push' }),
    exercise({ id: 'tri', name: 'Pushdown', movementPattern: 'elbow_extension', exerciseCategory: 'isolation' }),
    exercise({ id: 'plank', name: 'Plank', movementPattern: 'core', exerciseCategory: 'isolation' }),
    exercise({ id: 'bike', name: 'Bike', exerciseCategory: 'cardio', movementPattern: 'conditioning', equipmentId: 'zone-cardio', bookendRoles: ['warmup', 'cooldown'] }),
    ...extra,
  ];
  // Its id sorts after "plank", so only the preference can put it ahead of the ordinary abs.
  const absVideo = (minutes = '5 min', id = 'zz-abs') => exercise({
    id, name: 'Abs routine', exerciseType: 'video', movementPattern: 'core', exerciseCategory: 'isolation',
    videoUrl: 'https://youtu.be/abs', videoDurationLabel: minutes, targetMuscle: 'Abs',
  });
  const activation = (id = 'act', minutes = '5 min') => exercise({
    id, name: 'Activation', exerciseType: 'video', movementPattern: undefined, exerciseCategory: 'mobility',
    bookendRoles: ['warmup'], videoUrl: 'https://youtu.be/act', videoDurationLabel: minutes, targetMuscle: 'Full body',
  } as any);
  const day = (goal: string, minutes: number, library: LibraryExercise[], days = 3) => {
    const blueprintDays = buildCombinedBlueprint([goal], days, minutes);
    const p = profile({ goal, daysPerWeek: days, sessionMinutes: minutes });
    const r = generatePlan(
      { id: 't', name: 'T', goal, daysPerWeek: String(days), durationMin: minutes, days: [], blueprintDays },
      library, gym([]), p,
    );
    if (!r.ok) throw new Error('plan failed');
    return { days: r.days, p, library };
  };

  describe('the day', () => {
    it('is a squat, a press, a pull, a hinge, an overhead press, triceps, then abs', () => {
      const slots = buildCombinedBlueprint(['Muscle gain'], 3, 75)[0].slots;
      expect(slots.map(s => s.movementPattern)).toEqual(
        ['squat', 'horizontal_push', 'vertical_pull', 'hinge', 'vertical_push', 'elbow_extension', 'core']);
    });

    it('makes the first three the session and trims the rest from the end', () => {
      const slots = buildCombinedBlueprint(['Muscle gain'], 3, 75)[0].slots;
      expect(slots.slice(0, 3).every(s => !s.optional)).toBe(true);
      expect(slots.slice(3).every(s => s.optional)).toBe(true);
      expect(slots.map(s => s.priority)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('pulls vertically, so there is no row in a full-body day', () => {
      expect(buildCombinedBlueprint(['Muscle gain'], 3, 75)[0].slots.some(s => s.movementPattern === 'horizontal_pull')).toBe(false);
    });

    it('is the day for one, two and three training days alike', () => {
      for (const days of [1, 2, 3]) {
        const bp = buildCombinedBlueprint(['Muscle gain'], days, 75);
        bp.forEach(d => expect(d.slots.map(s => s.movementPattern)[2]).toBe('vertical_pull'));
      }
    });

    it('leaves the split days as they were', () => {
      const bp = buildCombinedBlueprint(['Muscle gain'], 4, 75);
      expect(bp.map(d => d.name)).toEqual(['Upper', 'Lower', 'Upper', 'Lower']);
      expect(bp[0].slots.some(s => s.movementPattern === 'horizontal_pull')).toBe(true);
    });
  });

  describe('sets and reps for build muscle', () => {
    const bySlot = () => {
      const slots = buildCombinedBlueprint(['Muscle gain'], 3, 75)[0].slots;
      return Object.fromEntries(slots.map(s => [s.movementPattern, { sets: [s.setsMin, s.setsMax], reps: [s.repsMin, s.repsMax] }]));
    };

    it('does the four main lifts for 3 sets of 8-10', () => {
      const b = bySlot();
      for (const p of ['squat', 'horizontal_push', 'vertical_pull', 'hinge']) {
        expect(b[p].sets[0], p).toBe(3);
        expect(b[p].reps, p).toEqual([8, 10]);
      }
    });

    it('does the overhead press for 2 sets', () => {
      expect(bySlot().vertical_push.sets).toEqual([2, 2]);
    });

    it('does the triceps for 2 sets of 10-12', () => {
      const t = bySlot().elbow_extension;
      expect(t.sets[0]).toBe(2);
      expect(t.reps).toEqual([10, 12]);
    });

    it('rests 2 minutes between every set, on every exercise of the day', () => {
      const { days } = day('Muscle gain', 75, lib());
      const rests = working(days[0]).flatMap(e => (e.setDetails || []).map(s => s.restSec));
      expect(rests.length).toBeGreaterThan(0);
      expect(new Set(rests)).toEqual(new Set([120]));
    });

    it('leaves the other strength goals the rest they were given', () => {
      const rest = (goal: string) => buildCombinedBlueprint([goal], 3, 75)[0].slots.find(s => s.movementPattern === 'squat')!.restSeconds;
      expect(rest('General fitness')).toBe(90);
      expect(rest('Weight loss')).toBe(45);
    });

    it('generates exactly those sets for a beginner', () => {
      const { days } = day('Muscle gain', 75, lib());
      const sets = Object.fromEntries(working(days[0]).map(e => [e.libraryExerciseId, e.setDetails?.length]));
      expect(sets).toMatchObject({ squat: 3, push: 3, pull: 3, hinge: 3, press: 2, tri: 2 });
    });

    it('keeps the overhead press to two sets for the other strength goals too', () => {
      for (const goal of ['General fitness', 'Weight loss']) {
        const slots = buildCombinedBlueprint([goal], 3, 75)[0].slots;
        expect(slots.find(s => s.movementPattern === 'vertical_push')!.setsMin, goal).toBe(2);
      }
    });

    it('leaves each goal its own reps', () => {
      const reps = (goal: string) => buildCombinedBlueprint([goal], 3, 75)[0].slots[0].repsMin;
      expect(reps('Muscle gain')).toBe(8);
      expect(reps('General fitness')).toBe(12);
      expect(reps('Weight loss')).toBe(15);
    });
  });

  describe('the abs video', () => {
    it('takes a video for the abs over an ordinary abs exercise', () => {
      const { days } = day('Muscle gain', 75, lib([absVideo()]));
      const ids = working(days[0]).map(e => e.libraryExerciseId);
      expect(ids).toContain('zz-abs');
      expect(ids).not.toContain('plank');
    });

    it('falls back to an ordinary abs exercise when the library has no video', () => {
      const ids = working(day('Muscle gain', 75, lib()).days[0]).map(e => e.libraryExerciseId);
      expect(ids).toContain('plank');
    });

    it('is the last thing before the cooldown', () => {
      const { days } = day('Muscle gain', 75, lib([absVideo()]));
      const names = days[0].exercises.filter(e => !e.bookend).map(e => e.libraryExerciseId);
      expect(names[names.length - 1]).toBe('zz-abs');
      expect(days[0].exercises[days[0].exercises.length - 1].bookend).toBe('cooldown');
    });

    it('is watched for its own length, not counted in sets', () => {
      const abs = working(day('Muscle gain', 75, lib([absVideo('6 min')])).days[0]).find(e => e.libraryExerciseId === 'zz-abs')!;
      expect(abs).toMatchObject({ sets: 0, isCardio: true, cardioMinutes: 6 });
      expect(abs.setDetails).toBeUndefined();
    });

    it('is counted by its length when the day is fitted to the session', () => {
      // A 5-minute video fits a 60-minute session; a 20-minute one does not, and is left out.
      const fits = working(day('Muscle gain', 60, lib([absVideo('5 min')])).days[0]).map(e => e.libraryExerciseId);
      const tooLong = working(day('Muscle gain', 60, lib([absVideo('20 min')])).days[0]).map(e => e.libraryExerciseId);
      expect(fits).toContain('zz-abs');
      expect(tooLong).not.toContain('zz-abs');
    });

    it('passes validation, counting its minutes toward the session', () => {
      const library = lib([absVideo('5 min')]);
      const { days, p } = day('Muscle gain', 75, library);
      expect(validatePlan(days, library, gym([]), p)).toMatchObject({ valid: true, errors: [] });
      // The same day against a much shorter session is over length because the video counts.
      const tight = profile({ goal: 'Muscle gain', daysPerWeek: 3, sessionMinutes: 40 });
      expect(validatePlan(days, library, gym([]), tight).errors.some(e => /over the 40 min target/.test(e))).toBe(true);
    });
  });

  describe('checking a day with a video in it', () => {
    it('counts the video by its length, so one that runs long makes the day over length', () => {
      const library = lib([absVideo('5 min')]);
      const { days, p } = day('Muscle gain', 60, library);
      expect(validatePlan(days, library, gym([]), p).valid).toBe(true);
      const stretched = days.map(d => ({
        ...d, exercises: d.exercises.map(e => e.libraryExerciseId === 'zz-abs' ? { ...e, cardioMinutes: 40 } : e),
      }));
      expect(validatePlan(stretched, library, gym([]), p).errors.some(e => /over the 60 min target/.test(e))).toBe(true);
    });
  });

  describe('the whole 75 minute session', () => {
    it('is a 15 minute warm-up, the six lifts, the abs video and a cooldown', () => {
      const library = lib([absVideo('5 min'), activation('act', '5 min'),
        exercise({ id: 'cool', name: 'Stretch', exerciseType: 'video', movementPattern: undefined, exerciseCategory: 'mobility',
          bookendRoles: ['cooldown'], videoUrl: 'x', videoDurationLabel: '5 min' } as any)]);
      const { days } = day('Muscle gain', 75, library);
      const d = days[0];
      const seq = d.exercises.map(e => e.bookend ? `${e.bookend}:${e.libraryExerciseId}` : e.libraryExerciseId);
      expect(seq).toEqual([
        'warmup:bike', 'warmup:act',
        'squat', 'push', 'pull', 'hinge', 'press', 'tri', 'zz-abs',
        'cooldown:bike', 'cooldown:cool',
      ]);
      expect(d.warmup!.minutes).toBe(15);
      expect(d.exercises[0].cardioMinutes).toBe(10);
      expect(d.exercises[1].cardioMinutes).toBe(5);
    });
  });
});

// --- a session is never too long a list ---------------------------------------

describe('a session holds at most seven exercises', () => {
  // Two exercises for each pattern, so repeated slots (the second goal's copies
  // of the lifts) can always be filled when they are kept.
  const patterns = ['squat', 'horizontal_push', 'vertical_pull', 'hinge', 'vertical_push', 'horizontal_pull', 'lunge'] as const;
  const isos = ['elbow_extension', 'elbow_flexion', 'shoulder_abduction', 'core', 'calf_raise'] as const;
  const library: LibraryExercise[] = [
    ...patterns.flatMap(p => ['a', 'b'].map(n => exercise({ id: `${p}-${n}`, name: `${p}-${n}`, movementPattern: p }))),
    ...isos.flatMap(p => ['a', 'b'].map(n => exercise({ id: `${p}-${n}`, name: `${p}-${n}`, movementPattern: p, exerciseCategory: 'isolation' }))),
    exercise({ id: 'bike', name: 'Bike', exerciseCategory: 'cardio', movementPattern: 'conditioning', bookendRoles: ['warmup', 'cooldown'] }),
  ];
  const build = (goals: string[], minutes: number, focusAreas: any[] = [], days = 3, lib = library) => {
    const blueprintDays = buildCombinedBlueprint(goals, days, minutes, [], focusAreas);
    const r = generatePlan(
      { id: 't', name: 'T', goal: goals[0], daysPerWeek: String(days), durationMin: minutes, days: [], blueprintDays },
      lib, gym([]), profile({ goal: goals[0], daysPerWeek: days, sessionMinutes: minutes, focusAreas }),
    );
    if (!r.ok) throw new Error('plan failed');
    return { blueprintDays, days: r.days, decisions: r.decisions };
  };

  it('is five at 45 minutes, six at 60 and seven at 75', () => {
    expect(maxExercisesFor(45)).toBe(5);
    expect(maxExercisesFor(60)).toBe(6);
    expect(maxExercisesFor(75)).toBe(7);
    expect(maxExercisesFor(30)).toBe(5);
    expect(maxExercisesFor(90)).toBe(7);
  });

  it('turns thirteen asked for into seven, for two goals with two focus areas', () => {
    const { blueprintDays, days } = build(['Muscle gain', 'Weight loss'], 75, ['Arms', 'Shoulders']);
    // What the day is asked for before anything is trimmed: more than twelve.
    expect(blueprintDays[0].slots.length).toBeGreaterThan(12);
    days.forEach(d => expect(working(d).filter(e => !e.finisher).length).toBeLessThanOrEqual(maxExercisesFor(75)));
  });

  it('drops the second goal\'s copies of the lifts first', () => {
    const { blueprintDays, days } = build(['Muscle gain', 'Weight loss'], 75, ['Arms', 'Shoulders']);
    const day = days[0];
    const secondary = new Set(blueprintDays[0].slots.filter(sl => sl.aimTier === 'secondary').map(sl => sl.movementPattern));
    expect(secondary.size).toBeGreaterThan(0);
    // Each lift appears once, not once at 8-10 reps and again at 15-20.
    const counts = new Map<string, number>();
    working(day).forEach(e => counts.set(e.libraryExerciseId!.replace(/-[ab]$/, ''), (counts.get(e.libraryExerciseId!.replace(/-[ab]$/, '')) || 0) + 1));
    for (const p of ['squat', 'horizontal_push', 'vertical_pull']) expect(counts.get(p), p).toBe(1);
    // And every set left is at the day's own goal's reps.
    working(day).forEach(e => expect(parseInt(e.setDetails![0].reps, 10), e.name).toBeLessThanOrEqual(12));
  });

  it('keeps the main lifts, the client\'s focus areas and the abs, and gives up the rest', () => {
    const { days } = build(['Muscle gain', 'Weight loss'], 75, ['Arms', 'Shoulders']);
    const ids = working(days[0]).map(e => e.libraryExerciseId!.replace(/-[ab]$/, ''));
    for (const main of ['squat', 'horizontal_push', 'vertical_pull']) expect(ids).toContain(main);
    for (const focus of ['elbow_flexion', 'shoulder_abduction']) expect(ids).toContain(focus);
    expect(ids).toContain('core');
    // What goes first: the day's own triceps, then the overhead press, then the hinge.
    expect(ids).not.toContain('vertical_push');
    expect(ids).not.toContain('hinge');
  });

  it('drops the abs last of all, after the focus areas and the lifts around them', () => {
    const idsAt = (minutes: number) => working(build(['Muscle gain'], minutes, ['Arms']).days[0]).map(e => e.libraryExerciseId!.replace(/-[ab]$/, ''));
    // 45 minutes holds five: three main lifts, then the abs and the arms work ahead of the hinge.
    const at45 = idsAt(45);
    expect(at45).toHaveLength(5);
    expect(at45).toContain('core');
    expect(at45).toContain('elbow_flexion');
    expect(at45).not.toContain('hinge');
    // At 60 (six) and 75 (seven) the abs are still there.
    expect(idsAt(60)).toContain('core');
    expect(idsAt(75)).toContain('core');
  });

  it('leaves a day that is within seven exactly as it was', () => {
    const { blueprintDays, days } = build(['Muscle gain'], 75);
    expect(blueprintDays[0].slots).toHaveLength(7);
    expect(working(days[0])).toHaveLength(7);
  });

  it('trims a nine-exercise upper day on a four-day plan to seven', () => {
    const { blueprintDays, days } = build(['Muscle gain'], 75, [], 4);
    expect(blueprintDays.find(d => d.name === 'Upper')!.slots.length).toBeGreaterThan(7);
    days.forEach(d => expect(working(d).filter(e => !e.finisher).length, d.name).toBeLessThanOrEqual(7));
  });

  it('does not count the warm-up, the cool-down or the zone-2 cardio', () => {
    const { days } = build(['Weight loss'], 75, ['Arms', 'Shoulders']);
    const d = days[0];
    expect(d.exercises.some(e => e.finisher === 'zone2')).toBe(true);
    expect(d.exercises.filter(e => e.bookend).length).toBeGreaterThanOrEqual(2);
    expect(working(d).filter(e => !e.finisher)).toHaveLength(7);
  });

  it('never drops a main lift to meet the number, however many are required', () => {
    const slots = (['squat', 'horizontal_push', 'vertical_pull', 'hinge', 'vertical_push', 'horizontal_pull', 'lunge', 'squat', 'hinge'] as const)
      .map((p, i) => slot({ id: `s${i}`, movementPattern: p, priority: i + 1, role: 'primary' }));
    const r = generatePlan(
      { id: 't', name: 'T', goal: 'Muscle gain', daysPerWeek: '1', durationMin: 120, days: [], blueprintDays: [{ id: 'd', name: 'Day', slots }] },
      library, gym([]), profile({ sessionMinutes: 120 }),
    );
    if (!r.ok) throw new Error('plan failed');
    expect(working(r.days[0])).toHaveLength(9);
  });

  it('records what was dropped', () => {
    const { decisions } = build(['Muscle gain', 'Weight loss'], 75, ['Arms', 'Shoulders']);
    expect(decisions.filter(d => d.dropped).length).toBeGreaterThanOrEqual(6);
  });
});
