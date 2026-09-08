// Type-only import: this file is also compiled to plain JS for the Express
// server (npm run build:engine), and erasing the import keeps that output
// standalone rather than pulling in types.ts at runtime.
import type {
  LibraryExercise, Gym, ExerciseSlot, BlueprintDay, PlanTemplate,
  ExperienceLevel, JointStressArea, WorkoutDay, Exercise, SetDetail,
  MovementPattern, MuscleGroup,
} from '../types.js';
// A real import, not type-only: the session's length decides its whole shape,
// so these run at generation time. Compiled alongside planGeneration into the
// engine build the server uses.
import { shapeFor, bookendsFor, trainingMinutesAvailable } from './sessionShape.js';
import type { SessionShape } from './sessionShape.js';

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
  // Not fatigue work, so the usual set/rep logic barely applies: fewer
  // controlled reps, short rest, no load. exerciseCategory left off both
  // halves (mirrors the treatment 'mobility' and 'conditioning' patterns
  // already get below) so any exercise tagged for the region fills the slot
  // rather than needing a category match on top of the pattern match.
  'Mobility': {
    compound: { setsMin: 1, setsMax: 2, repsMin: 8, repsMax: 10, restSeconds: 20 },
    isolation: { setsMin: 1, setsMax: 2, repsMin: 8, repsMax: 10, restSeconds: 20 },
  },
};
const DEFAULT_GOAL = 'General fitness';

// Which movements make up each day type, in training order. Compound work
// first (it's required), accessories and conditioning last (optional, so the
// duration fitter trims them before touching the main lifts).
type SlotSpec = { pattern: MovementPattern; kind: 'compound' | 'isolation'; optional?: boolean };

// One session structure regardless of day count: unlike a strength split,
// there's no basis for an "upper mobility day" vs a "lower mobility day" — a
// mobility session works whichever regions the client has, every time. Hip
// and shoulder are required since they're the two regions beginners lose the
// most range in from sitting; spine and ankle are real but lower-priority,
// so a short session keeps the first three and drops last.
const MOBILITY_PATTERNS = new Set<MovementPattern>([
  'mobility', 'hip_mobility', 'shoulder_mobility', 'spine_mobility', 'ankle_mobility',
]);

const MOBILITY: SlotSpec[] = [
  { pattern: 'hip_mobility', kind: 'isolation' },
  { pattern: 'shoulder_mobility', kind: 'isolation' },
  { pattern: 'spine_mobility', kind: 'isolation', optional: true },
  { pattern: 'ankle_mobility', kind: 'isolation', optional: true },
  { pattern: 'core', kind: 'isolation', optional: true },
];

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
//
// One aim's slots for one day, with that aim's own prescription already
// applied and priorities numbered locally from 1 — a combining caller
// renumbers them to sit after whichever blocks came before. Split out so
// buildCombinedBlueprint can call it once per selected aim without
// duplicating the goal → template → prescription logic.
const slotsForGoal = (goal: string, dayName: string, shape: SessionShape): ExerciseSlot[] => {
  const rx = GOAL_PRESCRIPTION[goal] || GOAL_PRESCRIPTION[DEFAULT_GOAL];
  // A mobility session has no upper/lower or push/pull split to speak of —
  // it works whichever regions the client has, every time — so it ignores
  // the day-name-driven template lookup that every other goal uses.
  const base = goal === 'Mobility' ? MOBILITY : (DAY_TEMPLATES.find(t => t.match(dayName))?.slots || FULL_BODY);
  const focused = shape.includeAccessories ? base : base.filter(sp => !sp.optional);
  const withFinisher: SlotSpec[] = GOALS_WITH_CONDITIONING.has(goal) && shape.includeAccessories
    ? [...focused, { pattern: 'conditioning', kind: 'isolation', optional: true }]
    : focused;

  return withFinisher.map((spec, i) => ({
    ...rx[spec.kind],
    id: `slot-${i}`, // placeholder — the caller (single- or combined-blueprint) assigns the real, namespaced id
    movementPattern: spec.pattern,
    priority: i + 1,
    optional: spec.optional,
    // Conditioning and mobility work sit outside the compound/isolation
    // split, so leaving the category unset lets any exercise tagged for
    // that pattern fill the slot rather than none.
    exerciseCategory: MOBILITY_PATTERNS.has(spec.pattern) || spec.pattern === 'conditioning'
      ? undefined
      : rx[spec.kind].exerciseCategory,
  }));
};

