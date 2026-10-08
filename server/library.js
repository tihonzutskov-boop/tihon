// The exercise library as the plan engine reads it.
//
// The generator and the adapted-plan route both load the library from the
// database with an explicit column list (the media columns are huge and the
// engine needs none of them). That list has to carry every field the engine
// reads, and it once did not: exercise_type and video_duration_label were left
// out, so on the server no exercise was ever a video and no video could be picked
// for a warm-up, a cool-down or the abs, however it was tagged. The columns and
// the mapping live here, together, so a field cannot be in one and not the other.

export const GENERATION_COLUMNS = `id, name, target_muscle, equipment_required, required_equipment_ids,
            category, instructions, equipment_id, movement_pattern, bookend_roles, warmup_note, cooldown_note,
            exercise_category, min_experience, joint_stress,
            primary_muscles, secondary_muscles, generation_enabled,
            exercise_type, video_duration_label`;

export const rowToGenerationExercise = (row) => ({
  id: row.id,
  name: row.name,
  targetMuscle: row.target_muscle || '',
  equipmentRequired: row.equipment_required || '',
  requiredEquipmentIds: row.required_equipment_ids || [],
  category: row.category || '',
  instructions: row.instructions || '',
  equipmentId: row.equipment_id || '',
  movementPattern: row.movement_pattern || undefined,
  bookendRoles: row.bookend_roles || [],
  warmupNote: row.warmup_note || '',
  cooldownNote: row.cooldown_note || '',
  exerciseCategory: row.exercise_category || undefined,
  minExperience: row.min_experience || undefined,
  jointStress: row.joint_stress || [],
  primaryMuscles: row.primary_muscles || [],
  secondaryMuscles: row.secondary_muscles || [],
  generationEnabled: row.generation_enabled === true,
  // What makes a follow-along video a video to the engine, and how long it runs.
  exerciseType: row.exercise_type === 'video' ? 'video' : 'standard',
  videoDurationLabel: row.video_duration_label || '',
});
