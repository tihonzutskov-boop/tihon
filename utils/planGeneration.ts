// Type-only import: this file is also compiled to plain JS for the Express
// server (npm run build:engine), and erasing the import keeps that output
// standalone rather than pulling in types.ts at runtime.
import type {
  LibraryExercise, Gym, ExerciseSlot, BlueprintDay, PlanTemplate,
  ExperienceLevel, JointStressArea, WorkoutDay, Exercise, SetDetail,
  MovementPattern, MuscleGroup,
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

export type SplitName = 'full_body' | 'upper_lower' | 'push_pull_legs';

// Centralized so split logic never leaks into UI or query code. Cycles the
// pattern to fill however many days were asked for, rather than slicing a
// fixed-length list — slicing silently returned fewer days than requested
// above 4, which validation would then reject as a day-count mismatch.
export const selectSplit = (daysPerWeek: number): { split: SplitName; dayNames: string[] } => {
  const n = Math.max(daysPerWeek, 1);
  const cycle = (base: string[]) => Array.from({ length: n }, (_, i) => base[i % base.length]);

  if (n >= 5) return { split: 'push_pull_legs', dayNames: cycle(['Push', 'Pull', 'Legs']) };
  if (n >= 4) return { split: 'upper_lower', dayNames: cycle(['Upper', 'Lower']) };
  return { split: 'full_body', dayNames: Array.from({ length: n }, (_, i) => `Full Body ${i + 1}`) };
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
  { pattern: 'shoulder_abduction', kind: 'isolation', optional: true },
  { pattern: 'elbow_flexion', kind: 'isolation', optional: true },
  { pattern: 'elbow_extension', kind: 'isolation', optional: true },
];

const LOWER: SlotSpec[] = [
  { pattern: 'squat', kind: 'compound' },
  { pattern: 'hinge', kind: 'compound' },
  { pattern: 'lunge', kind: 'compound', optional: true },
  { pattern: 'knee_flexion', kind: 'isolation', optional: true },
  { pattern: 'knee_extension', kind: 'isolation', optional: true },
  { pattern: 'hip_extension', kind: 'isolation', optional: true },
  { pattern: 'hip_adduction', kind: 'isolation', optional: true },
  { pattern: 'hip_abduction', kind: 'isolation', optional: true },
  { pattern: 'calf_raise', kind: 'isolation', optional: true },
  { pattern: 'core', kind: 'isolation', optional: true },
];

const PUSH: SlotSpec[] = [
  { pattern: 'horizontal_push', kind: 'compound' },
  { pattern: 'vertical_push', kind: 'compound' },
  { pattern: 'horizontal_push', kind: 'isolation', optional: true },
  { pattern: 'shoulder_abduction', kind: 'isolation', optional: true },
  { pattern: 'elbow_extension', kind: 'isolation', optional: true },
];

const PULL: SlotSpec[] = [
  { pattern: 'vertical_pull', kind: 'compound' },
  { pattern: 'horizontal_pull', kind: 'compound' },
  { pattern: 'horizontal_pull', kind: 'isolation', optional: true },
  { pattern: 'elbow_flexion', kind: 'isolation', optional: true },
];

const LEGS: SlotSpec[] = [
  { pattern: 'squat', kind: 'compound' },
  { pattern: 'hinge', kind: 'compound' },
  { pattern: 'lunge', kind: 'compound', optional: true },
  { pattern: 'knee_flexion', kind: 'isolation', optional: true },
  { pattern: 'knee_extension', kind: 'isolation', optional: true },
  { pattern: 'hip_extension', kind: 'isolation', optional: true },
  { pattern: 'hip_adduction', kind: 'isolation', optional: true },
  { pattern: 'hip_abduction', kind: 'isolation', optional: true },
  { pattern: 'calf_raise', kind: 'isolation', optional: true },
  { pattern: 'core', kind: 'isolation', optional: true },
];

// Every day opens with a short mobility warm-up. Optional so a very short
// session can still be produced, but first in the order so it's trained
// first when it is included.
const WARMUP: SlotSpec = { pattern: 'mobility', kind: 'isolation', optional: true };

const DAY_TEMPLATES: { match: (name: string) => boolean; slots: SlotSpec[] }[] = [
  { match: n => n.startsWith('Upper'), slots: UPPER },
  { match: n => n.startsWith('Lower'), slots: LOWER },
  { match: n => n.startsWith('Push'), slots: PUSH },
  { match: n => n.startsWith('Pull'), slots: PULL },
  { match: n => n.startsWith('Legs'), slots: LEGS },
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
    const base = DAY_TEMPLATES.find(t => t.match(name))?.slots || FULL_BODY;
    const withFinisher: SlotSpec[] = GOALS_WITH_CONDITIONING.has(goal)
      ? [...base, { pattern: 'conditioning', kind: 'isolation', optional: true }]
      : base;
    const specs: SlotSpec[] = [WARMUP, ...withFinisher];

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
        // Conditioning and mobility work sit outside the compound/isolation
        // split, so leaving the category unset lets any exercise tagged for
        // that pattern fill the slot rather than none.
        exerciseCategory: (spec.pattern === 'conditioning' || spec.pattern === 'mobility')
          ? undefined
          : rx[spec.kind].exerciseCategory,
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
  perRepeatedMuscle: -6,   // nudges toward variety when two candidates would
                           // otherwise train the same thing twice in a day
};

const GOAL_PREFERS_COMPOUND = new Set(['Muscle gain', 'General fitness']);

export const scoreCandidate = (
  ex: LibraryExercise,
  slot: ExerciseSlot,
  profile: GenerationProfile,
  musclesAlreadyTrained: Set<MuscleGroup> = new Set(),
): number => {
  let score = 0;
  if (slot.exerciseCategory && ex.exerciseCategory === slot.exerciseCategory) score += SCORING.categoryMatch;
  if (GOAL_PREFERS_COMPOUND.has(profile.goal) && ex.exerciseCategory === 'compound') score += SCORING.compoundForStrengthGoal;
  // An exercise pitched at exactly the user's level beats one pitched below it.
  if (ex.minExperience === profile.experience) score += SCORING.experienceFit;
  // Untagged exercises simply score 0 here rather than being penalized —
  // missing muscle tags shouldn't disadvantage an otherwise good pick.
  const repeats = (ex.primaryMuscles || []).filter(m => musclesAlreadyTrained.has(m)).length;
  score += repeats * SCORING.perRepeatedMuscle;
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
  musclesAlreadyTrained: Set<MuscleGroup> = new Set(),
): LibraryExercise | null => {
  // Already-used exercises are removed, not merely penalized. Penalizing
  // still let one win when it was the only candidate, producing a day with
  // the same exercise twice — which the validator then rejected, so a thin
  // library failed to produce any plan at all instead of a shorter one.
  const candidates = pool.filter(ex =>
    ex.movementPattern === slot.movementPattern && !alreadyUsedIds.has(ex.id)
  );
  if (candidates.length === 0) return null;

  return candidates
    .map(ex => ({ ex, score: scoreCandidate(ex, slot, profile, musclesAlreadyTrained) }))
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
  droppedReason?: 'duration' | 'no_candidate';
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
    const musclesInDay = new Set<MuscleGroup>();
    const picked: { le: LibraryExercise; slot: ExerciseSlot; score: number }[] = [];
    const unfilledRequired: { slotId: string; movementPattern: MovementPattern }[] = [];

    for (const slot of [...bpDay.slots].sort((a, b) => a.priority - b.priority)) {
      const le = selectForSlot(slot, pool, profile, usedInDay, musclesInDay);
      if (!le) {
        // A slot nothing can fill is skipped rather than failing the whole
        // plan. Killing the week over one gap meant a client with a knee
        // complaint, or a library with no hinge exercise, received no plan
        // at all instead of a shorter one — strictly worse for them.
        // The skip is still recorded below, so the gap surfaces in the
        // admin's Issues queue rather than disappearing silently.
        if (!slot.optional) {
          unfilledRequired.push({ slotId: slot.id, movementPattern: slot.movementPattern });
        }
        continue;
      }
      usedInDay.add(le.id);
      (le.primaryMuscles || []).forEach(m => musclesInDay.add(m));
      picked.push({ le, slot, score: scoreCandidate(le, slot, profile) });
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

    if (picked.length === 0) {
      const wanted = bpDay.slots.map(sl => sl.movementPattern).join(', ');
      return {
        ok: false,
        reason: 'no_candidate_for_slot',
        detail: `Nothing at this gym can fill any slot in "${bpDay.name}" (needed: ${wanted})`,
      };
    }

    unfilledRequired.forEach(u => decisions.push({
      dayName: bpDay.name,
      slotId: u.slotId,
      movementPattern: u.movementPattern,
      selectedExerciseId: '',
      selectedExerciseName: '',
      score: 0,
      dropped: true,
      droppedReason: 'no_candidate',
    }));

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
  warnings: string[];
}

// Muscle groups a balanced week should touch. Deliberately the big movers
// only — flagging a week for missing calves would be noise, not signal.
// Regions rather than individual heads: muscle tags are split finely (lats,
// upper back, lower back), so asking for "Back" by name would never be
// satisfied. A region counts as trained when any one of its heads is.
const CORE_COVERAGE: { region: string; anyOf: MuscleGroup[] }[] = [
  { region: 'Chest', anyOf: ['Chest', 'Upper chest'] },
  { region: 'Back', anyOf: ['Lats', 'Upper back', 'Lower back'] },
  { region: 'Quads', anyOf: ['Quads'] },
  { region: 'Hamstrings', anyOf: ['Hamstrings'] },
];

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

  // Weekly balance. Reported as warnings, not errors: an unbalanced week is
  // worth an admin's attention, but it's a better outcome than refusing to
  // give the client any plan at all. Only checked once enough of the library
  // is tagged for the answer to mean anything.
  const warnings: string[] = [];
  const tagged = library.filter(le => (le.primaryMuscles || []).length > 0);
  if (tagged.length > 0) {
    const trained = new Set<MuscleGroup>();
    days.forEach(day => day.exercises.forEach(ex => {
      const le = ex.libraryExerciseId ? byId.get(ex.libraryExerciseId) : undefined;
      (le?.primaryMuscles || []).forEach(m => trained.add(m));
    }));
    const missing = CORE_COVERAGE
      .filter(c => !c.anyOf.some(m => trained.has(m)))
      .map(c => c.region);
    if (missing.length > 0) {
      warnings.push(`Week does not train: ${missing.join(', ')}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
};
