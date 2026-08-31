// Type-only import: this file is also compiled to plain JS for the Express
// server (npm run build:engine), and erasing the import keeps that output
// standalone rather than pulling in types.ts at runtime.
import type {
  LibraryExercise, Gym, ExerciseSlot, BlueprintDay, PlanTemplate,
  ExperienceLevel, JointStressArea, WorkoutDay, Exercise, SetDetail,
  MovementPattern,
} from '../types';

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface GenerationProfile {
  goal: string;
  experience: ExperienceLevel;
  daysPerWeek: number;
  sessionMinutes: number;
  injuryAreas: JointStressArea[];
}

export interface EligibilityContext {
  profile: GenerationProfile;
  availableEquipmentIds: Set<string>;
}

// ---------------------------------------------------------------------------
// Gym equipment
// ---------------------------------------------------------------------------

// A gym's equipment is the union of what its zones hold — there's no separate
// gym-level inventory, so this is the canonical answer to "what can someone
// actually train with here".
export const gymEquipmentIds = (gym: Gym | null | undefined): Set<string> => {
  const ids = new Set<string>();
  (gym?.zones || []).forEach(z => (z.equipmentIds || []).forEach(id => ids.add(id)));
  return ids;
};

// ---------------------------------------------------------------------------
// Eligibility — a hard filter, never a score
// ---------------------------------------------------------------------------

export type IneligibleReason =
  | 'not_generation_enabled'
  | 'missing_movement_pattern'
  | 'missing_category'
  | 'equipment_unavailable'
  | 'injury_conflict'
  | 'experience_too_high';

export interface EligibilityResult {
  eligible: boolean;
  reason?: IneligibleReason;
}

const EXPERIENCE_RANK: Record<ExperienceLevel, number> = { Beginner: 0, Intermediate: 1, Advanced: 2 };

// Fail closed: anything we can't positively establish as safe and performable
// is excluded. A missing tag is treated exactly like a disqualifying one, so
// a half-tagged exercise can never slip into someone's plan.
export const checkEligibility = (ex: LibraryExercise, ctx: EligibilityContext): EligibilityResult => {
  if (ex.generationEnabled !== true) return { eligible: false, reason: 'not_generation_enabled' };
  if (!ex.movementPattern) return { eligible: false, reason: 'missing_movement_pattern' };
  if (!ex.exerciseCategory) return { eligible: false, reason: 'missing_category' };

  const required = ex.requiredEquipmentIds || [];
  if (!required.every(id => ctx.availableEquipmentIds.has(id))) {
    return { eligible: false, reason: 'equipment_unavailable' };
  }

  const stressed = ex.jointStress || [];
  if (ctx.profile.injuryAreas.some(area => stressed.includes(area))) {
    return { eligible: false, reason: 'injury_conflict' };
  }

  if (ex.minExperience && EXPERIENCE_RANK[ex.minExperience] > EXPERIENCE_RANK[ctx.profile.experience]) {
    return { eligible: false, reason: 'experience_too_high' };
  }

  return { eligible: true };
};

export const eligibleExercises = (library: LibraryExercise[], ctx: EligibilityContext): LibraryExercise[] =>
  library.filter(ex => checkEligibility(ex, ctx).eligible);

// ---------------------------------------------------------------------------
// Split selection
// ---------------------------------------------------------------------------

export type SplitName = 'full_body' | 'upper_lower';

// Centralized so split logic never leaks into UI or query code. Kept
// deliberately small for the MVP — more goal/experience-specific splits slot
// in here without touching anything downstream.
export const selectSplit = (daysPerWeek: number): { split: SplitName; dayNames: string[] } => {
  if (daysPerWeek >= 4) {
    return { split: 'upper_lower', dayNames: ['Upper', 'Lower', 'Upper', 'Lower'].slice(0, daysPerWeek) };
  }
  return { split: 'full_body', dayNames: Array.from({ length: Math.max(daysPerWeek, 1) }, (_, i) => `Full Body ${i + 1}`) };
};

// ---------------------------------------------------------------------------
// Default blueprints — what makes generation fully automatic
// ---------------------------------------------------------------------------

