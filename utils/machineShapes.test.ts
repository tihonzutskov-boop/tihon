import { describe, it, expect } from 'vitest';
import { machineShapeOf } from './machineShapes';

const named = (name: string) => machineShapeOf({ name });

describe('machineShapeOf', () => {
  it('knows cardio machines by name', () => {
    expect(named('Treadmill 1')).toBe('treadmill');
    expect(named('Commercial Running Treadmill')).toBe('treadmill');
    expect(named('Rower A')).toBe('rower');
    expect(named('Concept2')).toBe('rower');
    expect(named('Rowing Machine')).toBe('rower');
    expect(named('Spin Bike')).toBe('bike');
    expect(named('Upright Cycle')).toBe('bike');
    expect(named('Assault Bike')).toBe('bike');
    expect(named('Elliptical')).toBe('elliptical');
    expect(named('Cross Trainer 2')).toBe('elliptical');
    expect(named('Stair Climber')).toBe('stairs');
    expect(named('StepMill')).toBe('stairs');
  });

  it('knows racks, benches and dumbbells by name', () => {
    expect(named('Power Rack 3')).toBe('rack');
    expect(named('Squat Rack')).toBe('rack');
    expect(named('Half rack')).toBe('rack');
    expect(named('Power cage')).toBe('rack');
    expect(named('Rack 2')).toBe('rack');
    expect(named('Incline Bench 1')).toBe('bench');
    expect(named('Adjustable Incline/Flat Bench')).toBe('bench');
    expect(named('Dumbbell bench')).toBe('bench');
    expect(named('Main Dumbbell Rack')).toBe('dumbbells');
    expect(named('Dumbbells 2-50 kg')).toBe('dumbbells');
  });

  // A wrong drawing sends someone looking for the wrong thing.
  it('leaves strength machines and storage racks without a drawing', () => {
    expect(named('Lat Pulldown & Seated Cable Row')).toBeNull();
    expect(named('Seated Row')).toBeNull();
    expect(named('Cable Row')).toBeNull();
    expect(named('Leg Press')).toBeNull();
    expect(named('Dual Cable Cross')).toBeNull();
    expect(named('Smith Machine')).toBeNull();
    expect(named('Plate rack')).toBeNull();
    expect(named('Barbell rack')).toBeNull();
    expect(named('Kettlebell rack')).toBeNull();
    expect(named('Climbing wall')).toBeNull();
    expect(named('')).toBeNull();
  });

  it('trusts the Equipment Library item over a renamed machine', () => {
    expect(machineShapeOf({ name: 'Station 4', equipmentId: 'eq-treadmill' })).toBe('treadmill');
    expect(machineShapeOf({ name: 'Bay 2', equipmentId: 'eq-squat-rack' })).toBe('rack');
    expect(machineShapeOf({ name: 'Leg Press', equipmentId: 'eq-leg-press' })).toBeNull();
  });
});
