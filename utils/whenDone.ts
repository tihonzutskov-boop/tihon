// How a completion time is shown to the client: "Today, 22:41", "Yesterday,
// 18:05", or "Sun 20 Sep, 09:30". The time itself comes from the server when a
// session is finished, so the client never types a date; this only decides how
// to say it.

const dayNumber = (d: Date): number => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * How many calendar days before `now` the moment `then` falls, in the
 * viewer's own time. Counted on dates rather than on 24-hour spans, so a
 * session at 23:50 is "yesterday" at 00:10 and a clock change cannot skew it.
 */
export const calendarDaysAgo = (then: Date, now: Date): number =>
  Math.round((dayNumber(now) - dayNumber(then)) / 86_400_000);

export interface CompletedWhen {
  /** "Today", "Yesterday", or "Sun 20 Sep". */
  day: string;
  /** "22:41" in the viewer's own format. */
  time: string;
  /** "Today, 22:41". */
  full: string;
}

export const describeCompleted = (iso: string | null | undefined, now: Date = new Date()): CompletedWhen | null => {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const ago = calendarDaysAgo(then, now);
  // A completion a moment "in the future" is a device clock running behind
  // the server's, not a session that has not happened — call it today.
  const day = ago <= 0
    ? 'Today'
    : ago === 1
      ? 'Yesterday'
      : then.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const time = then.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return { day, time, full: `${day}, ${time}` };
};
