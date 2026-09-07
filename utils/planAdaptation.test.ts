import { describe, it, expect } from 'vitest';
import { evaluateExercise, needsProgramReview, selectSubstitute, applyWeeklyVolumeCeiling, VolumeCandidate, AdaptationDecision, AdaptationInput } from './planAdaptation';
import { ExerciseLog, LibraryExercise } from '../types';

// --- fixtures ---------------------------------------------------------------

// A session where every set hit exactly the target.
const onTarget = (over: Partial<ExerciseLog> = {}): ExerciseLog => ({
  exerciseId: 'ex1',
  weight: 50,
  sets: [
    { reps: 8, targetReps: 8 },
    { reps: 8, targetReps: 8 },
    { reps: 8, targetReps: 8 },
  ],
  effort: 3,
  pain: false,
  ...over,
});

// A session that beat the target — the progression trigger's raw material.
const beat = (over: Partial<ExerciseLog> = {}): ExerciseLog => ({
  ...onTarget(),
  sets: [
    { reps: 10, targetReps: 8 },
    { reps: 9, targetReps: 8 },
    { reps: 9, targetReps: 8 },
  ],
  ...over,
});

const input = (logs: ExerciseLog[], over: Partial<AdaptationInput> = {}): AdaptationInput => ({
  logs,
  targetReps: 8,
  isCompound: true,
  ...over,
});

describe('evaluateExercise — pain outranks everything', () => {
  it('withdraws the movement when pain is reported', () => {
    const d = evaluateExercise(input([onTarget({ pain: true })]));
    expect(d.action).toBe('withdraw');
    expect(d.rule).toBe('PAIN-5');
  });

  // The precedence case that matters most: a client can beat their target and
  // hurt in the same session. The pain has to win.
  it('withdraws even when the progression trigger is also met', () => {
    const d = evaluateExercise(input([beat({ pain: true }), beat()]));
    expect(d.action).toBe('withdraw');
  });

  it('refers rather than retrying after a second pain report', () => {
    const d = evaluateExercise(input([onTarget({ pain: true }), onTarget(), onTarget({ pain: true })]));
    expect(d.action).toBe('refer');
    expect(d.rule).toBe('PAIN-7');
  });

  it('refers even when the trigger is met — pain history is not overridden by good reps', () => {
    const d = evaluateExercise(input([beat({ pain: true }), beat({ pain: true })]));
    expect(d.action).toBe('refer');
  });
});

describe('evaluateExercise — failure guardrail', () => {
  it('reduces load when the client reached failure', () => {
    const d = evaluateExercise(input([onTarget({ effort: 5 })]));
    expect(d.action).toBe('reduce-load');
    expect(d.loadMultiplier).toBeLessThan(1);
  });

  // Hitting failure while beating the target is not an achievement to build on.
  it('reduces load even when the progression trigger is met', () => {
    const d = evaluateExercise(input([beat({ effort: 5 }), beat()]));
    expect(d.action).toBe('reduce-load');
  });

  it('raises load immediately when the set was far too easy', () => {
    const d = evaluateExercise(input([onTarget({ effort: 1 })]));
    expect(d.action).toBe('raise-load');
  });

  // Effort 4 means one rep left: already maximal, so the weight holds.
  it('vetoes progression when the set finished with one rep left', () => {
    const d = evaluateExercise(input([beat({ effort: 4 }), beat()]));
    expect(d.action).toBe('maintain');
    expect(d.rule).toBe('LOAD-5');
  });
});

describe('evaluateExercise — stall protocol', () => {
  const flat = () => [onTarget(), onTarget(), onTarget(), onTarget()];

  it('adds a set after several sessions without improvement', () => {
    const d = evaluateExercise(input(flat()));
    expect(d.action).toBe('add-set');
    expect(d.setsDelta).toBe(1);
  });

  it('deloads once the added set has not restarted progress', () => {
    const d = evaluateExercise(input(Array.from({ length: 8 }, () => onTarget())));
    expect(d.action).toBe('deload');
  });

  // Precedence: stalling beats a due volume increase.
  it('does not raise load while stalled', () => {
    const d = evaluateExercise(input(flat()));
    expect(d.action).not.toBe('raise-load');
  });

  // A weight change means the client is working at something new, not plateaued.
  it('does not count sessions at different weights as a stall', () => {
    const d = evaluateExercise(input([
      onTarget({ weight: 60 }), onTarget({ weight: 55 }), onTarget({ weight: 50 }), onTarget({ weight: 45 }),
    ]));
    expect(d.action).toBe('maintain');
  });
});