export const buildDefaultBlueprint = (goal: string, daysPerWeek: number, sessionMinutes = 60): BlueprintDay[] =>
  buildCombinedBlueprint([goal], daysPerWeek, sessionMinutes);

// Combining aims must not simply add their blocks end to end. Doing that
// doubled the day: two aims meant every one of the first aim's exercises
// followed by every one of the second's — eleven separate movements for
// Muscle gain + Mobility, which is far more than a beginner should meet in
// one session however well it fits the clock.
//
// Two rules fix that. Required work from every selected aim always survives,
// because dropping it would defeat the point of having chosen that aim.
// Optional accessory work is shared against one budget across all aims
// rather than each aim bringing its own full set, so a second aim adds
// variety rather than volume.
//
// Within each of those groups the aims take turns instead of running one
// block then the next, so a combined day alternates between them — squat,
// hip mobility, press, shoulder mobility — rather than reading as two
// separate workouts stapled together. Required work still precedes
// accessories overall, which is the ordering every single-aim template
// already uses.
const MAX_TOTAL_SLOTS_WHEN_COMBINING = 6;

// Round-robin across the aims: one slot from each in turn, until every list
// is spent. Each aim's own internal order is preserved within its turns.
const takeTurns = (lists: ExerciseSlot[][]): ExerciseSlot[] => {
  const out: ExerciseSlot[] = [];
  const longest = Math.max(0, ...lists.map(l => l.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      if (i < list.length) out.push(list[i]);
    }
  }
  return out;
};

const combineGoalBlocks = (perGoal: ExerciseSlot[][]): ExerciseSlot[] => {
  const required = takeTurns(perGoal.map(list => list.filter(s => !s.optional)));
  const optional = takeTurns(perGoal.map(list => list.filter(s => s.optional)));
  // Required work is never trimmed here — if several aims together demand
  // more than the cap, they all still appear, and the duration fitter
  // downstream remains the authority on whether that actually fits the
  // session.
  const room = Math.max(0, MAX_TOTAL_SLOTS_WHEN_COMBINING - required.length);
  return [...required, ...optional.slice(0, room)];
};

