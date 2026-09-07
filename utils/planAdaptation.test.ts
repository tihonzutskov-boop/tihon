import { describe, it, expect } from 'vitest';
import { evaluateExercise, needsProgramReview, AdaptationInput } from './planAdaptation';
import { ExerciseLog } from '../types';

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

describe('needsProgramReview', () => {
  it('holds off before week 12', () => {
    expect(needsProgramReview(11)).toBe(false);
  });
  // The evidence base stops at 12 weeks, so the engine stops there too.
  it('asks for a decision at week 12', () => {
    expect(needsProgramReview(12)).toBe(true);
  });
});
