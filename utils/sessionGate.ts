// What a client has to have recorded before they can leave an exercise.
//
// Two things: that they did the sets, and how hard it felt. The weight is not
// one of them. A client who ticks their sets without typing a weight has still
// done the exercise, and holding them on the screen until they invent a number
// stops the session for something the plan can do without: the weight only
// feeds the next suggested weight, and a log with none simply gets no
// suggestion, while the reps and the effort still drive progression.

export const missingBeforeNext = (rows: { done: boolean }[], effortRated: boolean): string[] => {
  const missing: string[] = [];
  if (!(rows.length > 0 && rows.every(r => r.done))) missing.push('tick every set you finished');
  if (!effortRated) missing.push('rate how hard it was');
  return missing;
};
