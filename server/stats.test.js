import { describe, it, expect } from 'vitest';
import { computeStreak, isValidTimeZone, todayIn, timeZoneFromRequest } from './stats.js';

describe('counting a streak', () => {
  it('counts consecutive days back from today', () => {
    expect(computeStreak(['2026-09-20', '2026-09-19', '2026-09-18'], '2026-09-20')).toBe(3);
  });

  it('does not lose the streak just because today has not been trained yet', () => {
    expect(computeStreak(['2026-09-19', '2026-09-18'], '2026-09-20')).toBe(2);
  });

  it('ends at the first gap', () => {
    expect(computeStreak(['2026-09-20', '2026-09-18', '2026-09-17'], '2026-09-20')).toBe(1);
    expect(computeStreak(['2026-09-17'], '2026-09-20')).toBe(0);
  });

  it('is zero with nothing logged', () => {
    expect(computeStreak([], '2026-09-20')).toBe(0);
    expect(computeStreak(null, '2026-09-20')).toBe(0);
  });

  it('counts across month and year boundaries', () => {
    expect(computeStreak(['2026-01-01', '2025-12-31', '2025-12-30'], '2026-01-01')).toBe(3);
    expect(computeStreak(['2026-03-01', '2026-02-28'], '2026-03-01')).toBe(2);
  });

  it('does not let a session dated slightly ahead of today end the count', () => {
    expect(computeStreak(['2026-09-21', '2026-09-20', '2026-09-19'], '2026-09-20')).toBe(2);
  });
});

describe('time zones', () => {
  it('recognises real zones and refuses everything else', () => {
    expect(isValidTimeZone('Europe/Tallinn')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    for (const bad of ['Not/AZone', '', null, undefined, 42, 'x'.repeat(100), "'; DROP TABLE users;--"]) {
      expect(isValidTimeZone(bad), String(bad)).toBe(false);
    }
  });

  it('puts a late-evening UTC moment on the next day in a zone ahead of UTC', () => {
    const moment = new Date('2026-09-20T22:30:00Z');
    expect(todayIn('UTC', moment)).toBe('2026-09-20');
    expect(todayIn('Europe/Tallinn', moment)).toBe('2026-09-21');
    expect(todayIn('America/Los_Angeles', moment)).toBe('2026-09-20');
  });

  it('reads the zone from the request, and falls back to UTC for anything unusable', () => {
    expect(timeZoneFromRequest({ cookies: { gyde_tz: 'Europe/Tallinn' } })).toBe('Europe/Tallinn');
    expect(timeZoneFromRequest({ cookies: { gyde_tz: 'nonsense' } })).toBe('UTC');
    expect(timeZoneFromRequest({ cookies: {} })).toBe('UTC');
    expect(timeZoneFromRequest({})).toBe('UTC');
  });
});
