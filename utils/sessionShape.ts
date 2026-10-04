// Session shaping — how long someone has changes what kind of session they get,
// not just how much gets trimmed off the end.
//
// The old behaviour treated the stated session length purely as a ceiling: a
// day was built the same way for everyone, then optional work was dropped until
// it fit. That made a 90-minute answer produce the same session as a 60-minute
// one, since nothing ever needed dropping.
//
// The rule this module encodes instead: extra time buys *quality*, not volume.
// A longer session gets a fuller warm-up and ramp-up sets before the working
// sets; rest stays what the client's goal prescribes, whatever the length. Working
// sets rise only modestly and stay under the same weekly ceiling, because the
// beginner limits in the rulebook are about recovery, not about how long
// someone happens to be free.

export type SessionTier = 'short' | 'medium' | 'long';

/**
 * How a session's warm-up and cooldown are sized, which follows the length
 * more finely than the tier does: 45 and 60 minutes are one tier but not one
 * warm-up. 'short' only exists for answers saved when 30 minutes was offered.
 */
export type BookendBand = 'short' | 'base' | 'mid' | 'long';

export interface SessionShape {
  tier: SessionTier;
  band: BookendBand;
  warmupMinutes: number;
  cooldownMinutes: number;
  /** Ramp-up sets before the first working set of a compound. Almost no fatigue cost. */
  warmupSetsPerCompound: number;
  /** Whether optional accessory work is built in at all, rather than added then trimmed. */
  includeAccessories: boolean;
  /**
   * Hard ceiling on working sets in one session. Deliberately not proportional
   * to time: tripling the session length does not triple what a beginner can
   * recover from.
   */
  maxWorkingSets: number;
}

// Thresholds sit between the questionnaire's offered values ('45 min'..'75 min')
// rather than on them, so an answer never lands ambiguously on a boundary. The
// short tier is no longer reachable from the questionnaire, which starts at 45
// minutes, but answers saved when it offered 30 still build plans with it.
export const TIER_BOUNDS = { shortBelow: 45, longAbove: 70 };

const SHAPES: Record<SessionTier, Omit<SessionShape, 'tier' | 'band' | 'warmupMinutes' | 'cooldownMinutes'>> = {
  // Efficient and focused: the mandatory compounds and nothing else competing
  // for the time.
  short: {
    warmupSetsPerCompound: 0,
    includeAccessories: false,
    maxWorkingSets: 12,
  },
  // The full session as the rulebook describes it.
  medium: {
    warmupSetsPerCompound: 1,
    includeAccessories: true,
    maxWorkingSets: 16,
  },
  // The extra time goes into preparation and ramp-up sets — the things that
  // make the same work better rather than making it bigger.
  long: {
    warmupSetsPerCompound: 2,
    includeAccessories: true,
    maxWorkingSets: 20,
  },
};

// A longer session spends its extra time on the warm-up and cooldown, not on
// more sets. The warm-up is always 10 minutes of easy cardio; at 60 minutes
// dynamic stretching follows it (4 minutes), at 75 five minutes of activation:
// mobility drills, core activation and light band work. The cooldown is an easy
// walk and then stretching, growing the same way.
export const BOOKEND_MINUTES: Record<BookendBand, { warmup: number; cooldown: number; cardio: number; walk: number }> = {
  short: { warmup: 6, cooldown: 4, cardio: 2, walk: 2 },
  base: { warmup: 10, cooldown: 5, cardio: 10, walk: 2 },
  mid: { warmup: 14, cooldown: 10, cardio: 10, walk: 3 },
  long: { warmup: 15, cooldown: 12, cardio: 10, walk: 3 },
};

export const bookendBandFor = (sessionMinutes: number): BookendBand =>
  sessionMinutes < TIER_BOUNDS.shortBelow ? 'short'
    : sessionMinutes <= TIER_BOUNDS.shortBelow ? 'base'
    : sessionMinutes > TIER_BOUNDS.longAbove ? 'long'
    : 'mid';

export const tierFor = (sessionMinutes: number): SessionTier => {
  if (sessionMinutes < TIER_BOUNDS.shortBelow) return 'short';
  if (sessionMinutes > TIER_BOUNDS.longAbove) return 'long';
  return 'medium';
};

