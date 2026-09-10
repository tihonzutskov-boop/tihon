import { EFFORT_SCALE } from '../types';
import type { EffortRating, JointStressArea, LoggedSet } from '../types';

// One exercise as it was actually performed, plus the display name resolved
// server-side. ExerciseLog itself is the adaptive engine's input contract and
// deliberately carries no display fields, so the name lives here instead.
export interface LoggedExercise {
  id?: number;
  exerciseId: string;
  exerciseName?: string | null;
  planDayId?: string | null;
  weight?: number | null;
  weightUnit?: 'kg' | 'lb';
  sets: LoggedSet[];
  effort?: EffortRating | null;
  pain?: boolean;
  painArea?: JointStressArea | null;
  painNote?: string | null;
  loggedAt?: string;
}

/**
 * A movement pulled from the plan. This is the half of the history the log
 * cannot show on its own: once a movement is withdrawn the client stops
 * logging it, so in the log a withdrawn exercise looks exactly like one they
 * skipped. 'pain' retries once after its window; 'referred' never does.
 */
export interface WithdrawalRecord {
  exerciseId: string;
  exerciseName?: string | null;
  reason: string;
  painArea?: JointStressArea | null;
  withdrawnAt: string;
  retryAfter: string | null;
  resolvedAt: string | null;
}

/** A check-in as it comes back from the server, either phase. */
export interface CheckInRecord {
  id: number;
  planDayId?: string | null;
  phase: 'pre' | 'post';
  readiness?: number | null;
  sleep?: string | null;
  soreness?: string | null;
  illness?: string | null;
  verdict?: string | null;
  effort?: string | null;
  completedFully?: boolean | null;
  cutShortReason?: string | null;
  note?: string | null;
  recordedAt: string;
}

export interface ClientHistory {
  client: { userId: number; name: string; email: string };
  dayNames: Record<string, string>;
  logs: LoggedExercise[];
  checkIns: CheckInRecord[];
  withdrawals: WithdrawalRecord[];
}

/**
 * Attaches each check-in to the session it belongs to.
 *
 * A check-in carries no session id — the session it brackets does not exist
 * yet when the pre-session one is written. They are matched by proximity in
 * time instead, which is exactly what they are: the pre-session check-in is
 * the nearest one before the session's log, the post-session one the nearest
 * after. A check-in from a session that was abandoned before anything was
 * logged matches nothing, and is dropped rather than attached to whichever
 * session happened to be nearest.
 */
export const MAX_CHECKIN_GAP_MS = 4 * 60 * 60 * 1000;

export const attachCheckIns = (
  sessions: HistorySession[],
  checkIns: CheckInRecord[]
): Map<string, { pre?: CheckInRecord; post?: CheckInRecord }> => {
  const attached = new Map<string, { pre?: CheckInRecord; post?: CheckInRecord }>();
  for (const session of sessions) {
    const at = new Date(session.loggedAt).getTime();
    const near = (phase: 'pre' | 'post') => {
      let best: CheckInRecord | undefined;
      let bestGap = MAX_CHECKIN_GAP_MS;
      for (const c of checkIns) {
        if (c.phase !== phase) continue;
        const t = new Date(c.recordedAt).getTime();
        // A pre-session check-in precedes its session; a post-session one follows.
        const gap = phase === 'pre' ? at - t : t - at;
        if (gap >= 0 && gap <= bestGap) { best = c; bestGap = gap; }
      }
      return best;
    };
    const pre = near('pre');
    const post = near('post');
    if (pre || post) attached.set(session.sessionId, { pre, post });
  }
  return attached;
};

export interface HistorySession {
  // The shared timestamp doubles as the session's identity — see groupIntoSessions.
  sessionId: string;
  loggedAt: string;
  planDayId: string | null;
  dayName: string | null;
  exercises: LoggedExercise[];
  totalSets: number;
  totalReps: number;
  // Kilograms moved. Bodyweight work contributes nothing here, which is why
  // this is reported alongside set and rep counts rather than instead of them.
  tonnageKg: number;
  // Sets that met or beat what the plan asked for. Compared against the
  // target carried on the set itself, not against today's prescription,
  // which may since have been adapted.
  setsAtTarget: number;
  painFlags: number;
}