// Set/rep/rest defaults per goal. Compound and isolation work are prescribed
// differently within the same goal, which is why this is keyed by both.
const GOAL_PRESCRIPTION: Record<string, { compound: Omit<ExerciseSlot, 'id' | 'movementPattern' | 'priority'>; isolation: Omit<ExerciseSlot, 'id' | 'movementPattern' | 'priority'> }> = {
  'Muscle gain': {
    compound: { setsMin: 3, setsMax: 4, repsMin: 8, repsMax: 12, restSeconds: 120, exerciseCategory: 'compound' },
    isolation: { setsMin: 2, setsMax: 3, repsMin: 10, repsMax: 15, restSeconds: 60, exerciseCategory: 'isolation' },
  },
  'Weight loss': {
    compound: { setsMin: 3, setsMax: 3, repsMin: 12, repsMax: 15, restSeconds: 60, exerciseCategory: 'compound' },
    isolation: { setsMin: 2, setsMax: 3, repsMin: 12, repsMax: 15, restSeconds: 45, exerciseCategory: 'isolation' },
  },
  'General fitness': {
    compound: { setsMin: 3, setsMax: 3, repsMin: 10, repsMax: 12, restSeconds: 90, exerciseCategory: 'compound' },
    isolation: { setsMin: 2, setsMax: 3, repsMin: 10, repsMax: 15, restSeconds: 60, exerciseCategory: 'isolation' },
  },
  'Endurance': {
    compound: { setsMin: 2, setsMax: 3, repsMin: 15, repsMax: 20, restSeconds: 45, exerciseCategory: 'compound' },
    isolation: { setsMin: 2, setsMax: 2, repsMin: 15, repsMax: 20, restSeconds: 30, exerciseCategory: 'isolation' },
  },
};
const DEFAULT_GOAL = 'General fitness';

// Which movements make up each day type, in training order. Compound work
// first (it's required), accessories and conditioning last (optional, so the
// duration fitter trims them before touching the main lifts).
type SlotSpec = { pattern: MovementPattern; kind: 'compound' | 'isolation'; optional?: boolean };

const FULL_BODY: SlotSpec[] = [
  { pattern: 'squat', kind: 'compound' },
  { pattern: 'horizontal_push', kind: 'compound' },
  { pattern: 'horizontal_pull', kind: 'compound' },
  { pattern: 'hinge', kind: 'compound', optional: true },
  { pattern: 'vertical_push', kind: 'compound', optional: true },
  { pattern: 'core', kind: 'isolation', optional: true },
];

const UPPER: SlotSpec[] = [
  { pattern: 'horizontal_push', kind: 'compound' },
  { pattern: 'horizontal_pull', kind: 'compound' },
  { pattern: 'vertical_push', kind: 'compound', optional: true },
  { pattern: 'vertical_pull', kind: 'compound', optional: true },
  { pattern: 'horizontal_pull', kind: 'isolation', optional: true },
  { pattern: 'horizontal_push', kind: 'isolation', optional: true },
];

const LOWER: SlotSpec[] = [
  { pattern: 'squat', kind: 'compound' },
  { pattern: 'hinge', kind: 'compound' },
  { pattern: 'lunge', kind: 'compound', optional: true },
  { pattern: 'core', kind: 'isolation', optional: true },
];

// Goals centered on calorie burn / work capacity get a conditioning finisher.
const GOALS_WITH_CONDITIONING = new Set(['Weight loss', 'Endurance']);

// Builds a complete blueprint from goal + days/week alone — no admin
// authoring required. An admin-authored blueprint always wins when one
// exists; this is what every other client falls back to.
export const buildDefaultBlueprint = (goal: string, daysPerWeek: number): BlueprintDay[] => {
  const { dayNames } = selectSplit(daysPerWeek);
  const rx = GOAL_PRESCRIPTION[goal] || GOAL_PRESCRIPTION[DEFAULT_GOAL];

  return dayNames.map((name, dayIdx) => {
    const base = name.startsWith('Upper') ? UPPER : name.startsWith('Lower') ? LOWER : FULL_BODY;
    const specs: SlotSpec[] = GOALS_WITH_CONDITIONING.has(goal)
      ? [...base, { pattern: 'conditioning', kind: 'isolation', optional: true }]
      : base;

    return {
      id: `defbp-${dayIdx}`,
      name,
      slots: specs.map((spec, i) => ({
        ...rx[spec.kind],
        id: `defslot-${dayIdx}-${i}`,
        movementPattern: spec.pattern,
        priority: i + 1,
        optional: spec.optional,
        // Conditioning is neither compound nor isolation in the library's
        // taxonomy — leaving the category unset lets any cardio-tagged
        // exercise fill it rather than none.
        exerciseCategory: spec.pattern === 'conditioning' ? undefined : rx[spec.kind].exerciseCategory,
      })),
    };
  });
};

// ---------------------------------------------------------------------------
// Candidate scoring
// ---------------------------------------------------------------------------

export const SCORING = {
  categoryMatch: 10,
  compoundForStrengthGoal: 20,
  experienceFit: 15,
  alreadyUsedInPlan: -100, // effectively prevents reuse, but stays a score so a
                           // slot with no alternative can still be filled
};

const GOAL_PREFERS_COMPOUND = new Set(['Muscle gain', 'General fitness']);

