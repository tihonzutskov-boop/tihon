// Plan adaptation — what the log does to the next session.
//
// The generator decides what a plan looks like before anyone has trained. This
// module decides what it looks like afterwards, from what was actually logged.
//
// The rules are a priority chain, not a menu. They are evaluated in a fixed
// order and the first one that fires wins:
//
//   pain  →  failure  →  stall  →  progression  →  maintain
//
// The ordering is the substance, not an implementation detail. Someone who
// reports pain AND beat their rep target has the movement withdrawn — the
// progression never runs. Someone stalling AND owed a set gets the stall
// protocol, not more volume. Every rule below cites the spec rule it encodes.

import { ExerciseLog, EffortRating, LibraryExercise, JointStressArea, MuscleGroup, Exercise } from '../types.js';

export type AdaptationAction =
  | 'refer'        // stop, recommend a professional — the app does not self-manage this
  | 'withdraw'     // pull this movement pattern, substitute around it
  | 'reduce-load'  // the set reached failure; back the weight off
  | 'add-set'      // stalled: more volume on this exercise only
  | 'deload'       // stalled through the add-set step: cut volume for a week
  | 'raise-load'   // progression trigger met
  | 'raise-reps'   // progression trigger met, but there is still room in the rep band
  | 'maintain';    // nothing has earned a change

export interface AdaptationDecision {
  action: AdaptationAction;
  rule: string;    // the spec rule this came from, so a plan change is always traceable
  reason: string;  // plain language, safe to show the client
  /** Multiply the working weight by this. Present only for load changes. */
  loadMultiplier?: number;
  /** Change to the number of sets. Present only for volume changes. */
  setsDelta?: number;
}

export interface AdaptationInput {
  /** This exercise's sessions, newest first. */
  logs: ExerciseLog[];
  /** Reps the plan asked for at the time. */
  targetReps: number;
  /** Rep band, when the slot carries one — enables reps-before-load (LOAD-3). */
  repsMin?: number;
  repsMax?: number;
  /** Compounds take the bigger jump (LOAD-3 in the rulebook). */
  isCompound?: boolean;
}

// LOAD-3: 5–10% for large-muscle compounds, 2–5% for isolation. The lower end
// of each band is used: this population is the one where over-progression is
// the documented injury mechanism, so the conservative edge is the default.
const LOAD_STEP_COMPOUND = 1.05;
const LOAD_STEP_ISOLATION = 1.02;
// Reaching failure means the working weight is already past target.
const LOAD_STEP_DOWN = 0.9;

// PAIN-7: a pattern withdrawn twice for the same complaint stops being a
// programming problem.
const PAIN_EVENTS_BEFORE_REFERRAL = 2;

// STALL-1/2/3. Counted in sessions rather than weeks so the rule behaves the
// same for someone training once a week and someone training four times.
const SESSIONS_BEFORE_ADD_SET = 3;
const SESSIONS_BEFORE_DELOAD = 6;

const bestReps = (log: ExerciseLog): number =>
  log.sets.reduce((max, s) => Math.max(max, s.reps), 0);

// The progression trigger: every completed set met its target, and at least one
// went 1–2 reps beyond it. Requiring all sets to hold prevents a single strong
// first set from advancing a load the client could not carry through the work.
const beatTarget = (log: ExerciseLog, targetReps: number): boolean => {
  if (log.sets.length === 0) return false;
  return log.sets.every(s => s.reps >= (s.targetReps || targetReps))
    && log.sets.some(s => s.reps > (s.targetReps || targetReps));
};

const sameWeight = (a: ExerciseLog, b: ExerciseLog): boolean =>
  (a.weight ?? null) === (b.weight ?? null);

// How many of the most recent consecutive sessions failed to improve at an
// unchanged weight. A weight change resets it: the client is not stalled, they
// are working at something new.
const stalledSessions = (logs: ExerciseLog[]): number => {
  let count = 0;
  for (let i = 0; i < logs.length - 1; i++) {
    if (!sameWeight(logs[i], logs[i + 1])) break;
    if (bestReps(logs[i]) > bestReps(logs[i + 1])) break;
    count++;
  }
  return count;
};