// A client can select more than one aim, and each one contributes its own
// block of slots to the same day — not averaged together into a prescription
// neither aim actually asked for, but done properly once per aim, back to
// back. Picking Muscle gain + Mobility gets Muscle gain's compound lifts at
// its own reps/rest, followed by Mobility's joint work at its own reps/rest.
//
// Selecting goals that overlap heavily (e.g. Muscle gain + Weight loss, which
// already share almost every movement pattern) is not specially detected or
// blocked — each still contributes its own slot for, say, squat, and the
// generator fills both with two different squat-pattern exercises rather than
// one. That produces a long, repetitive session, and for a short session it
// legitimately fails to fit (the same cannot_fit_duration outcome any
// over-full day produces) rather than silently truncating into something
// neither aim asked for. The safety valve is the existing duration fitter,
// not goal-pair-specific logic.
export const buildCombinedBlueprint = (goals: string[], daysPerWeek: number, sessionMinutes = 60): BlueprintDay[] => {
  const activeGoals = goals.length > 0 ? goals : [DEFAULT_GOAL];
  const { dayNames } = selectSplit(daysPerWeek);
  // Session length shapes what gets built, rather than trimming what was built.
  // A short session is composed of the priority work only; it is not a long
  // session with the end cut off.
  const shape = shapeFor(sessionMinutes);

  return dayNames.map((name, dayIdx) => {
    const perGoal = activeGoals.map(goal => slotsForGoal(goal, name, shape));

    // One aim is left exactly as its own template describes it — no
    // interleaving or capping applies, so single-aim generation is unchanged.
    const ordered = perGoal.length === 1
      ? perGoal[0]
      : combineGoalBlocks(perGoal);

    return {
      id: `defbp-${dayIdx}`,
      name,
      slots: ordered.map((spec, i) => ({ ...spec, id: `defslot-${dayIdx}-${i}`, priority: i + 1 })),
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
  // Full-body (and any split where the same pattern recurs, e.g. two Upper
  // days) previously produced identical sessions on every training day: the
  // slot template is the same and selection is deterministic, so with no
  // signal to prefer otherwise the same exercise won every tie. Large enough
  // to beat any same-pattern scoring gap (experienceFit + a muscle repeat, at
  // most 21) so an untried alternative always wins when one exists — but a
  // repeat is still picked over no exercise at all when the library has only
  // one candidate for the pattern.
  usedEarlierInWeek: -40,
};

const GOAL_PREFERS_COMPOUND = new Set(['Muscle gain', 'General fitness']);

export const scoreCandidate = (
  ex: LibraryExercise,
  slot: ExerciseSlot,
  profile: GenerationProfile,
  musclesAlreadyTrained: Set<MuscleGroup> = new Set(),
  usedEarlierInWeek: Set<string> = new Set(),
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
  // A soft preference, not an exclusion: the same compound can legitimately
  // recur across the week (a Monday and a Friday squat), so a repeat is never
  // filtered out — it just loses the tie to anything the client hasn't done
  // yet this week.
  if (usedEarlierInWeek.has(ex.id)) score += SCORING.usedEarlierInWeek;
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
  usedEarlierInWeek: Set<string> = new Set(),
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
    .map(ex => ({ ex, score: scoreCandidate(ex, slot, profile, musclesAlreadyTrained, usedEarlierInWeek) }))
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

// bookendMinutes defaults to the old flat warm-up allowance so existing
// callers keep their previous behaviour; the generator passes the real
// warm-up + cooldown for the session's tier.
export const estimateDayMinutes = (
  exercises: { sets: number; reps: number; restSeconds: number }[],
  bookendMinutes: number = TIMING.warmupMinutes,
): number => {
  const seconds = exercises.reduce((a, e) => a + estimateExerciseSeconds(e.sets, e.reps, e.restSeconds), 0);
  return Math.round(seconds / 60) + bookendMinutes;
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
  // Time available buys longer rest, which is the cheapest quality upgrade
  // there is: better performance on later sets, no extra recovery cost.
  const shape = shapeFor(profile.sessionMinutes);
  const restSeconds = Math.round(slot.restSeconds * shape.restMultiplier);
  return { sets, reps, restSeconds };
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

// The warm-up and cooldown are real entries in the day, not just a block of
// text beside it, so a beginner can find where to do them the same way they
// find anything else — the "2 minutes easy cardio" step is useless if you
// don't know where the bike is.
//
// Preference order: an exercise explicitly tagged for this bookend, then
// general mobility work, then a cardio machine — which is what the steps
// actually describe, and the most locatable thing in the room.
const BOOKEND_SCORING = { taggedForBookend: 30, mobility: 20, mobilityPattern: 15, cardio: 10 };

export const selectBookendExercise = (
  kind: 'warmup' | 'cooldown',
  pool: LibraryExercise[],
): LibraryExercise | null => {
  const scoreOne = (ex: LibraryExercise): number => {
    let score = 0;
    if (ex.exerciseCategory === kind) score += BOOKEND_SCORING.taggedForBookend;
    if (ex.exerciseCategory === 'mobility') score += BOOKEND_SCORING.mobility;
    if (ex.movementPattern === 'mobility') score += BOOKEND_SCORING.mobilityPattern;
    if (ex.exerciseCategory === 'cardio') score += BOOKEND_SCORING.cardio;
    return score;
  };
  const scored = pool
    .filter(ex => ex.generationEnabled !== false && scoreOne(ex) > 0)
    .map(ex => ({ ex, score: scoreOne(ex) }))
    .sort((a, b) => (b.score - a.score) || a.ex.id.localeCompare(b.ex.id));
  return scored.length > 0 ? scored[0].ex : null;
};

// Emitted whether or not the library can fill it. A library with nothing
// suitable costs the client a locatable warm-up, never the warm-up itself —
// the entry still appears with its steps, just without a place on the map.
export const buildBookendExercise = (
  kind: 'warmup' | 'cooldown',
  block: { name: string; minutes: number; steps: string[] },
  le: LibraryExercise | null,
  idSuffix: string,
): Exercise => ({
  id: `gbk-${idSuffix}`,
  name: le ? le.name : block.name,
  targetMuscle: le?.targetMuscle || 'Full body',
  // Tracked by duration rather than sets, which is what these actually are.
  sets: 0,
  reps: '',
  isCardio: true,
  cardioMinutes: block.minutes,
  equipmentId: le?.equipmentId || 'manual',
  ...(le ? { libraryExerciseId: le.id } : {}),
  bookend: kind,
  notes: block.steps.join(' · '),
});

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
  // Full-body splits (and any split where a slot template repeats — e.g. two
  // Upper days) reuse the exact same slots on more than one day. Selection is
  // otherwise deterministic, so without this a client on a 3-day full-body
  // plan got the identical session three times: same squat, same press, same
  // row, every day. Tracked across the whole week and fed back in as a soft
  // preference — never a hard exclusion, since a repeat is still the right
  // pick when the library has nothing else for that pattern.
  const usedEarlierInWeek = new Set<string>();

  for (let d = 0; d < blueprintDays.length; d++) {
    const bpDay: BlueprintDay = blueprintDays[d];
    // Reuse is discouraged within a day, not across the week — the same
    // compound legitimately recurs on a Tuesday and a Friday.
    const usedInDay = new Set<string>();
    const musclesInDay = new Set<MuscleGroup>();
    const picked: { le: LibraryExercise; slot: ExerciseSlot; score: number }[] = [];
    const unfilledRequired: { slotId: string; movementPattern: MovementPattern }[] = [];

    for (const slot of [...bpDay.slots].sort((a, b) => a.priority - b.priority)) {
      const le = selectForSlot(slot, pool, profile, usedInDay, musclesInDay, usedEarlierInWeek);
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
    // Bookends are reserved off the top, so the fitter only ever competes with
    // training time — a session can never be squeezed until there is no room
    // left to warm up.
    const shape = shapeFor(profile.sessionMinutes);
    const trainingBudget = trainingMinutesAvailable(profile.sessionMinutes, shape);
    const measure = () => estimateDayMinutes(picked.map(p => {
      const { sets, reps, restSeconds } = prescriptionFor(p.slot, profile);
      return { sets, reps, restSeconds };
    }), 0);

    const droppedIds: string[] = [];
    while (measure() > trainingBudget) {
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
          detail: `"${bpDay.name}" needs ${measure()} min of required work but only ${trainingBudget} min is available after warm-up and cooldown`,
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

    // Always present, whatever the library contains. Training cold is a
    // beginner injury risk, and it is the first thing skipped when it is left
    // to chance.
    const { warmup, cooldown } = bookendsFor(shape);
    days.push({
      id: `gday-${d}`,
      name: bpDay.name,
      // Bookends bracket the working exercises, in the order they're done.
      exercises: [
        buildBookendExercise('warmup', warmup, selectBookendExercise('warmup', pool), `${d}-warmup`),
        ...picked.map((p, i) => buildExercise(p.le, p.slot, profile, `${d}-${i}`)),
        buildBookendExercise('cooldown', cooldown, selectBookendExercise('cooldown', pool), `${d}-cooldown`),
      ],
      warmup,
      cooldown,
      warmupSetsPerCompound: shape.warmupSetsPerCompound,
    });

    // Seeded from what actually survived the day, not from `picked` before
    // trimming — an exercise dropped for time was never really trained, so it
    // shouldn't cost itself a later day's variety.
    picked.forEach(p => usedEarlierInWeek.add(p.le.id));
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
      // The warm-up and cooldown are legitimately allowed to have no library
      // entry and no sets — they are emitted whether or not the library can
      // fill them, so holding them to the training-work rules would turn a
      // thin library into a failed plan.
      if (ex.bookend) return;
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

    // Counts this session's real warm-up and cooldown, not the old flat
    // five-minute allowance. The generator fits training work into
    // sessionMinutes minus both bookends; validating against a smaller,
    // stale allowance would quietly pass a day that actually overruns the
    // client's stated time — and the whole point of this check is to be an
    // independent guard, not a weaker one.
    const shape = shapeFor(profile.sessionMinutes);
    const minutes = estimateDayMinutes(day.exercises.filter(ex => !ex.bookend).map(ex => ({
      sets: ex.setDetails?.length || ex.sets || 0,
      reps: parseInt(ex.setDetails?.[0]?.reps || '0', 10) || 0,
      restSeconds: ex.setDetails?.[0]?.restSec ?? 60,
    })), shape.warmupMinutes + shape.cooldownMinutes);
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
      if (ex.bookend) return;
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
