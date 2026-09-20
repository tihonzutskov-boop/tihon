// A plan is a set of sessions to do each week, in whatever order and on
// whatever days suit the client — not a calendar. These helpers answer the two
// questions the dashboard asks of it: is there a plan at all, and which
// sessions are done this week.

/**
 * Whether the days hold a real plan. The app's placeholder plan is one empty
 * day, and days used to carry a weekday that was the only thing telling the
 * two apart; exercises are what a generated plan always has and a placeholder
 * never does.
 */
export const hasGeneratedPlan = (days: { exercises: unknown[] }[] | null | undefined): boolean =>
  !!days && days.some(d => d.exercises.length > 0);

/** Monday 00:00 (local) of the week `now` falls in. */
export const startOfWeek = (now: Date): Date => {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
};

export type SessionStatus = 'done' | 'next' | 'todo';

export interface SessionSlot<D> {
  day: D;
  dayIndex: number;
  status: SessionStatus;
}

/**
 * Every session of the plan with where it stands this week. "Next" is the
 * first one not yet done, in plan order; once all are done there is none.
 */
export const weeklySessions = <D extends { id: string }>(days: D[], doneIds: ReadonlySet<string>): SessionSlot<D>[] => {
  const nextIndex = days.findIndex(d => !doneIds.has(d.id));
  return days.map((day, dayIndex) => ({
    day,
    dayIndex,
    status: doneIds.has(day.id) ? 'done' : dayIndex === nextIndex ? 'next' : 'todo',
  }));
};
