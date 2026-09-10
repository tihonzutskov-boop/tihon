import { describe, it, expect } from 'vitest';
import {
  groupIntoSessions,
  summarize,
  exercisesInHistory,
  historyForExercise,
  bestSetKg,
  formatSets,
  formatKg,
  formatTonnage,
  startOfWeek,
  attachCheckIns,
  type LoggedExercise,
  type CheckInRecord,
} from './workoutHistory';

const log = (over: Partial<LoggedExercise> & { loggedAt: string }): LoggedExercise => ({
  exerciseId: 'squat',
  exerciseName: 'Back Squat',
  weight: 60,
  weightUnit: 'kg',
  sets: [{ reps: 8, targetReps: 8 }, { reps: 8, targetReps: 8 }],
  ...over,
});

describe('groupIntoSessions', () => {
  it('groups by the shared transaction timestamp, newest first', () => {
    const sessions = groupIntoSessions([
      log({ loggedAt: '2026-01-05T10:00:00.000Z', exerciseId: 'squat' }),
      log({ loggedAt: '2026-01-05T10:00:00.000Z', exerciseId: 'bench' }),
      log({ loggedAt: '2026-01-08T10:00:00.000Z', exerciseId: 'squat' }),
    ]);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].loggedAt).toBe('2026-01-08T10:00:00.000Z');
    expect(sessions[1].exercises.map(e => e.exerciseId)).toEqual(['squat', 'bench']);
  });

  it('normalises equivalent timestamp spellings into one session', () => {
    // pg may hand back an offset form; the same instant must not split in two.
    const sessions = groupIntoSessions([
      log({ loggedAt: '2026-01-05T10:00:00.000Z' }),
      log({ loggedAt: '2026-01-05T12:00:00.000+02:00', exerciseId: 'bench' }),
    ]);
    expect(sessions).toHaveLength(1);
  });

  it('drops rows with no timestamp rather than inventing a session', () => {
    expect(groupIntoSessions([{ exerciseId: 'squat', sets: [] }])).toEqual([]);
  });

  it('totals sets, reps and tonnage, and counts sets that met target', () => {
    const [session] = groupIntoSessions([
      log({
        loggedAt: '2026-01-05T10:00:00.000Z',
        weight: 100,
        sets: [{ reps: 5, targetReps: 5 }, { reps: 3, targetReps: 5 }],
      }),
    ]);
    expect(session.totalSets).toBe(2);
    expect(session.totalReps).toBe(8);
    expect(session.tonnageKg).toBe(800);
    expect(session.setsAtTarget).toBe(1);
  });

  it('counts bodyweight work in sets and reps but not in tonnage', () => {
    const [session] = groupIntoSessions([
      log({ loggedAt: '2026-01-05T10:00:00.000Z', weight: null, sets: [{ reps: 10, targetReps: 10 }] }),
    ]);
    expect(session.totalReps).toBe(10);
    expect(session.tonnageKg).toBe(0);
  });

  it('converts pounds to kilograms so a mixed-unit history still totals', () => {
    const [session] = groupIntoSessions([
      log({ loggedAt: '2026-01-05T10:00:00.000Z', weight: 100, weightUnit: 'lb', sets: [{ reps: 1, targetReps: 1 }] }),
    ]);
    expect(session.tonnageKg).toBe(45);
  });

  it('resolves the day name from the plan, and tolerates a day since removed', () => {
    const logs = [
      log({ loggedAt: '2026-01-05T10:00:00.000Z', planDayId: 'day-1' }),
      log({ loggedAt: '2026-01-06T10:00:00.000Z', planDayId: 'deleted-day' }),
    ];
    const sessions = groupIntoSessions(logs, { 'day-1': 'Upper Body' });
    expect(sessions.find(s => s.planDayId === 'day-1')!.dayName).toBe('Upper Body');
    expect(sessions.find(s => s.planDayId === 'deleted-day')!.dayName).toBeNull();
  });

  it('counts one pain flag per exercise that hurt', () => {
    const [session] = groupIntoSessions([
      log({ loggedAt: '2026-01-05T10:00:00.000Z', exerciseId: 'squat', pain: true }),
      log({ loggedAt: '2026-01-05T10:00:00.000Z', exerciseId: 'bench', pain: false }),
    ]);
    expect(session.painFlags).toBe(1);
  });
});