describe('evaluateExercise — progression', () => {
  it('does not advance on a single good session', () => {
    const d = evaluateExercise(input([beat(), onTarget()]));
    expect(d.action).toBe('maintain');
  });

  it('raises load after beating the target twice in a row', () => {
    const d = evaluateExercise(input([beat(), beat()]));
    expect(d.action).toBe('raise-load');
    expect(d.rule).toBe('LOAD-2');
    expect(d.loadMultiplier).toBeCloseTo(1.05);
  });

  it('takes the smaller jump on isolation work', () => {
    const d = evaluateExercise(input([beat(), beat()], { isCompound: false }));
    expect(d.loadMultiplier).toBeCloseTo(1.02);
  });

  // LOAD-3: use the rep band up before the weight moves.
  it('adds reps before load when the band still has room', () => {
    const d = evaluateExercise(input([beat(), beat()], { repsMin: 8, repsMax: 12 }));
    expect(d.action).toBe('raise-reps');
    expect(d.rule).toBe('LOAD-3');
  });

  it('raises load once the top of the rep band is reached', () => {
    const topOfBand = beat({ sets: [
      { reps: 12, targetReps: 10 },
      { reps: 12, targetReps: 10 },
      { reps: 12, targetReps: 10 },
    ] });
    const d = evaluateExercise(input([topOfBand, topOfBand], { targetReps: 10, repsMin: 8, repsMax: 12 }));
    expect(d.action).toBe('raise-load');
  });

  // One strong opening set is not the same as carrying the load through the work.
  it('does not trigger when only some sets met the target', () => {
    const partial = onTarget({ sets: [
      { reps: 10, targetReps: 8 },
      { reps: 6, targetReps: 8 },
      { reps: 5, targetReps: 8 },
    ] });
    const d = evaluateExercise(input([partial, partial]));
    expect(d.action).not.toBe('raise-load');
  });
});

describe('evaluateExercise — no history', () => {
  it('changes nothing before anything has been logged', () => {
    const d = evaluateExercise(input([]));
    expect(d.action).toBe('maintain');
    expect(d.rule).toBe('LOAD-1');
  });
});