// Minutes of zone-2 cardio a session can end with: 10 up to and including 45
// minutes, 15 up to 70, 20 beyond. Sized to the session the way the warm-up is,
// so a longer one carries more of it. The questionnaire offers 45, 60 and 75,
// which read as 10, 15 and 20; the boundaries sit where the tiers do.
export const zone2MinutesFor = (sessionMinutes: number): number =>
  sessionMinutes <= TIER_BOUNDS.shortBelow ? 10 : sessionMinutes > TIER_BOUNDS.longAbove ? 20 : 15;

// Warm-up and cooldown are guaranteed, but they must not eat the session. On an
// unusually short slot the bookends scale down together rather than one of them
// being dropped — a brief warm-up is still a warm-up, whereas no warm-up is a
// beginner training cold.
const MAX_BOOKEND_SHARE = 0.45;

/** The most a session's warm-up and cooldown can take between them, in minutes. */
export const maxBookendMinutes = (sessionMinutes: number): number => Math.floor(sessionMinutes * MAX_BOOKEND_SHARE);

export const shapeFor = (sessionMinutes: number): SessionShape => {
  const tier = tierFor(sessionMinutes);
  const band = bookendBandFor(sessionMinutes);
  const base = { ...SHAPES[tier], tier, band };
  const minutes = BOOKEND_MINUTES[band];
  const bookends = minutes.warmup + minutes.cooldown;
  const allowed = sessionMinutes * MAX_BOOKEND_SHARE;

  if (bookends <= allowed) return { ...base, warmupMinutes: minutes.warmup, cooldownMinutes: minutes.cooldown };

  const scale = allowed / bookends;
  return {
    ...base,
    warmupMinutes: Math.max(1, Math.round(minutes.warmup * scale)),
    cooldownMinutes: Math.max(1, Math.round(minutes.cooldown * scale)),
  };
};

// ---------------------------------------------------------------------------
// Warm-up and cooldown
// ---------------------------------------------------------------------------
//
// Always emitted, never optional, and never dependent on the exercise library
// containing something tagged 'mobility'. A library gap should cost a better
// warm-up, not the warm-up itself — training cold is a beginner injury risk,
// and it is the part most likely to be skipped when left to chance.

export interface SessionBookend {
  kind: 'warmup' | 'cooldown';
  name: string;
  minutes: number;
  /** What to actually do, written for someone who has not done this before. */
  steps: string[];
  /**
   * What follows the steps, for a warm-up or cooldown with more in it than one
   * machine: the dynamic stretching, the stretches, matched to the muscles the
   * day trains. Kept apart from `steps` because an exercise's own note replaces
   * the steps but not this. A line ending in a colon introduces the ones after it.
   */
  extra?: string[];
}

/** The parts of the body a day trains, which decide what its warm-up and stretches are. */
export type BodyRegion = 'legs' | 'push' | 'pull' | 'core';

const REGION_ORDER: BodyRegion[] = ['legs', 'push', 'pull', 'core'];

const REGION_OF_PATTERN: Record<string, BodyRegion> = {
  squat: 'legs', hinge: 'legs', lunge: 'legs', knee_extension: 'legs', knee_flexion: 'legs',
  hip_extension: 'legs', hip_abduction: 'legs', hip_adduction: 'legs', calf_raise: 'legs',
  horizontal_push: 'push', vertical_push: 'push', shoulder_abduction: 'push', elbow_extension: 'push',
  horizontal_adduction: 'push',
  horizontal_pull: 'pull', vertical_pull: 'pull', elbow_flexion: 'pull',
  core: 'core', carry: 'core',
};

/** The regions a day trains, from the movements in it, in a fixed order. */
export const regionsOfPatterns = (patterns: string[]): BodyRegion[] => {
  const found = new Set(patterns.map(p => REGION_OF_PATTERN[p]).filter(Boolean));
  return REGION_ORDER.filter(r => found.has(r));
};