export const scoreCandidate = (
  ex: LibraryExercise,
  slot: ExerciseSlot,
  profile: GenerationProfile,
  alreadyUsedIds: Set<string>,
): number => {
  let score = 0;
  if (slot.exerciseCategory && ex.exerciseCategory === slot.exerciseCategory) score += SCORING.categoryMatch;
  if (GOAL_PREFERS_COMPOUND.has(profile.goal) && ex.exerciseCategory === 'compound') score += SCORING.compoundForStrengthGoal;
  // An exercise pitched at exactly the user's level beats one pitched below it.
  if (ex.minExperience === profile.experience) score += SCORING.experienceFit;
  if (alreadyUsedIds.has(ex.id)) score += SCORING.alreadyUsedInPlan;
  return score;
};

// Deterministic by construction: candidates are filtered to the slot's
// pattern, scored, and ties broken by id — so the same inputs always yield
// the same pick, with no reliance on library array order.
export const selectForSlot = (
  slot: ExerciseSlot,
  pool: LibraryExercise[],
  profile: GenerationProfile,
  alreadyUsedIds: Set<string>,
): LibraryExercise | null => {
  const candidates = pool.filter(ex => ex.movementPattern === slot.movementPattern);
  if (candidates.length === 0) return null;

  return candidates
    .map(ex => ({ ex, score: scoreCandidate(ex, slot, profile, alreadyUsedIds) }))
    .sort((a, b) => (b.score - a.score) || a.ex.id.localeCompare(b.ex.id))[0].ex;
};

// ---------------------------------------------------------------------------
// Duration estimation
// ---------------------------------------------------------------------------

export const TIMING = {
  secondsPerRep: 3,
  setupSecondsPerExercise: 60,
  warmupMinutes: 5,
};

export const estimateExerciseSeconds = (sets: number, reps: number, restSeconds: number): number =>
  sets * reps * TIMING.secondsPerRep + Math.max(sets - 1, 0) * restSeconds + TIMING.setupSecondsPerExercise;

export const estimateDayMinutes = (exercises: { sets: number; reps: number; restSeconds: number }[]): number => {
  const seconds = exercises.reduce((a, e) => a + estimateExerciseSeconds(e.sets, e.reps, e.restSeconds), 0);
  return Math.round(seconds / 60) + TIMING.warmupMinutes;
};

// ---------------------------------------------------------------------------
// Prescription
// ---------------------------------------------------------------------------

// Weight is deliberately absent: with no logged history there's no honest
// basis for a number, and inventing one is the riskiest thing this engine
// could do. Reps carry the prescription instead.
const prescriptionFor = (slot: ExerciseSlot, profile: GenerationProfile) => {
  const sets = profile.experience === 'Beginner' ? slot.setsMin : slot.setsMax;
  const reps = Math.round((slot.repsMin + slot.repsMax) / 2);
  return { sets, reps, restSeconds: slot.restSeconds };
};

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export interface GenerationFailure {
  ok: false;
  reason: 'no_candidate_for_slot' | 'cannot_fit_duration' | 'no_blueprint_days';
  detail: string;
}

export interface GenerationSuccess {
  ok: true;
  days: WorkoutDay[];
  decisions: SlotDecision[];
}

export interface SlotDecision {
  dayName: string;
  slotId: string;
  movementPattern: string;
  selectedExerciseId: string;
  selectedExerciseName: string;
  score: number;
  dropped?: boolean;
  droppedReason?: 'duration';
}

export type GenerationResult = GenerationSuccess | GenerationFailure;

const buildExercise = (
  le: LibraryExercise,
  slot: ExerciseSlot,
  profile: GenerationProfile,
  idSuffix: string,
): Exercise => {
  const { sets, reps, restSeconds } = prescriptionFor(slot, profile);
  const setDetails: SetDetail[] = Array.from({ length: sets }, () => ({
    reps: String(reps),
    weight: '',
    restSec: restSeconds,
  }));
  return {
    id: `gex-${idSuffix}`,
    name: le.name,
    targetMuscle: le.targetMuscle,
    sets,
    reps: `${slot.repsMin}-${slot.repsMax}`,
    equipmentId: le.equipmentId || 'manual',
    libraryExerciseId: le.id,
    setDetails,
  };
};