const loadStep = (isCompound?: boolean) =>
  isCompound ? LOAD_STEP_COMPOUND : LOAD_STEP_ISOLATION;

export const evaluateExercise = (input: AdaptationInput): AdaptationDecision => {
  const { logs, targetReps, repsMin, repsMax, isCompound } = input;

  // Nothing logged yet: week one is calibration (LOAD-1), and there is no
  // honest basis for changing anything.
  if (logs.length === 0) {
    return { action: 'maintain', rule: 'LOAD-1', reason: 'No sessions logged yet — the first session sets the working weight.' };
  }

  const latest = logs[0];

  // --- 1. Pain (PAIN-5, PAIN-7) --------------------------------------------
  // Outranks everything. A client can report pain in the same session they beat
  // their target; the pain is what matters.
  if (latest.pain) {
    const painEvents = logs.filter(l => l.pain).length;
    if (painEvents >= PAIN_EVENTS_BEFORE_REFERRAL) {
      return {
        action: 'refer',
        rule: 'PAIN-7',
        reason: 'This movement has hurt more than once. It stays out of the plan, and this is worth having looked at by a professional.',
      };
    }
    return {
      action: 'withdraw',
      rule: 'PAIN-5',
      reason: 'This movement hurt, so it comes out of the plan and is replaced with one that works the same muscles.',
    };
  }

  // --- 2. Failure guardrail (LOAD-5) ---------------------------------------
  // Effort 5 means the set reached failure, which is never programmed for a
  // beginner. Caught here, above the stall and progression rules, because it is
  // a load that is already too heavy — not a plateau and not an achievement.
  if (latest.effort === 5) {
    return {
      action: 'reduce-load',
      rule: 'LOAD-5',
      reason: 'That set had nothing left in it. The weight comes down so the next one finishes with reps in reserve.',
      loadMultiplier: LOAD_STEP_DOWN,
    };
  }

  // --- 3. Stall (STALL-1, STALL-2, STALL-3) --------------------------------
  // Checked before progression: a client who is stalling and also due more
  // volume gets the stall protocol, not more sets piled on top.
  const stalled = stalledSessions(logs);
  if (stalled >= SESSIONS_BEFORE_DELOAD) {
    return {
      action: 'deload',
      rule: 'STALL-3',
      reason: 'Progress has been flat for a while. An easier week now usually restarts it.',
      setsDelta: -1,
    };
  }
  if (stalled >= SESSIONS_BEFORE_ADD_SET) {
    return {
      action: 'add-set',
      rule: 'STALL-2',
      reason: 'The weight has held steady for a few sessions — one more set on this exercise, same weight.',
      setsDelta: 1,
    };
  }

  // --- 4. Progression (LOAD-2, LOAD-3, LOAD-5) ------------------------------
  // Effort 1 says the load is far too light. Rep count alone would take weeks
  // to walk that up, so it advances without waiting for two sessions.
  if (latest.effort === 1) {
    return {
      action: 'raise-load',
      rule: 'LOAD-5',
      reason: 'That felt very easy — the weight goes up.',
      loadMultiplier: loadStep(isCompound),
    };
  }

  const trigger = logs.length >= 2
    && beatTarget(logs[0], targetReps)
    && beatTarget(logs[1], targetReps);

  if (trigger) {
    // Effort 4 vetoes the increase. Beating the target while finishing with
    // one rep left means the set was already maximal, and adding weight on top
    // of that is the novice injury mechanism SAFE-3 exists to prevent.
    if (latest.effort === 4) {
      return {
        action: 'maintain',
        rule: 'LOAD-5',
        reason: 'Good reps, but that was already close to the limit — same weight again before adding any.',
      };
    }

    // LOAD-3: use up the rep band before touching the weight.
    if (repsMax != null && bestReps(latest) < repsMax) {
      return {
        action: 'raise-reps',
        rule: 'LOAD-3',
        reason: 'Same weight, aiming for a couple more reps this time.',
      };
    }

    return {
      action: 'raise-load',
      rule: 'LOAD-2',
      reason: 'Target beaten two sessions running — time to add weight.',
      loadMultiplier: loadStep(isCompound),
      ...(repsMin != null ? { setsDelta: 0 } : {}),
    };
  }

  return { action: 'maintain', rule: 'LOAD-2', reason: 'Same again — the target has not been beaten twice in a row yet.' };
};