const DYNAMIC_MOVES: Record<BodyRegion, string[]> = {
  legs: [
    'Leg swings, front to back and side to side, 10 each leg',
    'Bodyweight squats, 10 slow reps',
    'Walking lunges with a gentle twist, 8 each side',
    'Glute bridges, 10 reps, pausing at the top',
    'Ankle circles and 10 slow calf raises',
  ],
  push: [
    'Arm circles, 10 forward and 10 back',
    'Hug yourself, then open the arms wide, 10 reps',
    'Wall or incline push-ups, 8 slow reps',
    'Shoulder rolls, 10 each direction',
  ],
  pull: [
    'Cat-cow, 8 slow reps',
    'Squeeze the shoulder blades together and release, 10 reps',
    'Torso rotations, 8 each side',
    'Hip hinges with a flat back, hands sliding down the thighs, 10 reps',
  ],
  core: [
    'Dead bugs, 8 each side',
    'Bird dogs, 8 each side',
  ],
};

const STRETCHES: Record<BodyRegion, string[]> = {
  legs: [
    'Standing quad stretch',
    'Hamstring stretch, seated or standing',
    'Kneeling hip flexor stretch',
    'Figure-four glute stretch',
    'Calf stretch against a wall',
    'Butterfly stretch for the inner thighs',
  ],
  push: [
    'Doorway chest stretch',
    'Cross-body shoulder stretch',
    'Overhead triceps stretch',
    'Wrist and forearm stretch',
  ],
  pull: [
    "Child's pose",
    'Reach forward as if hugging a tree, for the upper back',
    'Biceps stretch with the palm flat on a wall',
    'Seated spinal twist',
  ],
  core: [
    'Cobra, or a gentle back extension',
    'Side-bend stretch, reaching overhead',
  ],
};

// Taken a region at a time in turn, so a day that trains legs, push and pull
// gets some of each before any one of them gets a second.
const pick = (table: Record<BodyRegion, string[]>, regions: BodyRegion[], count: number): string[] => {
  const picked: string[] = [];
  const lists = regions.map(r => table[r]);
  for (let round = 0; picked.length < count; round++) {
    const before = picked.length;
    for (const list of lists) {
      if (picked.length < count && round < list.length) picked.push(list[round]);
    }
    if (picked.length === before) break;
  }
  return picked;
};

// A day with nothing identifiable in it (an empty library) is warmed up and
// stretched for the whole body rather than for nothing.
const WHOLE_BODY: BodyRegion[] = ['legs', 'push', 'pull'];

const DYNAMIC_COUNT: Partial<Record<BookendBand, number>> = { mid: 4 };

// The long warm-up is activation rather than stretching: a couple of mobility
// drills for what the day trains, the core, and light work with a band.
const CORE_ACTIVATION = ['Dead bugs, 8 each side', 'Bird dogs, 8 each side'];
const BAND_MOVES: Record<BodyRegion, string[]> = {
  legs: ['Banded glute bridges, 10 reps', 'Banded lateral steps, 8 each way'],
  push: ['Band external rotations, 10 each arm'],
  pull: ['Band pull-aparts, 10 reps'],
  core: [],
};
const STRETCH_COUNT: Partial<Record<BookendBand, number>> = { base: 3, mid: 6, long: 7 };
const STRETCH_HOLD: Partial<Record<BookendBand, string>> = {
  base: '20–30 seconds', mid: '30 seconds', long: '30 seconds',
};

// `byVideo`: the dynamic stretching or the stretches are done as follow-along
// videos from the library, which are their own exercises in the day, so only
// what has no video is written out here.
const warmupExtra = (band: BookendBand, regions: BodyRegion[], byVideo: boolean): string[] => {
  const today = regions.length > 0 ? regions : WHOLE_BODY;
  const count = byVideo ? 0 : DYNAMIC_COUNT[band] ?? 0;
  const lines: string[] = [];
  if (band === 'long' && !byVideo) {
    lines.push(`Activation, about ${BOOKEND_MINUTES.long.warmup - BOOKEND_MINUTES.long.cardio} minutes: mobility drills, core activation and light band work:`);
    lines.push(...pick(DYNAMIC_MOVES, today, 2), ...CORE_ACTIVATION, ...pick(BAND_MOVES, today, 2));
  }
  if (count > 0) {
    lines.push(`Dynamic stretching, about ${BOOKEND_MINUTES[band].warmup - BOOKEND_MINUTES[band].cardio} minutes, for what you train today:`);
    lines.push(...pick(DYNAMIC_MOVES, today, count));
  }
  lines.push(band === 'long'
    ? 'Light ramp-up sets on your first exercise, adding a little each time'
    : 'One light set of your first exercise, well short of the working weight');
  return lines;
};

