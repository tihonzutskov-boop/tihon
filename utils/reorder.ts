// The arithmetic behind dragging a row in a ranked list. Kept apart from the
// component so the part that is easy to get subtly wrong (which slot a drag
// lands in, and where every other row sits while it is in flight) can be
// tested without a pointer.

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

/** A copy of the list with the item at `from` moved to `to`. */
export const moveItem = <T>(list: T[], from: number, to: number): T[] => {
  if (from < 0 || from >= list.length) return list;
  const target = clamp(to, 0, list.length - 1);
  if (target === from) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
};

/**
 * The slot a row dragged `offsetY` pixels from where it started would drop
 * into. `step` is the distance from one row to the next, gap included.
 */
export const dragTargetIndex = (from: number, offsetY: number, step: number, count: number): number =>
  step > 0 ? clamp(Math.round(from + offsetY / step), 0, count - 1) : from;

/**
 * Where the row currently at `index` sits once the dragged row (`from`) is
 * dropped in `over`. Everything between the two slots shifts one place toward
 * the gap the dragged row left.
 */
export const projectedIndex = (index: number, from: number, over: number): number => {
  if (index === from) return over;
  if (from < over && index > from && index <= over) return index - 1;
  if (from > over && index >= over && index < from) return index + 1;
  return index;
};
