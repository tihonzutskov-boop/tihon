// Where a client can pick up a mat.
//
// Open floor and a mat are two different things. The floor is a place — a zone
// that allows floor exercises, tracked by the zone's own setting. A mat is an
// object someone put on the map, in some corner of some zone, and the client
// has to go and get one. Until now the app only knew about the first, so it
// could send someone to a floor but never tell them where the mats were.
//
// Deliberately advisory. Whether an exercise can be done at a gym is decided by
// whether the gym has floor space; a gym with no mat placed loses nothing but
// the hint. Making mats required would strand every floor exercise in any gym
// where nobody had placed one, and mean tagging every exercise with whether it
// truly needs one.

import type { Gym, GymZone, GymMachine, EquipmentItem } from '../types';
import { optionPoint } from './sessionRoute';
import type { RoutePoint } from './sessionRoute';

export interface MatPickup {
  zone: GymZone;
  machine: GymMachine;
}

const FLOOR_SPACE_ID = 'eq-floor-mat';
const MAT_WORD = /\bmats?\b/i;
// Names that use the word "mat" for the place, not the thing.
const SPACE_NAME = /open floor|mat area|floor space|mat zone|turf/i;

/**
 * Whether a placed item is something to pick up, judged by its name.
 *
 * Name-based on purpose, since nothing else marks it: an item is just an item.
 * Kept in this one function so that if a proper flag is ever added to the
 * equipment library, this is the only place that changes.
 */
export const isMatMachine = (machine: GymMachine, equipmentById: Map<string, EquipmentItem>): boolean => {
  // The floor-space item itself: that is the place, not something to carry.
  if (machine.equipmentId === FLOOR_SPACE_ID) return false;
  const item = machine.equipmentId ? equipmentById.get(machine.equipmentId) : undefined;
  const names = [machine.name, item?.name].filter((n): n is string => !!n);
  return names.some(n => MAT_WORD.test(n) && !SPACE_NAME.test(n));
};

export const findMatPickups = (gym: Gym | null | undefined, equipmentList: EquipmentItem[] = []): MatPickup[] => {
  if (!gym) return [];
  const byId = new Map(equipmentList.map(e => [e.id, e]));
  const found: MatPickup[] = [];
  (gym.zones || []).forEach(zone => {
    (zone.machines || []).forEach(machine => {
      if (isMatMachine(machine, byId)) found.push({ zone, machine });
    });
  });
  return found;
};

const distanceSq = (a: RoutePoint, b: RoutePoint): number => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/**
 * The mat pickup nearest to where the client is going, since that is where
 * they will carry it. Ties break by id so the same gym always answers the same.
 */
export const nearestMatPickup = (
  gym: Gym | null | undefined,
  equipmentList: EquipmentItem[],
  near: RoutePoint | null,
): MatPickup | null => {
  const all = findMatPickups(gym, equipmentList);
  if (all.length === 0) return null;
  return [...all].sort((a, b) => {
    if (near) {
      const byDistance = distanceSq(optionPoint(a), near) - distanceSq(optionPoint(b), near);
      if (byDistance !== 0) return byDistance;
    }
    return a.zone.id.localeCompare(b.zone.id) || a.machine.id.localeCompare(b.machine.id);
  })[0];
};

/** The centre of a zone, used as "where the client is going". */
export const zoneCentre = (zone: GymZone): RoutePoint => ({
  x: zone.x + zone.width / 2,
  y: zone.y + zone.height / 2,
});

export const matPickupMessage = (pickup: MatPickup, destinationZoneId?: string | null): string =>
  pickup.zone.id === destinationZoneId
    ? `Need a mat? ${pickup.machine.name} is right here in this zone.`
    : `Need a mat? ${pickup.machine.name} is in the ${pickup.zone.name}.`;