describe('selectSubstitute', () => {
  const ex = (over: Partial<LibraryExercise> & { id: string }): LibraryExercise => ({
    name: over.id,
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

  const barbellBench = ex({
    id: 'bench',
    movementPattern: 'horizontal_push',
    primaryMuscles: ['Chest'],
    jointStress: ['Shoulders', 'Elbows'],
  });

  it('excludes anything loading the painful area, however well it otherwise fits', () => {
    // A perfect pattern and muscle match — but it loads the shoulder.
    const alsoShoulders = ex({ id: 'dip', primaryMuscles: ['Chest'], jointStress: ['Shoulders'] });
    const shoulderSafe = ex({ id: 'machine-press', primaryMuscles: ['Chest'], jointStress: ['Elbows'] });
    const pick = selectSubstitute({
      withdrawn: barbellBench,
      pool: [alsoShoulders, shoulderSafe],
      painArea: 'Shoulders',
    });
    expect(pick?.id).toBe('machine-press');
  });

  it('returns null when every candidate loads the painful area', () => {
    const pick = selectSubstitute({
      withdrawn: barbellBench,
      pool: [ex({ id: 'a', jointStress: ['Shoulders'] }), ex({ id: 'b', jointStress: ['Shoulders'] })],
      painArea: 'Shoulders',
    });
    expect(pick).toBeNull();
  });

  it('prefers the same movement pattern so the session keeps its shape', () => {
    const samePattern = ex({ id: 'push', movementPattern: 'horizontal_push', jointStress: [] });
    const otherPattern = ex({ id: 'pull', movementPattern: 'horizontal_pull', jointStress: [] });
    const pick = selectSubstitute({
      withdrawn: barbellBench,
      pool: [otherPattern, samePattern],
      painArea: 'Shoulders',
    });
    expect(pick?.id).toBe('push');
  });

  it('prefers an exercise training the same muscles', () => {
    const sameMuscle = ex({ id: 'same', movementPattern: 'squat', primaryMuscles: ['Chest'], jointStress: [] });
    const otherMuscle = ex({ id: 'other', movementPattern: 'squat', primaryMuscles: ['Calves'], jointStress: [] });
    const pick = selectSubstitute({
      withdrawn: barbellBench,
      pool: [otherMuscle, sameMuscle],
      painArea: 'Shoulders',
    });
    expect(pick?.id).toBe('same');
  });

  // Without a reported area the withdrawn exercise's own stress profile is the
  // best guess at the culprit, so overlap with it is penalised.
  it('avoids the same joints when the painful area is unknown', () => {
    const sameJoints = ex({ id: 'same-joints', primaryMuscles: ['Chest'], jointStress: ['Shoulders', 'Elbows'] });
    const differentJoints = ex({ id: 'diff-joints', primaryMuscles: ['Chest'], jointStress: ['Wrists'] });
    const pick = selectSubstitute({
      withdrawn: barbellBench,
      pool: [sameJoints, differentJoints],
    });
    expect(pick?.id).toBe('diff-joints');
  });

  it('never returns the withdrawn exercise or one already in the day', () => {
    const other = ex({ id: 'other', jointStress: [] });
    const pick = selectSubstitute({
      withdrawn: barbellBench,
      pool: [barbellBench, other],
      alreadyUsedIds: new Set(['other']),
    });
    expect(pick).toBeNull();
  });

  it('is deterministic when candidates tie', () => {
    const a = ex({ id: 'aaa', jointStress: [] });
    const b = ex({ id: 'bbb', jointStress: [] });
    const first = selectSubstitute({ withdrawn: barbellBench, pool: [b, a] });
    const second = selectSubstitute({ withdrawn: barbellBench, pool: [a, b] });
    expect(first?.id).toBe(second?.id);
  });
});

describe('applyWeeklyVolumeCeiling', () => {
  const addSet = (rule = 'STALL-2'): AdaptationDecision => ({
    action: 'add-set', rule, reason: 'stalled', setsDelta: 1,
  });
  const candidate = (over: Partial<VolumeCandidate> & { id: string }): VolumeCandidate => ({
    muscles: ['Chest'],
    baseSets: 0,
    decision: addSet(),
    ...over,
  });

  it('allows an add-set that lands exactly at the ceiling', () => {
    const result = applyWeeklyVolumeCeiling([candidate({ id: 'a', baseSets: 19 })]);
    expect(result[0].decision.action).toBe('add-set');
  });

  it('holds an add-set that would push the muscle past the ceiling', () => {
    const result = applyWeeklyVolumeCeiling([candidate({ id: 'a', baseSets: 20 })]);
    expect(result[0].decision.action).toBe('maintain');
    expect(result[0].decision.rule).toBe('VOL-1');
  });

  // The case the rule exists for: two different exercises stall independently
  // in the same week, and neither evaluateExercise call can see the other.
  it('accounts for another exercise training the same muscle', () => {
    const result = applyWeeklyVolumeCeiling([
      candidate({ id: 'bench', muscles: ['Chest'], baseSets: 12 }),
      candidate({ id: 'flye', muscles: ['Chest'], baseSets: 8 }),
    ]);
    // Combined base is already 20 — at the ceiling before either add-set.
    expect(result.find(r => r.id === 'bench')!.decision.action).toBe('maintain');
    expect(result.find(r => r.id === 'flye')!.decision.action).toBe('maintain');
  });

  // Deterministic tie-break: whichever exercise comes first in the week's
  // natural order gets the remaining headroom.
  it('gives the earlier exercise in the week priority for the last available set', () => {
    const result = applyWeeklyVolumeCeiling([
      candidate({ id: 'first', muscles: ['Chest'], baseSets: 10 }),
      candidate({ id: 'second', muscles: ['Chest'], baseSets: 9 }),
    ]);
    expect(result.find(r => r.id === 'first')!.decision.action).toBe('add-set');
    expect(result.find(r => r.id === 'second')!.decision.action).toBe('maintain');
  });

  it('holds only if any one of an exercise\'s trained muscles would breach', () => {
    const result = applyWeeklyVolumeCeiling([
      candidate({ id: 'a', muscles: ['Chest', 'Triceps'], baseSets: 20 }),
    ]);
    // Chest is at the ceiling even though Triceps has room — the whole
    // add-set is held rather than adding a fraction of a set.
    expect(result[0].decision.action).toBe('maintain');
  });

  it('never touches a decision with no positive setsDelta', () => {
    const deload: AdaptationDecision = { action: 'deload', rule: 'STALL-3', reason: 'stalled', setsDelta: -1 };
    const maintain: AdaptationDecision = { action: 'maintain', rule: 'LOAD-2', reason: 'same again' };
    const result = applyWeeklyVolumeCeiling([
      candidate({ id: 'a', baseSets: 20, decision: deload }),
      candidate({ id: 'b', baseSets: 20, decision: maintain }),
    ]);
    expect(result.find(r => r.id === 'a')!.decision).toEqual(deload);
    expect(result.find(r => r.id === 'b')!.decision).toEqual(maintain);
  });

  it('never reduces sets that are already prescribed, even at or over the ceiling', () => {
    // Base volume alone is already over 20 (a generator concern, not this
    // pass's job to fix) — the add-set is still just held, nothing is cut.
    const result = applyWeeklyVolumeCeiling([candidate({ id: 'a', baseSets: 25 })]);
    expect(result[0].decision.action).toBe('maintain');
  });
});

describe('needsProgramReview', () => {
  it('holds off before week 12', () => {
    expect(needsProgramReview(11)).toBe(false);
  });
  // The evidence base stops at 12 weeks, so the engine stops there too.
  it('asks for a decision at week 12', () => {
    expect(needsProgramReview(12)).toBe(true);
  });
});
