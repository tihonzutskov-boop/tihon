import { describe, it, expect } from 'vitest';
import { isMatMachine, findMatPickups, nearestMatPickup, zoneCentre, matPickupMessage } from './matPickup';
import { getZoneEquipmentIds, floorSpaceIsAssumed } from './equipmentMatcher';
import { gymEquipmentIds } from './planGeneration';
import { getExerciseLocations } from './exerciseMatcher';
import { EquipmentType } from '../types';
import type { EquipmentItem, Gym, GymMachine, GymZone, LibraryExercise } from '../types';

const machine = (id: string, name: string, equipmentId?: string, x = 10, y = 10): GymMachine =>
  ({ id, name, equipmentId, x, y, width: 20, height: 20 } as GymMachine);

const zone = (id: string, x: number, machines: GymMachine[] = [], over: Partial<GymZone> = {}): GymZone => ({
  id, name: `Zone ${id}`, type: EquipmentType.MACHINE,
  x, y: 0, width: 100, height: 60, color: '#fff', icon: 'x', machines, equipmentIds: [],
  ...over,
});

const gym = (zones: GymZone[]): Gym => ({
  id: 'g', name: 'G', dimensions: { width: 600, height: 100, x: 0, y: 0 }, zones,
} as Gym);

const item = (id: string, name: string): EquipmentItem => ({ id, name, category: 'Accessories' } as EquipmentItem);

describe('recognising a mat to pick up', () => {
  const none = new Map<string, EquipmentItem>();

  it('recognises a mat by its name', () => {
    expect(isMatMachine(machine('m', 'Fitness Mat'), none)).toBe(true);
    expect(isMatMachine(machine('m', 'Yoga Mats'), none)).toBe(true);
  });

  it('recognises one whose placed name is generic but whose library item is a mat', () => {
    const byId = new Map([['eq-mat', item('eq-mat', 'Exercise Mat')]]);
    expect(isMatMachine(machine('m', 'Rack 3', 'eq-mat'), byId)).toBe(true);
  });

  it('does not mistake the floor space itself for something to pick up', () => {
    expect(isMatMachine(machine('m', 'Open Floor / Mat Area'), none)).toBe(false);
    expect(isMatMachine(machine('m', 'Floor', 'eq-floor-mat'), none)).toBe(false);
    expect(isMatMachine(machine('m', 'Turf Mat Zone'), none)).toBe(false);
  });

  it('does not match words that merely contain the letters', () => {
    expect(isMatMachine(machine('m', 'Matrix Cable Stack'), none)).toBe(false);
    expect(isMatMachine(machine('m', 'Doormat'), none)).toBe(false);
  });
});

describe('finding the nearest mats', () => {
  it('finds every placed mat across the gym', () => {
    const g = gym([
      zone('a', 0, [machine('m1', 'Fitness Mat')]),
      zone('b', 300, [machine('m2', 'Bench'), machine('m3', 'Yoga Mats')]),
    ]);
    expect(findMatPickups(g, []).map(p => p.machine.id)).toEqual(['m1', 'm3']);
  });

  it('chooses the pickup nearest to where the client is going', () => {
    const g = gym([
      zone('near-door', 0, [machine('m1', 'Fitness Mat')]),
      zone('by-floor', 400, [machine('m2', 'Fitness Mat')]),
    ]);
    const destination = zoneCentre(zone('floor', 420));
    expect(nearestMatPickup(g, [], destination)?.machine.id).toBe('m2');
  });

  it('answers null when the gym has no mats placed, rather than inventing a place', () => {
    expect(nearestMatPickup(gym([zone('a', 0, [machine('m', 'Bench')])]), [], { x: 0, y: 0 })).toBeNull();
    expect(nearestMatPickup(null, [], null)).toBeNull();
  });

  it('says so when the mats are in the zone being sent to', () => {
    const p = { zone: zone('f', 0), machine: machine('m', 'Fitness Mat') };
    expect(matPickupMessage(p, 'f')).toBe('Need a mat? Fitness Mat is right here in this zone.');
    expect(matPickupMessage(p, 'other')).toBe('Need a mat? Fitness Mat is in the Zone f.');
  });
});

describe('the floor toggle has the last word', () => {
  const functional = (over: Partial<GymZone> = {}) =>
    zone('func', 0, [], { type: EquipmentType.FUNCTIONAL, ...over });

  it('guesses floor space from the type when nobody has said either way', () => {
    expect(getZoneEquipmentIds(functional())).toContain('eq-floor-mat');
    expect(floorSpaceIsAssumed(functional())).toBe(true);
  });

  it('lets an admin turn it off for a zone the type would have guessed', () => {
    // Before this, switching it off removed the id and the guess put it back.
    const off = functional({ floorSpace: false });
    expect(getZoneEquipmentIds(off)).not.toContain('eq-floor-mat');
    expect(floorSpaceIsAssumed(off)).toBe(false);
  });

  it('lets an admin turn it on for a zone the type would not have guessed', () => {
    expect(getZoneEquipmentIds(zone('racks', 0, [], { floorSpace: true }))).toContain('eq-floor-mat');
  });

  it('does not call an explicit choice a guess', () => {
    expect(floorSpaceIsAssumed(functional({ floorSpace: true }))).toBe(false);
    expect(floorSpaceIsAssumed(zone('x', 0, [], { equipmentIds: ['eq-floor-mat'] }))).toBe(false);
  });

  it('keeps an excluded zone out of what the gym can generate plans for', () => {
    const g = gym([
      zone('studio', 0, [], { equipmentIds: ['eq-floor-mat'], floorSpace: false }),
      zone('func', 200, [], { equipmentIds: ['eq-floor-mat'] }),
    ]);
    expect(gymEquipmentIds(g).has('eq-floor-mat')).toBe(true);
    expect(gymEquipmentIds(gym([zone('studio', 0, [], { equipmentIds: ['eq-floor-mat'], floorSpace: false })])).has('eq-floor-mat')).toBe(false);
  });

  it('stops routing floor exercises into a zone an admin has switched off', () => {
    const floorEx = {
      id: 'e', name: 'Warm up + Mobility', targetMuscle: 'Full body', equipmentRequired: '', category: 'Mobility',
      instructions: '', equipmentId: '', requiredEquipmentIds: ['eq-floor-mat'],
    } as LibraryExercise;
    const g = gym([
      zone('classes', 0, [], { type: EquipmentType.STUDIO, floorSpace: false }),
      zone('func', 200, [], { type: EquipmentType.FUNCTIONAL }),
    ]);
    expect(getExerciseLocations(floorEx, g).equipmentZones.map(z => z.id)).toEqual(['func']);
  });
});