const cooldownExtra = (band: BookendBand, regions: BodyRegion[], byVideo: boolean): string[] => {
  const today = regions.length > 0 ? regions : WHOLE_BODY;
  const count = byVideo ? 0 : STRETCH_COUNT[band] ?? 0;
  const lines: string[] = [];
  if (count > 0) {
    lines.push(`Stretch what you trained, holding each ${STRETCH_HOLD[band]} a side, no bouncing:`);
    lines.push(...pick(STRETCHES, today, count));
  }
  if (band === 'mid') lines.push('Finish with a minute of slow breathing: in for four, out for six');
  if (band === 'long') lines.push('Finish with two minutes of slow breathing: in for four, out for six');
  return lines;
};

// What the warm-up and cooldown are built around: ten minutes of easy cardio,
// and an easy walk. The rest of each is `extra`, which grows with the session.
const WARMUPS: Record<BookendBand, string[]> = {
  short: [
    '2 minutes easy cardio — walk, bike or row, just enough to feel warmer',
    'Roll the shoulders, hips and ankles through their range a few times each',
    'One light set of your first exercise, using an empty bar or the lightest setting',
  ],
  base: ['10 minutes easy cardio on the bike, treadmill or rower, building from very easy to slightly breathing harder'],
  mid: ['10 minutes easy cardio on the bike, treadmill or rower, building from very easy to slightly breathing harder'],
  long: ['10 minutes easy cardio on the bike, treadmill or rower, building gradually — you should feel warm, not tired'],
};

const COOLDOWNS: Record<BookendBand, string[]> = {
  short: [
    '2 minutes easy walking until your breathing settles',
    'Stretch whatever worked hardest today, around 30 seconds each side',
  ],
  base: ['2 minutes easy walking until your breathing settles'],
  mid: ['3 minutes easy walking or cycling until your breathing settles'],
  long: ['3 minutes easy walking or cycling, letting your heart rate come down gradually'],
};

/**
 * The day's warm-up and cooldown. `regions` is what the day trains (see
 * regionsOfPatterns): the dynamic stretching and the stretches that follow the
 * cardio and the walk are for those parts of the body. `byVideo` says which of
 * the two has its stretching done as videos, and so does not need it written.
 */
export const bookendsFor = (
  shape: SessionShape,
  regions: BodyRegion[] = [],
  byVideo: { warmup?: boolean; cooldown?: boolean } = {},
): { warmup: SessionBookend; cooldown: SessionBookend } => {
  const warmupLines = shape.band === 'short' ? [] : warmupExtra(shape.band, regions, !!byVideo.warmup);
  const cooldownLines = shape.band === 'short' ? [] : cooldownExtra(shape.band, regions, !!byVideo.cooldown);
  return {
    warmup: {
      kind: 'warmup',
      name: 'Warm-up',
      minutes: shape.warmupMinutes,
      steps: WARMUPS[shape.band],
      ...(warmupLines.length > 0 ? { extra: warmupLines } : {}),
    },
    cooldown: {
      kind: 'cooldown',
      name: 'Cooldown',
      minutes: shape.cooldownMinutes,
      steps: COOLDOWNS[shape.band],
      ...(cooldownLines.length > 0 ? { extra: cooldownLines } : {}),
    },
  };
};

// Minutes left for actual training once the bookends are reserved. They are
// taken off the top rather than fitted around the work, so a session can never
// be built that leaves no room to warm up.
export const trainingMinutesAvailable = (sessionMinutes: number, shape: SessionShape): number =>
  Math.max(0, sessionMinutes - shape.warmupMinutes - shape.cooldownMinutes);
