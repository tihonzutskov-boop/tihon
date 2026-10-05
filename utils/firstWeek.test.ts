import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { isFirstWeek, FIRST_WEEK_REMINDER } from './firstWeek';

describe('the first week of a plan', () => {
  it('is the first seven days: no whole weeks trained yet', () => {
    expect(isFirstWeek(0)).toBe(true);
  });

  it('is over from the second week on', () => {
    for (const weeks of [1, 2, 11, 12, 40]) expect(isFirstWeek(weeks), String(weeks)).toBe(false);
  });

  it('shows nothing when the server could not say how old the plan is', () => {
    expect(isFirstWeek(null)).toBe(false);
    expect(isFirstWeek(undefined)).toBe(false);
  });

  it('does not take a negative or odd number for the first week', () => {
    for (const weeks of [-1, 0.5, NaN]) expect(isFirstWeek(weeks), String(weeks)).toBe(false);
  });
});

describe('the first-week reminder', () => {
  it('has a title and three short points', () => {
    expect(FIRST_WEEK_REMINDER.title).toBe('Your first week');
    expect(FIRST_WEEK_REMINDER.points).toHaveLength(3);
    FIRST_WEEK_REMINDER.points.forEach(p => expect(p.trim().length).toBeGreaterThan(20));
  });

  it('is a reminder, not a lesson: a few seconds to read', () => {
    const words = FIRST_WEEK_REMINDER.points.join(' ').split(/\s+/).length;
    expect(words).toBeLessThan(60);
    FIRST_WEEK_REMINDER.points.forEach(p => expect(p.split(/\s+/).length, p).toBeLessThan(22));
  });

  it('names the check-in option the app actually offers', () => {
    // The reminder tells someone to choose "Something hurt"; if the check-in is
    // ever reworded the reminder has to follow it.
    const checkIn = readFileSync(new URL('../components/SessionCheckIn.tsx', import.meta.url), 'utf8');
    expect(checkIn).toContain("'Something hurt'");
    expect(FIRST_WEEK_REMINDER.points.join(' ')).toContain('"Something hurt"');
  });
});
