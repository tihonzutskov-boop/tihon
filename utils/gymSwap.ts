// A plan, checked against the gym the client is at today.
//
// A plan is built from the equipment of the client's usual location. Another
// location of the same chain may not have all of it, so before a session there
// every exercise is checked against what that location has. Whatever it can do
// stays exactly as planned. Whatever it cannot is swapped for the closest thing it
// can do: the same movement pattern, for the same muscles, of the same kind
// (compound or isolation) and difficulty, keeping the planned sets, reps and
// rest, so the session trains what it was meant to. When nothing there comes
// close the exercise is left out of today's session, and the client is told.
//
// Plain functions over plain data, run by the server when it hands out the plan
// for a session at a given location.

import type { LibraryExercise, WorkoutDay, Exercise, ExperienceLevel, MuscleGroup } from '../types.js';
import {
  isBookendExercise, selectBookendExercise, selectBookendVideos, buildVideoBookendExercise, selectZone2Exercise, buildZone2Exercise,
  videoMinutesOf,
} from './planGeneration.js';
import { applySubstitution } from './planAdaptation.js';

export interface GymSwapContext {
  /** Every library exercise by id: what each planned exercise needs. */
  library: Map<string, LibraryExercise>;
  /**
   * The library as this client may use it at this location: the location's
   * equipment, their injuries and experience already applied (eligibleExercises).
   */
  pool: LibraryExercise[];
  /** The equipment this location has. */
  availableEquipmentIds: Set<string>;
  /** The location's name, for telling the client why an exercise changed. */
  gymName: string;
  /** Exercises the client has withdrawn for pain: never handed back as a swap. */
  withdrawnIds?: Set<string>;
}

export interface GymChange {
  dayId: string;
  /** The exercise as planned. */
  from: string;
  /** What it became, or absent when it was left out. */
  to?: string;
  /** Where in the session, when it is not one of the lifts. */
  part?: 'warmup' | 'cooldown' | 'zone2';
}

const EXPERIENCE_RANK: Record<ExperienceLevel, number> = { Beginner: 0, Intermediate: 1, Advanced: 2 };

export const GYM_SWAP_SCORING = {
  perSharedPrimaryMuscle: 3,
  perSharedSecondaryMuscle: 1,
  sameCategory: 4,
  sameTargetMuscle: 1,
  /** Per step of difficulty apart (Beginner to Intermediate is one step). */
  perDifficultyStep: -3,
} as const;

/** Whether this location has everything the exercise needs. One that names no equipment needs none. */
export const doableAt = (le: LibraryExercise, available: Set<string>): boolean =>
  (le.requiredEquipmentIds || []).every(id => available.has(id));

const shared = <T,>(a: T[] | undefined, b: T[] | undefined): number => {
  if (!a?.length || !b?.length) return 0;
  const set = new Set(b);
  return a.filter(x => set.has(x)).length;
};

/**
 * The closest exercise to `planned` among `pool`, or null. It must move the same
 * way: the same movement pattern, or for an exercise with none, at least one of
 * the same main muscles. Then the most alike: shared muscles, the same kind of
 * exercise, the same difficulty.
 */
export const selectGymSubstitute = (
  planned: LibraryExercise,
  pool: LibraryExercise[],
  excludedIds: Set<string> = new Set(),
): LibraryExercise | null => {
  const candidates = pool.filter(ex => {
    if (ex.id === planned.id || excludedIds.has(ex.id)) return false;
    if (ex.generationEnabled !== true) return false;
    if ((ex.exerciseType === 'video') !== (planned.exerciseType === 'video')) return false;
    if (planned.movementPattern) return ex.movementPattern === planned.movementPattern;
    return !!ex.movementPattern && shared<MuscleGroup>(ex.primaryMuscles, planned.primaryMuscles) > 0;
  });
  if (candidates.length === 0) return null;
  const rank = (le: LibraryExercise) => EXPERIENCE_RANK[le.minExperience || 'Beginner'] ?? 0;
  const score = (ex: LibraryExercise): number => {
    let s = 0;
    s += shared<MuscleGroup>(ex.primaryMuscles, planned.primaryMuscles) * GYM_SWAP_SCORING.perSharedPrimaryMuscle;
    s += shared<MuscleGroup>(ex.secondaryMuscles, planned.secondaryMuscles) * GYM_SWAP_SCORING.perSharedSecondaryMuscle;
    if (ex.exerciseCategory && ex.exerciseCategory === planned.exerciseCategory) s += GYM_SWAP_SCORING.sameCategory;
    if (ex.targetMuscle && ex.targetMuscle === planned.targetMuscle) s += GYM_SWAP_SCORING.sameTargetMuscle;
    s += Math.abs(rank(ex) - rank(planned)) * GYM_SWAP_SCORING.perDifficultyStep;
    return s;
  };
  return candidates
    .map(ex => ({ ex, s: score(ex) }))
    .sort((a, b) => (b.s - a.s) || a.ex.id.localeCompare(b.ex.id))[0].ex;
};