// ---------------------------------------------------------------------------
// Substitution (PAIN-5)
// ---------------------------------------------------------------------------
//
// A withdrawn movement is replaced, not deleted — the session keeps its shape,
// and the client still trains the muscles the slot existed to cover.

export const SUBSTITUTION_SCORING = {
  samePattern: 30,          // keeps the session's structure intact
  perSharedMuscle: 10,      // still trains what the slot was there for
  beginnerAppropriate: 8,   // SAFE-4: simpler movement when something already hurts
  perSharedStressArea: -12, // used only when the painful area is unknown
};

export interface SubstituteInput {
  /** The movement being replaced. */
  withdrawn: LibraryExercise;
  /** Exercises already filtered for this gym's equipment and the client's injuries. */
  pool: LibraryExercise[];
  /** Where it hurt. Absent for logs recorded before the area was captured. */
  painArea?: JointStressArea | null;
  /** Exercises already in this day, so a substitute never duplicates one. */
  alreadyUsedIds?: Set<string>;
}

const shared = <T,>(a: T[] | undefined, b: T[] | undefined): number => {
  if (!a?.length || !b?.length) return 0;
  const set = new Set(b);
  return a.filter(x => set.has(x)).length;
};

// Returns null when nothing qualifies. That is a real outcome — a thin library
// or a widely-loaded painful area can leave no safe option — and the caller
// leaves the slot empty rather than substituting something that also hurts.
export const selectSubstitute = (input: SubstituteInput): LibraryExercise | null => {
  const { withdrawn, pool, painArea, alreadyUsedIds } = input;

  const candidates = pool.filter(ex => {
    if (ex.id === withdrawn.id) return false;
    if (alreadyUsedIds?.has(ex.id)) return false;
    if (ex.generationEnabled === false) return false;
    // A known painful area is a hard exclusion, not a penalty. Anything loading
    // it is disqualified however well it scores otherwise.
    if (painArea && (ex.jointStress || []).includes(painArea)) return false;
    return true;
  });
  if (candidates.length === 0) return null;

  const scoreOne = (ex: LibraryExercise): number => {
    let score = 0;
    if (ex.movementPattern === withdrawn.movementPattern) score += SUBSTITUTION_SCORING.samePattern;
    score += shared<MuscleGroup>(ex.primaryMuscles, withdrawn.primaryMuscles) * SUBSTITUTION_SCORING.perSharedMuscle;
    if (ex.minExperience === 'Beginner') score += SUBSTITUTION_SCORING.beginnerAppropriate;
    // Without a reported area, the withdrawn exercise's own stress profile is
    // the best available guess at what hurt — so overlap with it is penalised
    // rather than excluded, since one of those joints is the likely culprit.
    if (!painArea) {
      score += shared<JointStressArea>(ex.jointStress, withdrawn.jointStress) * SUBSTITUTION_SCORING.perSharedStressArea;
    }
    return score;
  };

  // Ties break by id so the same inputs always produce the same substitute,
  // matching how slot selection behaves in the generator.
  return candidates
    .map(ex => ({ ex, score: scoreOne(ex) }))
    .sort((a, b) => (b.score - a.score) || a.ex.id.localeCompare(b.ex.id))[0].ex;
};

