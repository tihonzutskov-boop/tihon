import { describe, it, expect } from 'vitest';
import { calendarDaysAgo, describeCompleted } from './whenDone';

// Local-time constructors, since "today" and "yesterday" are the viewer's own.
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

describe('counting calendar days', () => {
  it('is zero on the same date', () => {
    expect(calendarDaysAgo(at(2026, 9, 20, 0, 5), at(2026, 9, 20, 23, 55))).toBe(0);
  });

  it('is one across midnight, even a few minutes apart', () => {
    expect(calendarDaysAgo(at(2026, 9, 20, 23, 50), at(2026, 9, 21, 0, 10))).toBe(1);
  });

  it('counts whole dates over a month boundary', () => {
    expect(calendarDaysAgo(at(2026, 8, 30), at(2026, 9, 2))).toBe(3);
  });

  it('is not thrown by a clock change', () => {
    // Europe's clocks go back on the last Sunday of October: that day has 25 hours.
    expect(calendarDaysAgo(at(2026, 10, 25, 1), at(2026, 10, 26, 1))).toBe(1);
  });
});

describe('saying when a session was completed', () => {
  const now = at(2026, 9, 20, 22, 45);
  const iso = (d: Date) => d.toISOString();

  it('says today, with the time', () => {
    const when = describeCompleted(iso(at(2026, 9, 20, 18, 5)), now)!;
    expect(when.day).toBe('Today');
    expect(when.time).toMatch(/\d{1,2}[:.]05/);
    expect(when.full).toBe(`Today, ${when.time}`);
  });

  it('says yesterday', () => {
    expect(describeCompleted(iso(at(2026, 9, 19, 9, 30)), now)!.day).toBe('Yesterday');
  });

  it('names the date for anything older, without saying today or yesterday', () => {
    const when = describeCompleted(iso(at(2026, 9, 14, 7, 0)), now)!;
    expect(when.day).not.toMatch(/today|yesterday/i);
    expect(when.day).toMatch(/14/);
    expect(when.full).toBe(`${when.day}, ${when.time}`);
  });

  it('calls a completion slightly in the future today, since it is a clock difference', () => {
    expect(describeCompleted(iso(at(2026, 9, 20, 22, 50)), now)!.day).toBe('Today');
  });

  it('has nothing to say when there is no time, or a bad one', () => {
    expect(describeCompleted(null, now)).toBeNull();
    expect(describeCompleted(undefined, now)).toBeNull();
    expect(describeCompleted('not a date', now)).toBeNull();
  });
});
