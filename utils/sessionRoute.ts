// Session routing — which of several identical machines to send someone to.
//
// A gym often has the same equipment in more than one place: three treadmills,
// two cable stacks, a second set of dumbbells upstairs. The matcher already
// finds all of them; until now the session picked one and discarded the rest,
// effectively at random.
//
// Two things follow from choosing deliberately instead:
//
//   1. Walking. Exercise order is set by the program and is not negotiable —
//      compounds come first for a reason — so this never reorders anything. It
//      only chooses which copy of a machine to use, working forward from the
//      entrance and then from wherever the last exercise left the client. Over
//      a four-exercise session in a large gym that is the difference between a
//      route and a scavenger hunt.
//
//   2. Occupancy. The app cannot know what is free. Carrying the alternatives
//      forward rather than dropping them means a client who finds their
//      machine taken can see the others immediately, instead of being left
//      with a single pin and no way forward.

import { Exercise, Gym, GymZone, GymMachine, GymEntrance, GymDimensions } from '../types';
import { getExerciseLocations } from './exerciseMatcher';

export interface RoutePoint { x: number; y: number }

export interface RouteOption {
  zone: GymZone;
  /** Null when the exercise resolved to a zone but no specific machine in it. */
  machine: GymMachine | null;
}

export interface RouteStop {
  /** Exercise.id this stop belongs to. */
  exerciseId: string;
  /** Null when nothing in the gym matched — an unmapped exercise, not an error. */
  zone: GymZone | null;
  machine: GymMachine | null;
  /** Every other place in the gym this same exercise could be done. */
  alternatives: RouteOption[];
}

// Machine coordinates are relative to their zone; zone coordinates are absolute.
export const optionPoint = (option: RouteOption): RoutePoint =>
  option.machine
    ? { x: option.zone.x + option.machine.x, y: option.zone.y + option.machine.y }
    : { x: option.zone.x + option.zone.width / 2, y: option.zone.y + option.zone.height / 2 };

// Squared distance is enough to rank by — the square root would change nothing
// about the ordering and costs a call per comparison.
const distanceSq = (a: RoutePoint, b: RoutePoint): number =>
  (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

// Where the client walks in. The first exercise is chosen relative to this, so
// a session starts at whichever copy is nearest the door rather than whichever
// happened to be listed first.
export const entrancePoint = (
  entrance: GymEntrance | undefined,
  dimensions: GymDimensions | undefined,
): RoutePoint | null => {
  if (!entrance || !dimensions) return null;
  const x = dimensions.x ?? 0;
  const y = dimensions.y ?? 0;
  const along = entrance.offset + entrance.width / 2;
  switch (entrance.side) {
    case 'top': return { x: x + along, y };
    case 'bottom': return { x: x + along, y: y + dimensions.height };
    case 'left': return { x, y: y + along };
    case 'right': return { x: x + dimensions.width, y: y + along };
  }
};

// All the places one exercise could be done. Prefers specific machines, since
// "the third treadmill along" is a more useful instruction than "the cardio
// area"; falls back to whole zones when nothing matched at machine level.
export const routeOptionsFor = (exercise: Exercise, gym: Gym): RouteOption[] => {
  const location = getExerciseLocations(exercise, gym);
  if (location.matchedMachines.length > 0) {
    return location.matchedMachines.map(m => ({ zone: m.zone, machine: m.machine }));
  }
  return location.matchedZones.map(zone => ({ zone, machine: null }));
};

/**
 * Walks the day in the order it will actually be trained, choosing the nearest
 * copy of each exercise's equipment to wherever the client already is.
 *
 * Greedy rather than an optimal tour, deliberately: the visiting order is fixed
 * by the program, so there is no tour to optimise — only a nearest choice at
 * each fixed step. Ties break by zone then machine id so the same gym and the
 * same plan always produce the same route.
 */
export const planSessionRoute = (exercises: Exercise[], gym: Gym | null | undefined): RouteStop[] => {
  if (!gym) return [];
  let position = entrancePoint(gym.entrance, gym.dimensions);

  return exercises.map(exercise => {
    const options = routeOptionsFor(exercise, gym);
    if (options.length === 0) {
      return { exerciseId: exercise.id, zone: null, machine: null, alternatives: [] };
    }

    const ranked = [...options].sort((a, b) => {
      if (position) {
        const byDistance = distanceSq(optionPoint(a), position) - distanceSq(optionPoint(b), position);
        if (byDistance !== 0) return byDistance;
      }
      return a.zone.id.localeCompare(b.zone.id)
        || (a.machine?.id || '').localeCompare(b.machine?.id || '');
    });

    const [chosen, ...alternatives] = ranked;
    // The next exercise is chosen relative to where this one leaves them.
    position = optionPoint(chosen);
    return { exerciseId: exercise.id, zone: chosen.zone, machine: chosen.machine, alternatives };
  });
};
