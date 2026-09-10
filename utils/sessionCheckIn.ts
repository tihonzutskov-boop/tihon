/**
 * Pre- and post-session check-ins.
 *
 * Every other rule in the engine derives from the training log passively —
 * load, stalls, volume, breaks. Two things cannot be derived that way, and so
 * have to be asked:
 *
 *   1. Recovery state. ILLNESS-1 requires recovery status *before* a workout is
 *      generated. No amount of log history says whether someone is ill today.
 *   2. Why a session was short. The log shows three exercises instead of five;
 *      it cannot say whether that was fatigue, a busy rack, or a meeting.
 *      DELOAD-6 turns on exactly that distinction — an external reason must not
 *      trigger a deload.
 *
 * Everything else stays derived. In particular this never asks how long the
 * break was (readable from logged_at), what was lifted (logged), or how hard an
 * exercise felt (already captured per exercise inside the session).
 */

/** How recovered the client says they are, when they report recent illness. */
export type IllnessState = 'none' | 'recovered' | 'mild' | 'unwell';

export type SleepQuality = 'poor' | 'ok' | 'good';
export type Soreness = 'none' | 'some' | 'a_lot';

/**
 * Overall session effort. Deliberately its own coarse scale rather than the
 * 1-10 RPE the per-exercise rescale is heading for: session effort and set
 * effort are different constructs, and giving them the same numbers would
 * invite them to be compared as if they were the same measurement.
 */
export type SessionEffort = 'easy' | 'moderate' | 'hard' | 'very_hard' | 'maximal';

export type CutShortReason = 'time' | 'fatigue' | 'pain' | 'equipment_busy' | 'other';

export interface PreSessionCheckIn {
  phase: 'pre';
  planDayId?: string | null;
  /** 1 (drained) to 5 (fresh). */
  readiness: number;
  sleep: SleepQuality;
  soreness: Soreness;
  illness: IllnessState;
  note?: string | null;
}

export interface PostSessionCheckIn {
  phase: 'post';
  planDayId?: string | null;
  effort: SessionEffort;
  completedFully: boolean;
  cutShortReason?: CutShortReason | null;
  note?: string | null;
}

export type SessionCheckIn = PreSessionCheckIn | PostSessionCheckIn;

// --- ILLNESS-1..4 ----------------------------------------------------------

export type TrainingVerdict = 'train' | 'reduced' | 'rest';

export interface ReadinessVerdict {
  verdict: TrainingVerdict;
  /** Fraction of normal working load, per ILLNESS-2/3. 1 = unchanged. */
  loadFactor: number;
  /** Fraction of normal working volume, per ILLNESS-2/3. */
  volumeFactor: number;
  /** Shown to the client. Says what is happening and why. */
  headline: string;
  detail: string;
  /** Which rule produced this, so a coach can trace it. */
  rule: string;
}

const NORMAL: ReadinessVerdict = {
  verdict: 'train',
  loadFactor: 1,
  volumeFactor: 1,
  headline: 'Good to train',
  detail: 'Nothing in your check-in changes today’s session.',
  rule: '—',
};

/**
 * ILLNESS-2/3/4. Reported illness scales the session down, or stops it.
 *
 * The ranges in the ruleset are given as bands (90% load, 70–80% volume). The
 * bottom of each volume band is used rather than the middle: these are recovery
 * sessions, and the cost of being too conservative for one session is far lower
 * than the cost of being too aggressive.
 */
export const verdictForIllness = (illness: IllnessState): ReadinessVerdict => {
  switch (illness) {
    case 'unwell':
      return {
        verdict: 'rest',
        loadFactor: 0,
        volumeFactor: 0,
        headline: 'Rest today',
        detail:
          'Training while you are still unwell sets recovery back further than the session gains. ' +
          'Come back when symptoms have settled — and see a doctor if they have not.',
        rule: 'ILLNESS-4',
      };
    case 'mild':
      return {
        verdict: 'reduced',
        loadFactor: 0.8,
        volumeFactor: 0.5,
        headline: 'Lighter session today',
        detail:
          'Still recovering, so this is a reduced session: lighter weights and roughly half the ' +
          'usual work. It should feel comfortably short of hard — stop there even if you could do more.',
        rule: 'ILLNESS-3',
      };
    case 'recovered':
      return {
        verdict: 'reduced',
        loadFactor: 0.9,
        volumeFactor: 0.7,
        headline: 'Easing back in',
        detail:
          'Normal session shape, held slightly back on weight and volume for your first sessions ' +
          'after being ill. Full training returns once two sessions feel normal.',
        rule: 'ILLNESS-2',
      };
    case 'none':
    default:
      return NORMAL;
  }
};

/** How long a reported illness keeps affecting sessions. ILLNESS-1. */
export const ILLNESS_LOOKBACK_DAYS = 7;

/**
 * Whether a client should still be asked about recovery, based on their most
 * recent reported illness. ILLNESS-1's rolling window.
 */
export const illnessStillRelevant = (
  lastIllnessReportedAt: string | null | undefined,
  now: Date = new Date()
): boolean => {
  if (!lastIllnessReportedAt) return false;
  const reported = new Date(lastIllnessReportedAt).getTime();
  if (Number.isNaN(reported)) return false;
  const elapsedDays = (now.getTime() - reported) / (24 * 60 * 60 * 1000);
  return elapsedDays >= 0 && elapsedDays <= ILLNESS_LOOKBACK_DAYS;
};

/**
 * The verdict for one pre-session check-in.
 *
 * Only illness gates a session. Low readiness, poor sleep and soreness are
 * recorded as fatigue signals but deliberately do not scale today's work on
 * their own: DELOAD-5 requires persistence or concurrence before acting, so a
 * single rough night is not evidence of anything and must not quietly shrink a
 * session the client can perfectly well do.
 */
export const verdictForCheckIn = (checkIn: PreSessionCheckIn): ReadinessVerdict =>
  verdictForIllness(checkIn.illness);

/**
 * DELOAD-5's fatigue signals present in one check-in. Counted, not acted on
 * here — a deload needs one signal sustained across sessions, or several at
 * once, which only a run of check-ins can establish.
 */
export const fatigueSignals = (checkIn: PreSessionCheckIn): string[] => {
  const signals: string[] = [];
  if (checkIn.readiness <= 2) signals.push('low readiness');
  if (checkIn.sleep === 'poor') signals.push('poor sleep');
  if (checkIn.soreness === 'a_lot') signals.push('heavy soreness');
  return signals;
};

/**
 * Whether a short session counts as a fatigue signal. DELOAD-6: a session cut
 * for an external reason is not evidence of fatigue and must never contribute
 * to a deload trigger.
 */
export const cutShortIsFatigueSignal = (reason: CutShortReason | null | undefined): boolean =>
  reason === 'fatigue' || reason === 'pain';
