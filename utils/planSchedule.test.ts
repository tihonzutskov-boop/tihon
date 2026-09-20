import { describe, it, expect } from 'vitest';
import { hasGeneratedPlan, startOfWeek, weeklySessions } from './planSchedule';

const day = (id: string, exercises = 1) => ({ id, exercises: Array.from({ length: exercises }, () => ({})) });

describe('telling a plan from the placeholder', () => {
  it('is not a plan when the only day is empty', () => {
    expect(hasGeneratedPlan([day('day-1', 0)])).toBe(false);
  });

  it('is not a plan when there are no days', () => {
    expect(hasGeneratedPlan([])).toBe(false);
    expect(hasGeneratedPlan(null)).toBe(false);
  });

  it('is a plan as soon as any day has exercises, with or without a weekday', () => {
    expect(hasGeneratedPlan([day('a')])).toBe(true);
    expect(hasGeneratedPlan([day('a', 0), day('b', 3)])).toBe(true);
  });
});

describe('the start of the week', () => {
  const at = (iso: string) => startOfWeek(new Date(iso));

  it('is the Monday before, at midnight', () => {
    // 2026-09-23 is a Wednesday.
    const start = at('2026-09-23T15:30:00');
    expect(start.getDay()).toBe(1);
    expect([start.getFullYear(), start.getMonth(), start.getDate()]).toEqual([2026, 8, 21]);
    expect([start.getHours(), start.getMinutes()]).toEqual([0, 0]);
  });

  it('is the same day on a Monday', () => {
    expect(at('2026-09-21T09:00:00').getDate()).toBe(21);
  });

  it('is six days back on a Sunday, since the week starts on Monday', () => {
    expect(at('2026-09-27T20:00:00').getDate()).toBe(21);
  });
});

describe('where each session stands this week', () => {
  const days = [day('a'), day('b'), day('c')];
  const statuses = (done: string[]) => weeklySessions(days, new Set(done)).map(s => s.status);

  it('makes the first session next when nothing is done', () => {
    expect(statuses([])).toEqual(['next', 'todo', 'todo']);
  });

  it('moves on to the next one not yet done', () => {
    expect(statuses(['a'])).toEqual(['done', 'next', 'todo']);
  });

  it('does not care what order they were done in', () => {
    expect(statuses(['b'])).toEqual(['next', 'done', 'todo']);
    expect(statuses(['a', 'c'])).toEqual(['done', 'next', 'done']);
  });

  it('has no next session once they are all done', () => {
    expect(statuses(['a', 'b', 'c'])).toEqual(['done', 'done', 'done']);
  });

  it('keeps each session\'s place in the plan, so starting it opens the right one', () => {
    expect(weeklySessions(days, new Set()).map(s => s.dayIndex)).toEqual([0, 1, 2]);
  });
});
