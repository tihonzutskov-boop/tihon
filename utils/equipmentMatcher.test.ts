import { describe, it, expect } from 'vitest';
import { getExerciseRequiredEquipmentIds } from './equipmentMatcher';
import type { LibraryExercise } from '../types';

describe('deriving what an untagged bench press needs', () => {
  const untagged = (name: string) => ({ id: 'x', name, targetMuscle: 'Chest', equipmentRequired: '', category: '', instructions: '', equipmentId: '' } as LibraryExercise);

  it('does not ask a dumbbell bench press for a barbell', () => {
    const ids = getExerciseRequiredEquipmentIds(untagged('Dumbbell Bench Press'));
    expect(ids).toContain('eq-dumbbells');
    expect(ids).toContain('eq-adj-bench');
    expect(ids).not.toContain('eq-barbell-plates');
  });

  it('still asks a plain bench press for one', () => {
    expect(getExerciseRequiredEquipmentIds(untagged('Bench Press'))).toContain('eq-barbell-plates');
  });
});
