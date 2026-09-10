import { describe, it, expect } from 'vitest';
import {
  verdictForIllness, verdictForCheckIn, illnessStillRelevant, fatigueSignals,
  cutShortIsFatigueSignal, ILLNESS_LOOKBACK_DAYS,
  type PreSessionCheckIn,
} from './sessionCheckIn';

const checkIn = (over: Partial<PreSessionCheckIn> = {}): PreSessionCheckIn => ({
  phase: 'pre',
  readiness: 4,
  sleep: 'good',
  soreness: 'none',
  illness: 'none',
  ...over,
});

describe('ILLNESS-4 — clearly unwell stops the session', () => {
  it('refuses to train rather than merely reducing', () => {
    const v = verdictForIllness('unwell');
    expect(v.verdict).toBe('rest');
    expect(v.rule).toBe('ILLNESS-4');
  });

  it('prescribes no work at all, so nothing downstream can scale it back up', () => {
    const v = verdictForIllness('unwell');
    expect(v.loadFactor).toBe(0);
    expect(v.volumeFactor).toBe(0);
  });

  it('points at medical advice rather than only at rest', () => {
    expect(verdictForIllness('unwell').detail).toMatch(/doctor/i);
  });
});

describe('ILLNESS-2/3 — reduced sessions', () => {
  it('cuts a mildly symptomatic session harder than a recovered one', () => {
    const mild = verdictForIllness('mild');
    const recovered = verdictForIllness('recovered');
    expect(mild.loadFactor).toBeLessThan(recovered.loadFactor);
    expect(mild.volumeFactor).toBeLessThan(recovered.volumeFactor);
  });

  it('keeps both inside the bands the ruleset gives', () => {
    // ILLNESS-2: 90% load, 70-80% volume. ILLNESS-3: 80-90% load, 50-70% volume.
    const recovered = verdictForIllness('recovered');
    expect(recovered.loadFactor).toBe(0.9);
    expect(recovered.volumeFactor).toBeGreaterThanOrEqual(0.7);
    expect(recovered.volumeFactor).toBeLessThanOrEqual(0.8);

    const mild = verdictForIllness('mild');
    expect(mild.loadFactor).toBeGreaterThanOrEqual(0.8);
    expect(mild.loadFactor).toBeLessThanOrEqual(0.9);
    expect(mild.volumeFactor).toBeGreaterThanOrEqual(0.5);
    expect(mild.volumeFactor).toBeLessThanOrEqual(0.7);
  });

  it('still trains, rather than resting', () => {
    expect(verdictForIllness('mild').verdict).toBe('reduced');
    expect(verdictForIllness('recovered').verdict).toBe('reduced');
  });
});

describe('no illness', () => {
  it('changes nothing about the session', () => {
    const v = verdictForIllness('none');
    expect(v.verdict).toBe('train');
    expect(v.loadFactor).toBe(1);
    expect(v.volumeFactor).toBe(1);
  });

  it('does not let a rough night shrink the session on its own', () => {
    // DELOAD-5: one signal, one time, is never enough to act on.
    const rough = checkIn({ readiness: 1, sleep: 'poor', soreness: 'a_lot' });
    const v = verdictForCheckIn(rough);
    expect(v.verdict).toBe('train');
    expect(v.volumeFactor).toBe(1);
  });

  it('still records what was rough, so persistence can be seen later', () => {
    const rough = checkIn({ readiness: 1, sleep: 'poor', soreness: 'a_lot' });
    expect(fatigueSignals(rough)).toHaveLength(3);
  });
});

describe('ILLNESS-1 — the rolling seven-day window', () => {
  const now = new Date('2026-01-20T12:00:00.000Z');
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

  it('keeps asking through the whole window', () => {
    expect(illnessStillRelevant(daysAgo(0), now)).toBe(true);
    expect(illnessStillRelevant(daysAgo(ILLNESS_LOOKBACK_DAYS), now)).toBe(true);
  });

  it('stops once the window has passed', () => {
    expect(illnessStillRelevant(daysAgo(ILLNESS_LOOKBACK_DAYS + 1), now)).toBe(false);
  });

  it('treats a client who never reported illness as not in the window', () => {
    expect(illnessStillRelevant(null, now)).toBe(false);
    expect(illnessStillRelevant(undefined, now)).toBe(false);
  });

  it('ignores an unparseable date rather than asking forever', () => {
    expect(illnessStillRelevant('not a date', now)).toBe(false);
  });
});

describe('fatigue signals', () => {
  it('finds nothing in a well-rested check-in', () => {
    expect(fatigueSignals(checkIn())).toEqual([]);
  });

  it('does not count middling answers as signals', () => {
    expect(fatigueSignals(checkIn({ readiness: 3, sleep: 'ok', soreness: 'some' }))).toEqual([]);
  });
});

describe('DELOAD-6 — why a session was cut matters', () => {
  it('counts fatigue and pain as fatigue signals', () => {
    expect(cutShortIsFatigueSignal('fatigue')).toBe(true);
    expect(cutShortIsFatigueSignal('pain')).toBe(true);
  });

  it('never counts an external reason, which is the whole point of the rule', () => {
    expect(cutShortIsFatigueSignal('time')).toBe(false);
    expect(cutShortIsFatigueSignal('equipment_busy')).toBe(false);
    expect(cutShortIsFatigueSignal('other')).toBe(false);
  });

  it('treats a session that was never cut short as no signal', () => {
    expect(cutShortIsFatigueSignal(null)).toBe(false);
  });
});
