import { describe, it, expect } from 'vitest';
import { GENERATION_COLUMNS, rowToGenerationExercise } from './library.js';

const row = (over = {}) => ({
  id: 'ex-1', name: 'Hip openers', target_muscle: 'Hips', required_equipment_ids: ['eq-floor-mat'],
  bookend_roles: ['warmup'], exercise_category: 'mobility', generation_enabled: true,
  exercise_type: 'video', video_duration_label: '5 min', ...over,
});

describe('the library as the engine reads it', () => {
  it('carries a video\'s type and length, which the engine needs to use it as a video', () => {
    const ex = rowToGenerationExercise(row());
    expect(ex.exerciseType).toBe('video');
    expect(ex.videoDurationLabel).toBe('5 min');
  });

  it('reads anything not marked a video as a standard exercise', () => {
    for (const type of ['standard', null, undefined, '', 'other']) {
      expect(rowToGenerationExercise(row({ exercise_type: type })).exerciseType, String(type)).toBe('standard');
    }
    expect(rowToGenerationExercise(row({ video_duration_label: null })).videoDurationLabel).toBe('');
  });

  it('carries what makes a video pickable for a warm-up or cool-down', () => {
    const ex = rowToGenerationExercise(row());
    expect(ex).toMatchObject({
      bookendRoles: ['warmup'], exerciseCategory: 'mobility', generationEnabled: true, requiredEquipmentIds: ['eq-floor-mat'],
    });
  });

  it('is not generation-enabled unless it is explicitly true', () => {
    for (const v of [false, null, undefined, 'true', 1]) {
      expect(rowToGenerationExercise(row({ generation_enabled: v })).generationEnabled, String(v)).toBe(false);
    }
  });

  // The failure this file exists to prevent: a field mapped but never selected,
  // or selected but never mapped.
  it('selects every column the mapping reads', () => {
    const selected = new Set(GENERATION_COLUMNS.split(',').map(c => c.trim()).filter(Boolean));
    const fields = Object.keys(row());
    for (const column of [...fields, 'equipment_required', 'category', 'instructions', 'equipment_id', 'movement_pattern',
      'warmup_note', 'cooldown_note', 'min_experience', 'joint_stress', 'primary_muscles', 'secondary_muscles']) {
      expect(selected.has(column), column).toBe(true);
    }
  });

  it('selects the video columns by name', () => {
    expect(GENERATION_COLUMNS).toContain('exercise_type');
    expect(GENERATION_COLUMNS).toContain('video_duration_label');
  });
});
