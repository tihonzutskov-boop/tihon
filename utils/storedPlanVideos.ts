// Library videos in a plan that was stored before there were any to use.
//
// The generator picks follow-along videos for the stretching at each end of a
// session when it builds a plan, and writes the stretching out only when it has
// none. A plan generated before an admin tagged the first video (or before the
// server could see which exercises were videos) keeps the written version, and
// stays that way until it happens to be regenerated. This puts the videos in
// when the plan is read instead, the same way a missing warm-up is added on
// read: the stored plan stays as it was authored, and what the client is shown
// follows what the library holds today.
//
// It makes the same choices the generator would for the same plan: the videos
// that suit the muscles the day trains, ones not used earlier in the week, up to
// the room the session has for them. Plain functions over plain data so that
// can be tested without a database.

import type { LibraryExercise, WorkoutDay, Exercise, MuscleGroup } from '../types.js';
import {
  selectBookendVideos, buildVideoBookendExercise, videoMinutesOf,
} from './planGeneration.js';
import {
  shapeFor, bookendsFor, maxBookendMinutes, regionsOfPatterns, BOOKEND_MINUTES,
} from './sessionShape.js';

export interface StoredPlanVideoContext {
  sessionMinutes: number;
  /**
   * The library as this client may use it — their gym's equipment, their injuries
   * and experience already applied (eligibleExercises). A video outside it is never
   * shown, whatever it is tagged.
   */
  pool: LibraryExercise[];
  /** Every library exercise by id, for what a day's exercises train. */
  library: Map<string, LibraryExercise>;
}

const isVideoEntry = (ex: Exercise, library: Map<string, LibraryExercise>): boolean =>
  !!ex.bookend && (
    /-v\d+$/.test(ex.id) ||
    (!!ex.libraryExerciseId && library.get(ex.libraryExerciseId)?.exerciseType === 'video')
  );

const isLift = (ex: Exercise): boolean => !ex.bookend && !ex.finisher && !ex.isCardio && !!ex.libraryExerciseId;

/**
 * The week with library videos in the stretching at each end of every session
 * that has none. A session already carrying videos at an end is left alone at
 * that end, as is one with no room for stretching (the shortest sessions) or no
 * warm-up or cooldown entry to put them beside. Nothing is changed when the
 * library has no video that fits.
 */
export const withBookendVideos = (days: WorkoutDay[], ctx: StoredPlanVideoContext): WorkoutDay[] => {
  const { library, sessionMinutes } = ctx;
  // Only videos the admin has switched on, whatever else the pool allowed.
  const pool = ctx.pool.filter(ex => ex.generationEnabled === true);
  const shape = shapeFor(sessionMinutes);
  if (shape.band === 'short' || pool.length === 0) return days;

  const minutesFor = BOOKEND_MINUTES[shape.band];
  const allowed = maxBookendMinutes(sessionMinutes);
  const usedWarmup = new Set<string>();
  const usedCooldown = new Set<string>();

  return days.map((day, dayIdx) => {
    const exercises = day.exercises || [];
    const existing = exercises.filter(ex => isVideoEntry(ex, library));
    const hasWarmupVideos = existing.some(ex => ex.bookend === 'warmup');
    const hasCooldownVideos = existing.some(ex => ex.bookend === 'cooldown');
    for (const ex of existing) {
      if (ex.libraryExerciseId) (ex.bookend === 'warmup' ? usedWarmup : usedCooldown).add(ex.libraryExerciseId);
    }

    const lifts = exercises.filter(isLift).map(ex => library.get(ex.libraryExerciseId!)).filter((le): le is LibraryExercise => !!le);
    const muscles = new Set<MuscleGroup>(lifts.flatMap(le => le.primaryMuscles || []));
    const regions = regionsOfPatterns(lifts.map(le => le.movementPattern).filter((p): p is NonNullable<typeof p> => !!p));

    const warmupEntry = hasWarmupVideos ? undefined : exercises.find(ex => ex.bookend === 'warmup');
    const cooldownEntry = hasCooldownVideos ? undefined : exercises.find(ex => ex.bookend === 'cooldown');

    const warmupCardio = Math.min(warmupEntry?.cardioMinutes || minutesFor.cardio, shape.warmupMinutes);
    const warmupVideos = warmupEntry
      ? selectBookendVideos('warmup', pool, shape.warmupMinutes - warmupCardio, muscles, {
          usedEarlierInWeek: usedWarmup,
          maxMinutes: allowed - warmupCardio - shape.cooldownMinutes,
        })
      : [];
    const warmupTotal = warmupVideos.length > 0
      ? warmupCardio + warmupVideos.reduce((sum, v) => sum + videoMinutesOf(v), 0)
      : (day.warmup?.minutes ?? shape.warmupMinutes);

    const cooldownWalk = Math.min(cooldownEntry?.cardioMinutes || minutesFor.walk, shape.cooldownMinutes);
    const cooldownVideos = cooldownEntry
      ? selectBookendVideos('cooldown', pool, shape.cooldownMinutes - cooldownWalk, muscles, {
          usedEarlierInWeek: usedCooldown,
          maxMinutes: allowed - warmupTotal - cooldownWalk,
        })
      : [];
    const cooldownTotal = cooldownVideos.length > 0
      ? cooldownWalk + cooldownVideos.reduce((sum, v) => sum + videoMinutesOf(v), 0)
      : (day.cooldown?.minutes ?? shape.cooldownMinutes);

    warmupVideos.forEach(v => usedWarmup.add(v.id));
    cooldownVideos.forEach(v => usedCooldown.add(v.id));
    if (warmupVideos.length === 0 && cooldownVideos.length === 0) return day;

    const blocks = bookendsFor(shape, regions, {
      warmup: hasWarmupVideos || warmupVideos.length > 0,
      cooldown: hasCooldownVideos || cooldownVideos.length > 0,
    });
    // The written stretching goes, since the video is it; what is not stretching
    // (the light set before the first lift, the breathing) stays.
    const withBlock = <T extends { extra?: string[]; minutes: number }>(
      kept: T | undefined, fresh: T, minutes: number,
    ): T => {
      const { extra: _dropped, ...rest } = { ...(kept ?? fresh) } as T;
      return { ...rest, minutes, ...(fresh.extra ? { extra: fresh.extra } : {}) } as T;
    };

    const out: Exercise[] = [];
    for (const ex of exercises) {
      out.push(ex);
      if (ex === warmupEntry) {
        warmupVideos.forEach((v, i) => out.push(buildVideoBookendExercise('warmup', v, `${dayIdx}-warmup-v${i}`)));
      }
      if (ex === cooldownEntry) {
        cooldownVideos.forEach((v, i) => out.push(buildVideoBookendExercise('cooldown', v, `${dayIdx}-cooldown-v${i}`)));
      }
    }
    return {
      ...day,
      exercises: out,
      warmup: warmupVideos.length > 0 ? withBlock(day.warmup, blocks.warmup, warmupTotal) : day.warmup,
      cooldown: cooldownVideos.length > 0 ? withBlock(day.cooldown, blocks.cooldown, cooldownTotal) : day.cooldown,
    };
  });
};
