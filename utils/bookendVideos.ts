// Which follow-along videos the plans use for the stretching at each end of a
// session, and what an admin has to set for a video to be one of them.
//
// A video becomes a warm-up or cool-down in a plan when it is tagged for that
// end, is switched on for automatic generation, and has a category (the
// generator fails closed on a missing one). That is three settings spread over
// the exercise form; this puts them behind one choice per video, and says what
// a video that is not being used is missing.

import type { LibraryExercise, ExerciseCategory } from '../types.js';
import { parseVideoMinutes, videoMinutesOf } from './planGeneration.js';

export type VideoUse = 'none' | 'warmup' | 'cooldown' | 'both';

export const VIDEO_USES: { value: VideoUse; label: string }[] = [
  { value: 'none', label: 'Not used' },
  { value: 'warmup', label: 'Warm-up' },
  { value: 'cooldown', label: 'Cool-down' },
  { value: 'both', label: 'Both' },
];

type Taggable = Pick<LibraryExercise, 'bookendRoles' | 'exerciseCategory'>;

/**
 * What a video is used for now. A video tagged only by its category ('warmup' or
 * 'cooldown', as they were before roles existed) counts, since the generator
 * still reads it that way.
 */
export const videoUseOf = (ex: Taggable): VideoUse => {
  const roles = new Set<string>(ex.bookendRoles || []);
  if (ex.exerciseCategory === 'warmup') roles.add('warmup');
  if (ex.exerciseCategory === 'cooldown') roles.add('cooldown');
  const warm = roles.has('warmup');
  const cool = roles.has('cooldown');
  return warm && cool ? 'both' : warm ? 'warmup' : cool ? 'cooldown' : 'none';
};

const ROLES: Record<VideoUse, ('warmup' | 'cooldown')[]> = {
  none: [], warmup: ['warmup'], cooldown: ['cooldown'], both: ['warmup', 'cooldown'],
};

// The category carries nothing the roles don't, but the generator needs one, and a
// leftover 'warmup' or 'cooldown' would keep tagging the video for an end it has
// just been taken off.
const categoryAfter = (ex: Taggable): ExerciseCategory =>
  !ex.exerciseCategory || ex.exerciseCategory === 'warmup' || ex.exerciseCategory === 'cooldown'
    ? 'mobility'
    : ex.exerciseCategory;

/**
 * The video set up to be used for `use`. Choosing an end also switches it on for
 * generation; choosing "Not used" leaves that switch as it was, since a video can
 * be in plans for another reason (the abs video).
 */
export const withVideoUse = (ex: LibraryExercise, use: VideoUse): LibraryExercise => ({
  ...ex,
  bookendRoles: ROLES[use],
  exerciseCategory: use === 'none' && !ex.exerciseCategory ? undefined : categoryAfter(ex),
  ...(use === 'none' ? {} : { generationEnabled: true }),
});

export interface VideoStatus {
  use: VideoUse;
  /** Will be picked for the plans it is tagged for. */
  ready: boolean;
  minutes: number;
  /** What is stopping a tagged video from being picked. */
  problems: string[];
  /** Worth knowing, but not stopping it. */
  notes: string[];
}

export const videoStatus = (ex: LibraryExercise): VideoStatus => {
  const use = videoUseOf(ex);
  const problems: string[] = [];
  const notes: string[] = [];
  if (use !== 'none') {
    if (ex.generationEnabled !== true) problems.push('Switched off for automatic plans');
    if (!ex.exerciseCategory) problems.push('No category set');
  }
  if (parseVideoMinutes(ex.videoDurationLabel) === null) {
    notes.push(`No length set, so plans count it as ${videoMinutesOf({ videoDurationLabel: '' })} minutes`);
  }
  return { use, ready: use !== 'none' && problems.length === 0, minutes: videoMinutesOf(ex), problems, notes };
};

export interface VideoCoverage {
  warmup: { videos: number; minutes: number };
  cooldown: { videos: number; minutes: number };
}

/** What the library holds that plans can use at each end, counting only the videos that are ready. */
export const videoCoverage = (library: LibraryExercise[]): VideoCoverage => {
  const out: VideoCoverage = { warmup: { videos: 0, minutes: 0 }, cooldown: { videos: 0, minutes: 0 } };
  for (const ex of library) {
    if (ex.exerciseType !== 'video') continue;
    const s = videoStatus(ex);
    if (!s.ready) continue;
    if (s.use === 'warmup' || s.use === 'both') { out.warmup.videos++; out.warmup.minutes += s.minutes; }
    if (s.use === 'cooldown' || s.use === 'both') { out.cooldown.videos++; out.cooldown.minutes += s.minutes; }
  }
  return out;
};
