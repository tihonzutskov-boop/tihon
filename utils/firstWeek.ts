// The reminder a client sees just before their exercises begin, in the first
// week of their plan.
//
// The first week is when a beginner is least sure what is being asked of them,
// and what the plan does with it: the first session sets the working weights
// (LOAD-1), so how they treat it matters more than in any later week. It is a
// reminder, so it is short, and it is the one place the wording lives.

/**
 * Whether a plan is in its first week. `weeksTrained` is whole weeks since the
 * plan was first created (it does not restart when the plan is regenerated);
 * null means the server could not say, which shows nothing rather than guess.
 */
export const isFirstWeek = (weeksTrained: number | null | undefined): boolean =>
  typeof weeksTrained === 'number' && weeksTrained === 0;

export const FIRST_WEEK_REMINDER = {
  title: 'Your first week',
  points: [
    'Start light: choose a weight that lets you finish each set with two or three reps still left.',
    'Log the weight you used and how hard it felt. The plan uses it to set your next weight.',
    'If something hurts, stop, and choose "Something hurt" in the check-in afterwards.',
  ],
};