// Swapping an exercise means swapping everything that identifies it, not just
// the label. Updating the name and library id alone left the withdrawn
// movement's zone, machine and video behind, so the session showed one
// exercise's name, picture and tutorial while the map pointed at the equipment
// for a different one — and sent the client to the wrong machine.
//
// Mirrors what the generator does when it builds an exercise from a library
// entry, so a substituted exercise is indistinguishable from a generated one.
export const applySubstitution = (ex: Exercise, substitute: LibraryExercise): Exercise => ({
  ...ex,
  libraryExerciseId: substitute.id,
  name: substitute.name,
  targetMuscle: substitute.targetMuscle,
  // 'manual' is not a fallback so much as the correct answer for an exercise
  // with no fixed home: it tells the locator to resolve by name against the
  // client's own gym instead of trusting a stale zone id.
  equipmentId: substitute.equipmentId || 'manual',
  // The withdrawn exercise's machine is a specific physical object that has
  // nothing to do with the replacement. Cleared so the map re-resolves.
  machineId: undefined,
  videoUrl: substitute.videoUrl,
  substitutedFor: { id: ex.libraryExerciseId || '', name: ex.name },
});

// FP-1 / H-1: every rule in the beginner spec is evidenced for 8–12 weeks. Past
// that the engine stops rather than extrapolating, and asks for a decision.
export const BEGINNER_REVIEW_WEEK = 12;

export const needsProgramReview = (weeksTrained: number): boolean =>
  weeksTrained >= BEGINNER_REVIEW_WEEK;

// ---------------------------------------------------------------------------
// Weekly volume ceiling (FIX-1, STALL-2)
// ---------------------------------------------------------------------------
//
// evaluateExercise reasons about one exercise at a time, so it has no way to
// see that a different exercise trains the same muscle. Two exercises that
// both happen to stall in the same week can each independently earn an
// add-set — and each is individually correct — while the client's actual
// chest volume for the week quietly climbs past the point the rulebook
// considers safe. This pass is the cross-exercise check that catches that:
// it looks at every exercise in the week together, per muscle, before any
// add-set is allowed to take effect.
//
// FIX-1 fixed the unit as sets / muscle / week, ceiling 20. STALL-2 requires
// that adding a set "keeps total weekly volume under the ceiling" — this is
// that requirement, enforced as a hold rather than the more elaborate
// "ease effort on everything else" redistribution STALL-2 also describes.
// Redistributing would mean walking back sets on unrelated exercises the
// client has nothing wrong with, which is a bigger and riskier feature than
// refusing one increase; holding is the conservative reading of the same rule.
export const VOLUME_CEILING_PER_MUSCLE_PER_WEEK = 20;

export interface VolumeCandidate {
  /** Stable id for this exercise's slot in the week, e.g. `${dayIndex}-${exerciseIndex}`. */
  id: string;
  /** Muscles the exercise that will actually be trained works — the substitute's, not the original's, when one applies. */
  muscles: MuscleGroup[];
  /** Sets already prescribed before this decision's delta — the week's volume if nothing changed. */
  baseSets: number;
  decision: AdaptationDecision;
}

export interface VolumeCappedResult {
  id: string;
  decision: AdaptationDecision;
}

// Only a positive setsDelta (currently just add-set) can raise weekly volume,
// so a deload, a hold, or a load change is never touched here — this pass
// only ever prevents growth, never removes a set the client is already doing.
export const applyWeeklyVolumeCeiling = (candidates: VolumeCandidate[]): VolumeCappedResult[] => {
  const committed: Partial<Record<MuscleGroup, number>> = {};
  for (const c of candidates) {
    for (const m of c.muscles) committed[m] = (committed[m] || 0) + c.baseSets;
  }

  // Processed in the order given — the week's natural day-then-exercise
  // order — so when two exercises compete for the same muscle's last bit of
  // headroom, the earlier one in the week gets it. Simple, deterministic, and
  // easy to explain rather than an arbitrary tie-break.
  return candidates.map(c => {
    const delta = c.decision.setsDelta ?? 0;
    if (delta <= 0) return { id: c.id, decision: c.decision };

    const wouldBreach = c.muscles.some(
      m => (committed[m] || 0) + delta > VOLUME_CEILING_PER_MUSCLE_PER_WEEK
    );
    if (!wouldBreach) {
      c.muscles.forEach(m => { committed[m] = (committed[m] || 0) + delta; });
      return { id: c.id, decision: c.decision };
    }

    return {
      id: c.id,
      decision: {
        action: 'maintain',
        rule: 'VOL-1',
        reason: 'This muscle is already at its training limit for the week, so this holds for now rather than adding another set.',
      },
    };
  });
};