export interface HistorySummary {
  sessions: number;
  sessionsThisWeek: number;
  totalSets: number;
  tonnageKg: number;
  painFlags: number;
  firstLoggedAt: string | null;
  lastLoggedAt: string | null;
  // Consecutive calendar weeks with at least one session, counting back from
  // the current week. A missed week ends it.
  weekStreak: number;
}

const LB_TO_KG = 0.45359237;

/** Monday 00:00 of the week containing `d`. */
export const startOfWeek = (d: Date): Date => {
  const monday = new Date(d);
  monday.setHours(0, 0, 0, 0);
  // getDay() is Sunday-first; the app treats weeks as Monday-first everywhere.
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
};

const toKg = (weight: number, unit: 'kg' | 'lb' | undefined): number =>
  unit === 'lb' ? weight * LB_TO_KG : weight;

/**
 * Splits a flat log into sessions.
 *
 * The grouping key is logged_at, which is exact rather than approximate: a
 * session is written as one transaction (POST /api/exercise-logs), and
 * Postgres' now() returns the transaction start time for every statement in
 * it — so every exercise from one session carries a byte-identical timestamp,
 * and two different sessions cannot collide on one. This is the same property
 * the clients query already relies on to count sessions.
 *
 * Returns newest first.
 */
export const groupIntoSessions = (
  logs: LoggedExercise[],
  dayNameById: Record<string, string> = {}
): HistorySession[] => {
  const byTimestamp = new Map<string, LoggedExercise[]>();
  for (const log of logs) {
    if (!log.loggedAt) continue;
    const key = new Date(log.loggedAt).toISOString();
    const bucket = byTimestamp.get(key);
    if (bucket) bucket.push(log);
    else byTimestamp.set(key, [log]);
  }

  const sessions: HistorySession[] = [];
  for (const [sessionId, exercises] of byTimestamp) {
    let totalSets = 0;
    let totalReps = 0;
    let tonnageKg = 0;
    let setsAtTarget = 0;
    let painFlags = 0;

    for (const ex of exercises) {
      const sets = ex.sets || [];
      totalSets += sets.length;
      for (const set of sets) {
        totalReps += set.reps || 0;
        if (set.targetReps > 0 && set.reps >= set.targetReps) setsAtTarget += 1;
        if (ex.weight != null) tonnageKg += toKg(ex.weight, ex.weightUnit) * (set.reps || 0);
      }
      if (ex.pain) painFlags += 1;
    }

    // Every exercise in a session shares the day, so the first one that
    // recorded it speaks for the session.
    const planDayId = exercises.find(e => e.planDayId)?.planDayId ?? null;

    sessions.push({
      sessionId,
      loggedAt: sessionId,
      planDayId,
      dayName: planDayId ? dayNameById[planDayId] ?? null : null,
      exercises,
      totalSets,
      totalReps,
      tonnageKg: Math.round(tonnageKg),
      setsAtTarget,
      painFlags,
    });
  }

  return sessions.sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
};