describe('summarize', () => {
  const at = (iso: string) => groupIntoSessions([log({ loggedAt: iso })]);

  it('reports nothing rather than zeroes-as-facts for an empty log', () => {
    const s = summarize([]);
    expect(s.sessions).toBe(0);
    expect(s.firstLoggedAt).toBeNull();
    expect(s.lastLoggedAt).toBeNull();
    expect(s.weekStreak).toBe(0);
  });

  it('bookends the log by first and last session', () => {
    const sessions = groupIntoSessions([
      log({ loggedAt: '2026-01-05T10:00:00.000Z' }),
      log({ loggedAt: '2026-01-20T10:00:00.000Z' }),
    ]);
    const s = summarize(sessions, new Date('2026-01-21T10:00:00.000Z'));
    expect(s.firstLoggedAt).toBe('2026-01-05T10:00:00.000Z');
    expect(s.lastLoggedAt).toBe('2026-01-20T10:00:00.000Z');
  });

  it('counts only sessions inside the current Monday-start week', () => {
    // 2026-01-21 is a Wednesday; that week starts Monday the 19th.
    const sessions = groupIntoSessions([
      log({ loggedAt: '2026-01-20T10:00:00.000Z' }),
      log({ loggedAt: '2026-01-18T10:00:00.000Z' }),
    ]);
    expect(summarize(sessions, new Date('2026-01-21T10:00:00.000Z')).sessionsThisWeek).toBe(1);
  });

  it('counts consecutive trained weeks, and stops at a missed one', () => {
    const sessions = groupIntoSessions([
      log({ loggedAt: '2026-01-20T10:00:00.000Z' }), // this week
      log({ loggedAt: '2026-01-13T10:00:00.000Z' }), // last week
      // week of the 5th skipped
      log({ loggedAt: '2025-12-30T10:00:00.000Z' }),
    ]);
    expect(summarize(sessions, new Date('2026-01-21T10:00:00.000Z')).weekStreak).toBe(2);
  });

  it('does not break the streak just because this week has not started yet', () => {
    const sessions = groupIntoSessions([log({ loggedAt: '2026-01-14T10:00:00.000Z' })]);
    // Monday the 19th, nothing logged yet this week.
    expect(summarize(sessions, new Date('2026-01-19T08:00:00.000Z')).weekStreak).toBe(1);
  });
});

describe('startOfWeek', () => {
  it('treats Sunday as the end of its week, not the start of the next', () => {
    const sunday = new Date('2026-01-18T23:00:00');
    expect(startOfWeek(sunday).getDate()).toBe(12);
  });
});

describe('per-exercise views', () => {
  const sessions = groupIntoSessions([
    log({ loggedAt: '2026-01-05T10:00:00.000Z', exerciseId: 'squat', weight: 60 }),
    log({ loggedAt: '2026-01-05T10:00:00.000Z', exerciseId: 'bench', exerciseName: 'Bench Press' }),
    log({ loggedAt: '2026-01-12T10:00:00.000Z', exerciseId: 'squat', weight: 70 }),
  ]);

  it('lists exercises most-trained first', () => {
    expect(exercisesInHistory(sessions).map(e => [e.name, e.sessions])).toEqual([
      ['Back Squat', 2],
      ['Bench Press', 1],
    ]);
  });

  it('falls back to the id when an exercise has since left the library', () => {
    const orphaned = groupIntoSessions([
      log({ loggedAt: '2026-01-05T10:00:00.000Z', exerciseId: 'gone', exerciseName: null }),
    ]);
    expect(exercisesInHistory(orphaned)[0].name).toBe('gone');
  });

  it('returns one movement across sessions, newest first', () => {
    const entries = historyForExercise(sessions, 'squat');
    expect(entries).toHaveLength(2);
    expect(entries[0].exercise.weight).toBe(70);
  });

  it('reports the heaviest set, ignoring bodyweight entries', () => {
    expect(bestSetKg(historyForExercise(sessions, 'squat'))).toBe(70);
    expect(bestSetKg([{ exercise: log({ loggedAt: 'x', weight: null }) }])).toBeNull();
  });
});

