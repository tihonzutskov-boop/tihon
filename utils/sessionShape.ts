// Session shaping — how long someone has changes what kind of session they get,
// not just how much gets trimmed off the end.
//
// The old behaviour treated the stated session length purely as a ceiling: a
// day was built the same way for everyone, then optional work was dropped until
// it fit. That made a 90-minute answer produce the same session as a 60-minute
// one, since nothing ever needed dropping.
//
// The rule this module encodes instead: extra time buys *quality*, not volume.
// A longer session gets a fuller warm-up, ramp-up sets before the working sets,
// and rest at the top of the prescribed range rather than the bottom. Working
// sets rise only modestly and stay under the same weekly ceiling, because the
// beginner limits in the rulebook are about recovery, not about how long
// someone happens to be free.

export type SessionTier = 'short' | 'medium' | 'long';

export interface SessionShape {
  tier: SessionTier;
  warmupMinutes: number;
  cooldownMinutes: number;
  /** Multiplies the slot's prescribed rest. Time available buys longer rest. */
  restMultiplier: number;
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

// Thresholds sit between the questionnaire's offered values ('30 min'..'90 min')
// rather than on them, so an answer never lands ambiguously on a boundary.
export const TIER_BOUNDS = { shortBelow: 45, longAbove: 70 };

const SHAPES: Record<SessionTier, Omit<SessionShape, 'tier'>> = {
  // Efficient and focused: the mandatory compounds, enough rest to perform them
  // properly, and nothing else competing for the time.
  short: {
    warmupMinutes: 6,
    cooldownMinutes: 4,
    restMultiplier: 1.0,
    warmupSetsPerCompound: 0,
    includeAccessories: false,
    maxWorkingSets: 12,
  },
  // The full session as the rulebook describes it.
  medium: {
    warmupMinutes: 9,
    cooldownMinutes: 5,
    restMultiplier: 1.15,
    warmupSetsPerCompound: 1,
    includeAccessories: true,
    maxWorkingSets: 16,
  },
  // The extra time goes into preparation, ramp-up sets and full rest — the
  // things that make the same work better rather than making it bigger.
  long: {
    warmupMinutes: 12,
    cooldownMinutes: 8,
    restMultiplier: 1.35,
    warmupSetsPerCompound: 2,
    includeAccessories: true,
    maxWorkingSets: 20,
  },
};

export const tierFor = (sessionMinutes: number): SessionTier => {
  if (sessionMinutes < TIER_BOUNDS.shortBelow) return 'short';
  if (sessionMinutes > TIER_BOUNDS.longAbove) return 'long';
  return 'medium';
};

// Warm-up and cooldown are guaranteed, but they must not eat the session. On an
// unusually short slot the bookends scale down together rather than one of them
// being dropped — a brief warm-up is still a warm-up, whereas no warm-up is a
// beginner training cold.
const MAX_BOOKEND_SHARE = 0.35;

export const shapeFor = (sessionMinutes: number): SessionShape => {
  const tier = tierFor(sessionMinutes);
  const base = SHAPES[tier];
  const bookends = base.warmupMinutes + base.cooldownMinutes;
  const allowed = sessionMinutes * MAX_BOOKEND_SHARE;

  if (bookends <= allowed) return { tier, ...base };

  const scale = allowed / bookends;
  return {
    tier,
    ...base,
    warmupMinutes: Math.max(1, Math.round(base.warmupMinutes * scale)),
    cooldownMinutes: Math.max(1, Math.round(base.cooldownMinutes * scale)),
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
}

const WARMUPS: Record<SessionTier, string[]> = {
  short: [
    '2 minutes easy cardio — walk, bike or row, just enough to feel warmer',
    'Roll the shoulders, hips and ankles through their range a few times each',
    'One light set of your first exercise, using an empty bar or the lightest setting',
  ],
  medium: [
    '4 minutes easy cardio, building from very easy to slightly breathing harder',
    'Move each joint you are about to load through its full range: shoulders, hips, knees, ankles',
    'Leg swings and arm circles, around 10 each direction',
    'One light set of your first exercise, well short of the working weight',
  ],
  long: [
    '5 minutes easy cardio, building gradually — you should feel warm, not tired',
    'Full joint circles: ankles, knees, hips, spine, shoulders, elbows, wrists',
    'Leg swings, arm circles and torso rotations, around 10 each direction',
    'Bodyweight practice of today\'s main movements — the squat and hinge patterns unloaded',
    'Light ramp-up sets on your first exercise, adding a little each time',
  ],
};

const COOLDOWNS: Record<SessionTier, string[]> = {
  short: [
    '2 minutes easy walking until your breathing settles',
    'Stretch whatever worked hardest today, around 30 seconds each side',
  ],
  medium: [
    '3 minutes easy walking or cycling until your breathing settles',
    'Stretch the muscles you trained, 30 seconds each, without forcing the position',
    'A slow, controlled breath for a minute or two before you leave',
  ],
  long: [
    '4 minutes easy walking or cycling, letting your heart rate come down gradually',
    'Stretch every muscle group you trained, 30–45 seconds each, no bouncing',
    'Hips and upper back specifically — they take the most from a long session',
    'A couple of minutes of slow breathing to finish',
  ],
};

export const bookendsFor = (shape: SessionShape): { warmup: SessionBookend; cooldown: SessionBookend } => ({
  warmup: {
    kind: 'warmup',
    name: 'Warm-up',
    minutes: shape.warmupMinutes,
    steps: WARMUPS[shape.tier],
  },
  cooldown: {
    kind: 'cooldown',
    name: 'Cooldown',
    minutes: shape.cooldownMinutes,
    steps: COOLDOWNS[shape.tier],
  },
});

// Minutes left for actual training once the bookends are reserved. They are
// taken off the top rather than fitted around the work, so a session can never
// be built that leaves no room to warm up.
export const trainingMinutesAvailable = (sessionMinutes: number, shape: SessionShape): number =>
  Math.max(0, sessionMinutes - shape.warmupMinutes - shape.cooldownMinutes);