/** Roll-up across every session. Expects the newest-first order above. */
export const summarize = (sessions: HistorySession[], now: Date = new Date()): HistorySummary => {
  const weekStart = startOfWeek(now).getTime();
  const summary: HistorySummary = {
    sessions: sessions.length,
    sessionsThisWeek: 0,
    totalSets: 0,
    tonnageKg: 0,
    painFlags: 0,
    firstLoggedAt: sessions.length ? sessions[sessions.length - 1].loggedAt : null,
    lastLoggedAt: sessions.length ? sessions[0].loggedAt : null,
    weekStreak: 0,
  };

  const trainedWeeks = new Set<number>();
  for (const s of sessions) {
    const at = new Date(s.loggedAt).getTime();
    if (at >= weekStart) summary.sessionsThisWeek += 1;
    summary.totalSets += s.totalSets;
    summary.tonnageKg += s.tonnageKg;
    summary.painFlags += s.painFlags;
    trainedWeeks.add(startOfWeek(new Date(s.loggedAt)).getTime());
  }

  // The current week only breaks the streak once it is over, so an untrained
  // Monday morning doesn't wipe out the weeks behind it.
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  let cursor = trainedWeeks.has(weekStart) ? weekStart : weekStart - WEEK_MS;
  while (trainedWeeks.has(cursor)) {
    summary.weekStreak += 1;
    cursor -= WEEK_MS;
  }

  return summary;
};

/** Every exercise trained, newest session first, for the per-movement view. */
export const historyForExercise = (
  sessions: HistorySession[],
  exerciseId: string
): { session: HistorySession; exercise: LoggedExercise }[] =>
  sessions.flatMap(session =>
    session.exercises.filter(e => e.exerciseId === exerciseId).map(exercise => ({ session, exercise }))
  );

/** Distinct exercises in the log, most-trained first, for the filter list. */
export const exercisesInHistory = (
  sessions: HistorySession[]
): { exerciseId: string; name: string; sessions: number }[] => {
  const seen = new Map<string, { exerciseId: string; name: string; sessions: number }>();
  for (const session of sessions) {
    for (const ex of session.exercises) {
      const existing = seen.get(ex.exerciseId);
      if (existing) {
        existing.sessions += 1;
        if (!existing.name && ex.exerciseName) existing.name = ex.exerciseName;
      } else {
        seen.set(ex.exerciseId, {
          exerciseId: ex.exerciseId,
          name: ex.exerciseName || ex.exerciseId,
          sessions: 1,
        });
      }
    }
  }
  return [...seen.values()].sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
};

/** The heaviest single set, as the one number that reads as progress. */
export const bestSetKg = (entries: { exercise: LoggedExercise }[]): number | null => {
  let best: number | null = null;
  for (const { exercise } of entries) {
    if (exercise.weight == null) continue;
    const kg = toKg(exercise.weight, exercise.weightUnit);
    if (best == null || kg > best) best = kg;
  }
  return best;
};

export const effortLabel = (effort: EffortRating | null | undefined): string | null =>
  effort == null ? null : EFFORT_SCALE.find(e => e.value === effort)?.label ?? null;

/** "3×8, 3×7" — repeated set/rep pairs collapsed, in performed order. */
export const formatSets = (sets: LoggedSet[]): string => {
  if (!sets || sets.length === 0) return '—';
  const runs: { reps: number; count: number }[] = [];
  for (const set of sets) {
    const last = runs[runs.length - 1];
    if (last && last.reps === set.reps) last.count += 1;
    else runs.push({ reps: set.reps, count: 1 });
  }
  return runs.map(r => (r.count > 1 ? `${r.count}×${r.reps}` : `${r.reps}`)).join(', ');
};

export const formatWeight = (weight: number | null | undefined, unit: 'kg' | 'lb' | undefined): string =>
  weight == null ? 'Bodyweight' : `${weight} ${unit || 'kg'}`;

/**
 * Kilograms, kept exact enough to be recognisable. Rounding a 72.5 kg best set
 * to 73 reports a weight the client never lifted and cannot put on a bar.
 */
export const formatKg = (kg: number): string =>
  `${Number.isInteger(kg) ? kg : Math.round(kg * 10) / 10} kg`;

/**
 * Total load moved. Tonnes only once there are enough of them to mean
 * anything — a client three sessions in has lifted 7,010 kg, and "7 t" throws
 * away most of what that number was telling them.
 */
export const formatTonnage = (kg: number): string => {
  if (kg <= 0) return '—';
  if (kg < 10_000) return `${Math.round(kg).toLocaleString()} kg`;
  return `${(kg / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} t`;
};