describe('formatSets', () => {
  it('collapses repeated reps and keeps the order performed', () => {
    expect(formatSets([
      { reps: 8, targetReps: 8 },
      { reps: 8, targetReps: 8 },
      { reps: 6, targetReps: 8 },
    ])).toBe('2×8, 6');
  });

  it('says nothing was recorded rather than showing an empty string', () => {
    expect(formatSets([])).toBe('—');
  });
});

describe('number formatting', () => {
  it('keeps a half-kilo best set recognisable rather than rounding it away', () => {
    expect(formatKg(72.5)).toBe('72.5 kg');
    expect(formatKg(70)).toBe('70 kg');
    // lb-sourced weights convert to long decimals; one place is enough.
    expect(formatKg(45.359237)).toBe('45.4 kg');
  });

  it('reports tonnage in kilograms until tonnes actually say more', () => {
    expect(formatTonnage(7010)).toBe('7,010 kg');
    expect(formatTonnage(24500)).toBe('24.5 t');
    expect(formatTonnage(0)).toBe('—');
  });
});

describe('attachCheckIns', () => {
  const sessionAt = '2026-01-20T18:00:00.000Z';
  const sessions = groupIntoSessions([log({ loggedAt: sessionAt })]);
  const checkIn = (over: Partial<CheckInRecord> & { phase: 'pre' | 'post'; recordedAt: string }): CheckInRecord =>
    ({ id: 1, ...over });

  it('matches the check-ins bracketing a session', () => {
    const attached = attachCheckIns(sessions, [
      checkIn({ id: 1, phase: 'pre', recordedAt: '2026-01-20T17:40:00.000Z' }),
      checkIn({ id: 2, phase: 'post', recordedAt: '2026-01-20T18:50:00.000Z' }),
    ]);
    const found = attached.get(sessions[0].sessionId)!;
    expect(found.pre?.id).toBe(1);
    expect(found.post?.id).toBe(2);
  });

  it('never attaches a pre-session check-in recorded after the session', () => {
    const attached = attachCheckIns(sessions, [
      checkIn({ id: 1, phase: 'pre', recordedAt: '2026-01-20T19:00:00.000Z' }),
    ]);
    expect(attached.has(sessions[0].sessionId)).toBe(false);
  });

  it('drops a check-in from a session that was abandoned before anything was logged', () => {
    // Two days earlier: someone checked in, saw the rest verdict, and left.
    const attached = attachCheckIns(sessions, [
      checkIn({ id: 9, phase: 'pre', recordedAt: '2026-01-18T17:00:00.000Z', illness: 'unwell' }),
    ]);
    expect(attached.has(sessions[0].sessionId)).toBe(false);
  });

  it('picks the nearest check-in when a client has trained repeatedly', () => {
    const attached = attachCheckIns(sessions, [
      checkIn({ id: 1, phase: 'pre', recordedAt: '2026-01-20T15:30:00.000Z' }),
      checkIn({ id: 2, phase: 'pre', recordedAt: '2026-01-20T17:50:00.000Z' }),
    ]);
    expect(attached.get(sessions[0].sessionId)!.pre?.id).toBe(2);
  });

  it('returns nothing for a session with no check-ins at all', () => {
    // Every session logged before this feature existed.
    expect(attachCheckIns(sessions, []).size).toBe(0);
  });
});