const swapReason = (gymName: string, from: string, to: string) =>
  `${gymName} doesn't have the equipment for ${from}, so today it's ${to}: the same movement for the same muscles, with the same sets and reps.`;

/**
 * The week as it can be done at this location, and what changed. Days with
 * nothing to change come back as they were.
 */
export const adaptDaysToGym = (days: WorkoutDay[], ctx: GymSwapContext): { days: WorkoutDay[]; changes: GymChange[] } => {
  const changes: GymChange[] = [];
  const pool = ctx.pool.filter(ex => doableAt(ex, ctx.availableEquipmentIds));
  const withdrawn = ctx.withdrawnIds ?? new Set<string>();

  const adapted = days.map(day => {
    const exercises = day.exercises || [];
    const used = new Set(exercises.map(e => e.libraryExerciseId).filter((id): id is string => !!id));
    const muscles = new Set<MuscleGroup>(exercises.flatMap(e => {
      const le = e.libraryExerciseId ? ctx.library.get(e.libraryExerciseId) : undefined;
      return !e.bookend && !e.finisher && le ? le.primaryMuscles || [] : [];
    }));
    let changed = false;
    const out: Exercise[] = [];

    for (const ex of exercises) {
      const le = ex.libraryExerciseId ? ctx.library.get(ex.libraryExerciseId) : undefined;
      // Nothing known about what it needs, or a movement already pulled for pain
      // (which has its own handling): left as it is.
      const pulled = ex.adaptation?.action === 'withdraw' || ex.adaptation?.action === 'refer';
      if (!le || pulled || doableAt(le, ctx.availableEquipmentIds)) { out.push(ex); continue; }

      changed = true;
      const excluded = new Set([...used, ...withdrawn]);
      const available = pool.filter(p => !excluded.has(p.id));
      // The cardio at either end and the zone-2 block may share a machine (the
      // plan had the warm-up and the walk on one treadmill), so what the day
      // already uses is not held against them. Only cardio and exercises meant
      // for the ends of a session, though: never one of the day's lifts.
      const machines = pool.filter(p =>
        !withdrawn.has(p.id) && p.exerciseType !== 'video' && (p.exerciseCategory === 'cardio' || isBookendExercise(p)));
      let replacement: Exercise | null = null;

      if (ex.bookend && le.exerciseType === 'video') {
        const v = selectBookendVideos(ex.bookend, available, videoMinutesOf(le), muscles)[0];
        if (v) replacement = { ...buildVideoBookendExercise(ex.bookend, v, ''), id: ex.id };
      } else if (ex.bookend) {
        const sub = selectBookendExercise(ex.bookend, machines, muscles, { cardioFirst: true });
        if (sub) {
          const note = (ex.bookend === 'warmup' ? sub.warmupNote : sub.cooldownNote)?.trim();
          replacement = {
            ...ex, name: sub.name, libraryExerciseId: sub.id, targetMuscle: sub.targetMuscle || 'Full body',
            equipmentId: sub.equipmentId || 'manual', machineId: undefined, videoUrl: sub.videoUrl,
            notes: note || ex.notes, substitutedFor: { id: le.id, name: ex.name },
          };
        } else {
          // Still warm up and cool down: on whatever is free, by the written steps.
          const block = ex.bookend === 'warmup' ? day.warmup : day.cooldown;
          const { libraryExerciseId: _id, ...rest } = ex;
          replacement = {
            ...rest, name: block?.name || (ex.bookend === 'warmup' ? 'Warm-up' : 'Cooldown'), targetMuscle: 'Full body',
            equipmentId: 'manual', machineId: undefined, videoUrl: undefined,
            notes: block?.steps?.join(' · ') || ex.notes, substitutedFor: { id: le.id, name: ex.name },
          };
        }
      } else if (ex.finisher === 'zone2') {
        const sub = selectZone2Exercise(machines);
        if (sub) {
          replacement = { ...buildZone2Exercise(sub, ex.cardioMinutes || 0, ''), id: ex.id, substitutedFor: { id: le.id, name: ex.name } };
        }
      } else {
        const sub = selectGymSubstitute(le, available, excluded);
        if (sub) {
          replacement = {
            ...applySubstitution(ex, sub),
            adaptation: { action: 'substitute', rule: 'GYM-1', reason: swapReason(ctx.gymName, ex.name, sub.name) },
          };
        }
      }

      const part = ex.bookend ?? (ex.finisher === 'zone2' ? 'zone2' as const : undefined);
      const where = part ? { part } : {};
      if (replacement) {
        if (replacement.libraryExerciseId) used.add(replacement.libraryExerciseId);
        out.push(replacement);
        changes.push({ dayId: day.id, from: ex.name, to: replacement.name, ...where });
      } else {
        changes.push({ dayId: day.id, from: ex.name, ...where });
      }
    }
    return changed ? { ...day, exercises: out } : day;
  });

  return { days: adapted, changes };
};