export const generatePlan = (
  blueprint: PlanTemplate,
  library: LibraryExercise[],
  gym: Gym | null | undefined,
  profile: GenerationProfile,
): GenerationResult => {
  const blueprintDays = blueprint.blueprintDays || [];
  if (blueprintDays.length === 0) {
    return { ok: false, reason: 'no_blueprint_days', detail: `Template ${blueprint.id} has no blueprint days` };
  }

  const ctx: EligibilityContext = { profile, availableEquipmentIds: gymEquipmentIds(gym) };
  const pool = eligibleExercises(library, ctx);

  const days: WorkoutDay[] = [];
  const decisions: SlotDecision[] = [];

  for (let d = 0; d < blueprintDays.length; d++) {
    const bpDay: BlueprintDay = blueprintDays[d];
    // Reuse is discouraged within a day, not across the week — the same
    // compound legitimately recurs on a Tuesday and a Friday.
    const usedInDay = new Set<string>();
    const picked: { le: LibraryExercise; slot: ExerciseSlot; score: number }[] = [];

    for (const slot of [...bpDay.slots].sort((a, b) => a.priority - b.priority)) {
      const le = selectForSlot(slot, pool, profile, usedInDay);
      if (!le) {
        if (slot.optional) continue; // an optional slot with no candidate is simply skipped
        return {
          ok: false,
          reason: 'no_candidate_for_slot',
          detail: `No eligible ${slot.movementPattern} exercise for "${bpDay.name}" at this gym`,
        };
      }
      usedInDay.add(le.id);
      picked.push({ le, slot, score: scoreCandidate(le, slot, profile, new Set()) });
    }

    // Fit the session length by dropping the lowest-priority optional slot
    // first. Required slots are never dropped — if the required work alone
    // overruns, that's a real failure, not something to silently trim.
    const measure = () => estimateDayMinutes(picked.map(p => {
      const { sets, reps, restSeconds } = prescriptionFor(p.slot, profile);
      return { sets, reps, restSeconds };
    }));

    const droppedIds: string[] = [];
    while (measure() > profile.sessionMinutes) {
      let dropIdx = -1;
      let worstPriority = -Infinity;
      picked.forEach((p, i) => {
        if (p.slot.optional && p.slot.priority > worstPriority) {
          worstPriority = p.slot.priority;
          dropIdx = i;
        }
      });
      if (dropIdx === -1) {
        return {
          ok: false,
          reason: 'cannot_fit_duration',
          detail: `"${bpDay.name}" needs ${measure()} min of required work but the session is ${profile.sessionMinutes} min`,
        };
      }
      droppedIds.push(picked[dropIdx].slot.id);
      picked.splice(dropIdx, 1);
    }

    picked.forEach(p => decisions.push({
      dayName: bpDay.name,
      slotId: p.slot.id,
      movementPattern: p.slot.movementPattern,
      selectedExerciseId: p.le.id,
      selectedExerciseName: p.le.name,
      score: p.score,
    }));
    droppedIds.forEach(slotId => decisions.push({
      dayName: bpDay.name,
      slotId,
      movementPattern: '',
      selectedExerciseId: '',
      selectedExerciseName: '',
      score: 0,
      dropped: true,
      droppedReason: 'duration',
    }));

    days.push({
      id: `gday-${d}`,
      name: bpDay.name,
      exercises: picked.map((p, i) => buildExercise(p.le, p.slot, profile, `${d}-${i}`)),
    });
  }

  return { ok: true, days, decisions };
};

// ---------------------------------------------------------------------------
// Validation — deliberately re-checks eligibility rather than trusting that
// the selection step got it right. Two independent implementations of the
// same guarantee is the point.
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export const validatePlan = (
  days: WorkoutDay[],
  library: LibraryExercise[],
  gym: Gym | null | undefined,
  profile: GenerationProfile,
): ValidationResult => {
  const errors: string[] = [];
  const ctx: EligibilityContext = { profile, availableEquipmentIds: gymEquipmentIds(gym) };
  const byId = new Map(library.map(le => [le.id, le]));

  if (days.length !== profile.daysPerWeek) {
    errors.push(`Expected ${profile.daysPerWeek} days, generated ${days.length}`);
  }

  days.forEach(day => {
    if (day.exercises.length === 0) errors.push(`"${day.name}" has no exercises`);

    const seen = new Set<string>();
    day.exercises.forEach(ex => {
      const le = ex.libraryExerciseId ? byId.get(ex.libraryExerciseId) : undefined;
      if (!le) {
        errors.push(`"${ex.name}" in "${day.name}" is not a library exercise`);
        return;
      }
      const check = checkEligibility(le, ctx);
      if (!check.eligible) errors.push(`"${le.name}" in "${day.name}" is not eligible (${check.reason})`);
      if (seen.has(le.id)) errors.push(`"${le.name}" appears twice in "${day.name}"`);
      seen.add(le.id);

      if (!ex.setDetails || ex.setDetails.length === 0) {
        errors.push(`"${ex.name}" in "${day.name}" has no sets`);
      }
    });

    const minutes = estimateDayMinutes(day.exercises.map(ex => ({
      sets: ex.setDetails?.length || ex.sets || 0,
      reps: parseInt(ex.setDetails?.[0]?.reps || '0', 10) || 0,
      restSeconds: ex.setDetails?.[0]?.restSec ?? 60,
    })));
    if (minutes > profile.sessionMinutes) {
      errors.push(`"${day.name}" is ${minutes} min, over the ${profile.sessionMinutes} min target`);
    }
  });

  return { valid: errors.length === 0, errors };
};
