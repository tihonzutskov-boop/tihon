// Type-only import: this file is also compiled to plain JS for the Express
// server (npm run build:engine), and erasing the import keeps that output
// standalone rather than pulling in types.ts at runtime.
import type {
  LibraryExercise, Gym, ExerciseSlot, BlueprintDay, PlanTemplate,
  ExperienceLevel, JointStressArea, WorkoutDay, Exercise, SetDetail,
  MovementPattern, MuscleGroup, SlotRole, FocusArea,
} from '../types.js';
// A real import, not type-only: the session's length decides its whole shape,
// so these run at generation time. Compiled alongside planGeneration into the
// engine build the server uses.
import { shapeFor, bookendsFor, maxBookendMinutes, zone2MinutesFor, regionsOfPatterns, BOOKEND_MINUTES, maxExercisesFor } from './sessionShape.js';
import type { SessionShape, SessionBookend } from './sessionShape.js';

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface GenerationProfile {
  goal: string;
  experience: ExperienceLevel;
  daysPerWeek: number;
  sessionMinutes: number;
  injuryAreas: JointStressArea[];
  /** Body areas the client asked to focus on. */
  focusAreas?: FocusArea[];
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
  (gym?.zones || []).forEach(z => {
    (z.equipmentIds || []).forEach(id => {
      // A zone an admin has marked as not allowing open floor does not
      // contribute it, whatever else might have put it in equipmentIds.
      if (id === 'eq-floor-mat' && z.floorSpace === false) return;
      ids.add(id);
    });
    if (z.floorSpace === true) ids.add('eq-floor-mat');
  });
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
// A warm-up or cool-down is picked by what it is tagged for and the muscles it
// drives (selectBookendExercise), never by movement pattern, so it doesn't
// need one. Leaving it without one also keeps it out of the main block: slots
// are filled by pattern, and a missing pattern matches none of them.
export const isBookendExercise = (ex: Pick<LibraryExercise, 'bookendRoles' | 'exerciseCategory'>): boolean =>
  (ex.bookendRoles?.length ?? 0) > 0 || ex.exerciseCategory === 'warmup' || ex.exerciseCategory === 'cooldown';

export const checkEligibility = (ex: LibraryExercise, ctx: EligibilityContext): EligibilityResult => {
  if (ex.generationEnabled !== true) return { eligible: false, reason: 'not_generation_enabled' };
  if (!ex.movementPattern && !isBookendExercise(ex)) return { eligible: false, reason: 'missing_movement_pattern' };
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
// The goals a client can choose are meant to feel different, so their rep
// ranges step apart rather than overlap: muscle gain 8-12, general fitness
// 12-15 (single-joint 14-18), weight loss 15-20. Endurance is no longer
// offered but still builds plans for clients who chose it earlier.
const GOAL_PRESCRIPTION: Record<string, { compound: Omit<ExerciseSlot, 'id' | 'movementPattern' | 'priority'>; isolation: Omit<ExerciseSlot, 'id' | 'movementPattern' | 'priority'> }> = {
  'Muscle gain': {
    compound: { setsMin: 3, setsMax: 4, repsMin: 8, repsMax: 10, restSeconds: 120, exerciseCategory: 'compound' },
    isolation: { setsMin: 2, setsMax: 3, repsMin: 10, repsMax: 12, restSeconds: 120, exerciseCategory: 'isolation' },
  },
  'Weight loss': {
    compound: { setsMin: 3, setsMax: 3, repsMin: 15, repsMax: 20, restSeconds: 45, exerciseCategory: 'compound' },
    isolation: { setsMin: 2, setsMax: 3, repsMin: 15, repsMax: 20, restSeconds: 30, exerciseCategory: 'isolation' },
  },
  'General fitness': {
    compound: { setsMin: 2, setsMax: 3, repsMin: 12, repsMax: 15, restSeconds: 90, exerciseCategory: 'compound' },
    isolation: { setsMin: 2, setsMax: 3, repsMin: 14, repsMax: 18, restSeconds: 60, exerciseCategory: 'isolation' },
  },
  'Endurance': {
    compound: { setsMin: 2, setsMax: 3, repsMin: 15, repsMax: 20, restSeconds: 30, exerciseCategory: 'compound' },
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
type SlotSpec = {
  pattern: MovementPattern; kind: 'compound' | 'isolation'; optional?: boolean;
  /** Sets for this slot whatever the goal prescribes elsewhere (the shoulder press is two). */
  sets?: number;
  /** See ExerciseSlot.preferVideo. */
  preferVideo?: boolean;
  /** See ExerciseSlot.dropLast. */
  dropLast?: boolean;
};

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

// A strength session: a squat, a press and a pull, then a hinge, an overhead
// press and a triceps exercise, then the abs. The first three are the session;
// the rest are trimmed from the end, abs first, when the time is short. The
// pull is a vertical one (a pulldown), the overhead press is two sets, and the
// abs are a follow-along video where the library has one.
const FULL_BODY: SlotSpec[] = [
  { pattern: 'squat', kind: 'compound' },
  { pattern: 'horizontal_push', kind: 'compound' },
  { pattern: 'vertical_pull', kind: 'compound' },
  { pattern: 'hinge', kind: 'compound', optional: true },
  { pattern: 'vertical_push', kind: 'compound', optional: true, sets: 2 },
  { pattern: 'elbow_extension', kind: 'isolation', optional: true },
  { pattern: 'core', kind: 'isolation', optional: true, preferVideo: true, dropLast: true },
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

// What focusing on a body area adds to a day: extra work for it, on the days
// that already train that part of the body. A pattern from `alongside` in the
// day's template is what marks such a day, so arms work lands on push and pull
// days rather than on leg day, and a full-body day, which has a bit of
// everything, takes every focus. `muscles` is what the area means when scoring
// an exercise for any slot — a glute focus tips a hinge slot toward a glute
// exercise too, not only the slot added for it.
type FocusExtra = SlotSpec & { alongside: MovementPattern[] | 'any' };
const FOCUS_WORK: Record<FocusArea, { muscles: MuscleGroup[]; extra: FocusExtra[] }> = {
  Glutes: {
    muscles: ['Glutes', 'Abductors'],
    extra: [{ pattern: 'hip_extension', kind: 'isolation', alongside: ['squat', 'hinge', 'lunge'] }],
  },
  Legs: {
    muscles: ['Quads', 'Hamstrings', 'Calves', 'Adductors'],
    extra: [
      { pattern: 'lunge', kind: 'compound', alongside: ['squat', 'hinge'] },
      { pattern: 'knee_flexion', kind: 'isolation', alongside: ['squat', 'hinge'] },
    ],
  },
  // Core work fits any day, so it does not wait for a lower-body day.
  Core: {
    muscles: ['Abs', 'Obliques'],
    extra: [{ pattern: 'core', kind: 'isolation', alongside: 'any' }],
  },
  Back: {
    muscles: ['Lats', 'Upper back', 'Lower back'],
    extra: [{ pattern: 'vertical_pull', kind: 'compound', alongside: ['horizontal_pull', 'vertical_pull'] }],
  },
  Chest: {
    muscles: ['Chest', 'Upper chest'],
    extra: [{ pattern: 'horizontal_adduction', kind: 'isolation', alongside: ['horizontal_push'] }],
  },
  Arms: {
    muscles: ['Biceps', 'Triceps', 'Forearms'],
    extra: [
      { pattern: 'elbow_flexion', kind: 'isolation', alongside: ['horizontal_pull', 'vertical_pull'] },
      { pattern: 'elbow_extension', kind: 'isolation', alongside: ['horizontal_push', 'vertical_push'] },
    ],
  },
  Shoulders: {
    muscles: ['Front delts', 'Side delts', 'Rear delts'],
    extra: [{ pattern: 'shoulder_abduction', kind: 'isolation', alongside: ['horizontal_push', 'vertical_push'] }],
  },
};

const focusExtrasFor = (template: SlotSpec[], focusAreas: FocusArea[]): (SlotSpec & { focusArea: FocusArea })[] => {
  const trained = new Set(template.map(sp => sp.pattern));
  return [...new Set(focusAreas)]
    .filter(area => FOCUS_WORK[area])
    .flatMap(area => FOCUS_WORK[area].extra
      .filter(x => x.alongside === 'any' || x.alongside.some(p => trained.has(p)))
      .map(({ pattern, kind }) => ({ pattern, kind, optional: true, focusArea: area })));
};

const focusMusclesOf = (focusAreas: FocusArea[] = []): Set<MuscleGroup> =>
  new Set(focusAreas.flatMap(area => FOCUS_WORK[area]?.muscles ?? []));

// Builds a complete blueprint from goal + days/week alone — no admin
// authoring required. An admin-authored blueprint always wins when one
// exists; this is what every other client falls back to.
//
// One aim's slots for one day, with that aim's own prescription already
// applied and priorities numbered locally from 1 — a combining caller
// renumbers them to sit after whichever blocks came before. Split out so
// buildCombinedBlueprint can call it once per selected aim without
// duplicating the goal → template → prescription logic.
// SLOT-1. Derived rather than written onto all ~25 template lines, because the
// mapping is exact and one rule is easier to keep honest than 25 hand-set
// values: what used to be required is primary; what was optional splits by
// whether dropping it costs the session a movement pattern (a compound —
// supporting) or only finishing work (an isolation — accessory).
// §2.2 — aim profiles. Each aim declares the same four fields, and the engine
// reads them rather than asking which aim it is holding. That is the point:
// mobility stops being "the aim that is different in kind" and becomes an aim
// with different values in the same fields, so nothing downstream needs a
// `goal === 'Mobility'` branch.
//
// `ownTemplate` is null for aims that build from the day's split; mobility
// carries its own because its session has no upper/lower or push/pull to
// split along.
export type OrderHeuristic = 'heaviest_first' | 'priority_first' | 'easier_range_to_demanding_range';

export interface AimProfile {
  intensityAxis: 'load' | 'pace_hr_power' | 'range_control';
  progressionAxis: 'load' | 'duration_or_pace' | 'usable_range';
  orderHeuristic: OrderHeuristic;
  ownTemplate: SlotSpec[] | null;
  /** Whether a day of this aim is named for the aim rather than the split. */
  namesOwnDays: boolean;
  /** GOALS_WITH_CONDITIONING, moved onto the profile where it belongs. */
  conditioningFinisher: boolean;
  /** Ends the session with easy zone-2 cardio, after the weights and before the cool-down. */
  zone2Finisher: boolean;
}

const AIM_PROFILES: Record<string, AimProfile> = {
  'Muscle gain': {
    intensityAxis: 'load', progressionAxis: 'load', orderHeuristic: 'heaviest_first',
    ownTemplate: null, namesOwnDays: false, conditioningFinisher: false, zone2Finisher: false,
  },
  // Zone-2 cardio takes the place of the conditioning finisher: ending a
  // session with both would stack two finishers on one tired client.
  'Weight loss': {
    intensityAxis: 'load', progressionAxis: 'load', orderHeuristic: 'heaviest_first',
    ownTemplate: null, namesOwnDays: false, conditioningFinisher: false, zone2Finisher: true,
  },
  'General fitness': {
    intensityAxis: 'load', progressionAxis: 'load', orderHeuristic: 'heaviest_first',
    ownTemplate: null, namesOwnDays: false, conditioningFinisher: false, zone2Finisher: false,
  },
  'Endurance': {
    intensityAxis: 'pace_hr_power', progressionAxis: 'duration_or_pace', orderHeuristic: 'priority_first',
    ownTemplate: null, namesOwnDays: false, conditioningFinisher: true, zone2Finisher: false,
  },
  'Mobility': {
    intensityAxis: 'range_control', progressionAxis: 'usable_range',
    orderHeuristic: 'easier_range_to_demanding_range',
    ownTemplate: MOBILITY, namesOwnDays: true, conditioningFinisher: false, zone2Finisher: false,
  },
};

export const aimProfile = (aim: string): AimProfile =>
  AIM_PROFILES[aim] || AIM_PROFILES[DEFAULT_GOAL];

// STRUCT-1: preparation, then primary work, then supporting and accessory in
// the later part of the same block — not a separate section.
const ROLE_ORDER: Record<SlotRole, number> = { primary: 0, supporting: 1, accessory: 2 };

// ORDER-1: role decides the coarse position; the aim's own heuristic decides
// the order inside a role. Only heaviest_first reorders anything today —
// priority_first and easier_range_to_demanding_range both defer to the
// template's authored sequence, which is already written in that order, so
// applying them is a no-op rather than a guess dressed up as a rule.
const orderMainBlock = (slots: ExerciseSlot[], heuristic: OrderHeuristic): ExerciseSlot[] =>
  [...slots].sort((a, b) => {
    const byRole = ROLE_ORDER[roleOf(a)] - ROLE_ORDER[roleOf(b)];
    if (byRole !== 0) return byRole;
    if (heuristic === 'heaviest_first') {
      const heaviness = (sl: ExerciseSlot) => (sl.exerciseCategory === 'compound' ? 0 : 1);
      const byHeaviness = heaviness(a) - heaviness(b);
      if (byHeaviness !== 0) return byHeaviness;
    }
    return a.priority - b.priority;
  });

const roleOfSpec = (spec: SlotSpec): SlotRole =>
  !spec.optional ? 'primary' : (spec.kind === 'compound' ? 'supporting' : 'accessory');

// Admin-authored blueprints predate SLOT-1 and carry no role, so they fall
// back to what they do carry. Anything droppable reads as accessory there —
// the safe reading, since it keeps the old single-bucket behaviour rather
// than promoting unknown slots into protected primary work.
const roleOf = (slot: ExerciseSlot): SlotRole =>
  slot.role ?? (slot.optional ? 'accessory' : 'primary');

const slotsForGoal = (goal: string, dayName: string, shape: SessionShape, focusAreas: FocusArea[] = []): ExerciseSlot[] => {
  const rx = GOAL_PRESCRIPTION[goal] || GOAL_PRESCRIPTION[DEFAULT_GOAL];
  const aim = aimProfile(goal);
  // An aim either brings its own template or builds from the day's split —
  // read off the profile rather than asked for by name.
  const base = aim.ownTemplate || DAY_TEMPLATES.find(t => t.match(dayName))?.slots || FULL_BODY;
  const essentials = shape.includeAccessories ? base : base.filter(sp => roleOfSpec(sp) === 'primary');
  const withFinisher: SlotSpec[] = aim.conditioningFinisher && shape.includeAccessories
    ? [...essentials, { pattern: 'conditioning', kind: 'isolation', optional: true }]
    : essentials;
  // Focus work goes onto days built from the split. An aim with its own
  // template (mobility) is a different kind of session, and a set of lateral
  // raises does not belong in it. Added even to a short session: the client
  // asked for it, and the duration fitter is what decides whether it fits.
  const focusExtras = aim.ownTemplate ? [] : focusExtrasFor(base, focusAreas);
  const specs: (SlotSpec & { focusArea?: FocusArea })[] = [...withFinisher, ...focusExtras];

  const built = specs.map((spec, i) => ({
    ...rx[spec.kind],
    // A slot with its own set count keeps it whatever the goal prescribes.
    ...(spec.sets !== undefined ? { setsMin: spec.sets, setsMax: spec.sets } : {}),
    ...(spec.preferVideo ? { preferVideo: true } : {}),
    ...(spec.dropLast ? { dropLast: true } : {}),
    id: `slot-${i}`, // placeholder — the caller (single- or combined-blueprint) assigns the real, namespaced id
    movementPattern: spec.pattern,
    priority: i + 1,
    optional: spec.optional,
    // Focus work ranks with the movements that make the session, ahead of
    // finishing work, whatever kind of exercise it is.
    role: spec.focusArea ? 'supporting' as const : roleOfSpec(spec),
    ...(spec.focusArea ? { focusArea: spec.focusArea } : {}),
    // Conditioning and mobility work sit outside the compound/isolation
    // split, so leaving the category unset lets any exercise tagged for
    // that pattern fill the slot rather than none.
    exerciseCategory: MOBILITY_PATTERNS.has(spec.pattern) || spec.pattern === 'conditioning'
      ? undefined
      : rx[spec.kind].exerciseCategory,
  }));

  // STRUCT-1 / ORDER-1 applied once, here, so every caller gets a main block
  // already in training order.
  return orderMainBlock(built, aim.orderHeuristic);
};

export const buildDefaultBlueprint = (goal: string, daysPerWeek: number, sessionMinutes = 60): BlueprintDay[] =>
  buildCombinedBlueprint([goal], daysPerWeek, sessionMinutes);

// MIXAIM-1: aims are distributed across days, not mixed inside a session.
// This replaces the earlier interleave-and-cap approach entirely — a day no
// longer draws slots from more than one aim, so there is nothing to interleave
// and no shared accessory budget to police.
//
// MIXAIM-6: days are handed out in aim-priority order — the ranking the
// client gave their goals at intake, not the order they happened to tap them
// in. Two aims over three days gives the higher-priority aim the odd day.
//
// Not yet implemented from MIXAIM-6: alternating that odd day between the two
// aims from one week to the next. The generator builds a single week with no
// notion of which week it is, so there is nothing to alternate against — it
// needs a week index carried in from the plan's start date.
export interface DayAims {
  primary: string;
  /** MIXAIM-1: optional. Null whenever the client selected a single aim. */
  secondary: string | null;
}

export const assignAimsToDays = (goals: string[], dayCount: number, supporting: string[] = []): DayAims[] => {
  const aims = goals.length > 0 ? goals : [DEFAULT_GOAL];
  // Supporting aims are the client's secondary goals. They ride along on the
  // days the main aims own and never own a day themselves — otherwise a
  // "secondary" mobility goal would take a whole training day off the primary
  // goal. An aim that is already a main aim is not supporting anything.
  const extras = supporting.filter((a, i) => !aims.includes(a) && supporting.indexOf(a) === i);
  return Array.from({ length: dayCount }, (_, i) => ({
    primary: aims[i % aims.length],
    // With no supporting aims: one aim has no secondary, and with more the
    // day's secondary is the next aim in the rotation — for the two-aim case
    // simply the other one, which is what MIXAIM-6 describes. Supporting aims,
    // when the client chose any, take that slot instead.
    secondary: extras.length > 0
      ? extras[i % extras.length]
      : aims.length > 1 ? aims[(i + 1) % aims.length] : null,
  }));
};

// A mobility day is not an "Upper" or a "Full Body" day — its slots ignore the
// split entirely (see slotsForGoal), so carrying the split's name onto it would
// describe the day as something it isn't.
const dayLabel = (aim: string, splitName: string, aimDayIndex: number, aimHasManyDays: boolean): string =>
  aimProfile(aim).namesOwnDays
    ? (aimHasManyDays ? `${aim} ${aimDayIndex + 1}` : aim)
    : splitName;

export const buildCombinedBlueprint = (
  goals: string[], daysPerWeek: number, sessionMinutes = 60, supporting: string[] = [], focusAreas: FocusArea[] = [],
): BlueprintDay[] => {
  // Session length shapes what gets built, rather than trimming what was built.
  // A short session is composed of the priority work only; it is not a long
  // session with the end cut off.
  const shape = shapeFor(sessionMinutes);
  const aimByDay = assignAimsToDays(goals, Math.max(daysPerWeek, 1), supporting);

  const dayCountPerAim = aimByDay.reduce<Record<string, number>>((acc, day) => {
    acc[day.primary] = (acc[day.primary] || 0) + 1;
    return acc;
  }, {});

  // Each aim gets a split sized to the days it actually has, rather than a
  // slice of one week-level split. Slicing is what an earlier version did, and
  // it fails badly on an alternating split: over four days, aims take every
  // other day, so the strength aim drew Upper, Upper and the client never
  // trained their legs at all — a straight FREQ-1 violation. Two days of
  // strength work is a two-day full-body split, which is what this produces.
  const namesPerAim: Record<string, string[]> = {};
  Object.entries(dayCountPerAim).forEach(([aim, count]) => {
    namesPerAim[aim] = selectSplit(count).dayNames;
  });
  const seenPerAim: Record<string, number> = {};

  return aimByDay.map((day, dayIdx) => {
    const aimDayIndex = seenPerAim[day.primary] ?? 0;
    seenPerAim[day.primary] = aimDayIndex + 1;
    const splitName = namesPerAim[day.primary][aimDayIndex];

    // MIXAIM-3: this block takes its reps, rest and intensity from the day's
    // primary aim alone — never blended or averaged with the other aim's,
    // even where the two share a movement pattern.
    const primarySlots = slotsForGoal(day.primary, splitName, shape, focusAreas);

    // MIXAIM-7: the secondary aim adds real work, but only its essential
    // (primary-role) slots. Its own supporting and accessory work is by
    // definition less important than that, and pulling in a whole second block
    // would put the day back to carrying two full sessions — the thing
    // aim-per-day distribution exists to avoid.
    //
    // MIXAIM-2 as narrowed: a secondary-aim slot is created because the day
    // explicitly has a secondary aim, never because some exercise happens to
    // carry a secondary adaptation.
    //
    // These slots keep their own aim's prescription rather than borrowing the
    // primary aim's. MIXAIM-3 forbids blending two aims into a hybrid
    // prescription; it is not a reason to prescribe hip mobility at a muscle-
    // gain day's 8-12 reps and 120s rest, which would describe the work as
    // something it isn't.
    const secondarySlots = day.secondary
      ? slotsForGoal(day.secondary, splitName, shape)
          .filter(sl => roleOf(sl) === 'primary')
          .map(sl => ({ ...sl, aimTier: 'secondary' as const }))
      : [];

    const slots = [...primarySlots, ...secondarySlots];

    return {
      id: `defbp-${dayIdx}`,
      name: dayLabel(day.primary, splitName, aimDayIndex, (dayCountPerAim[day.primary] || 0) > 1),
      primaryAim: day.primary,
      secondaryAim: day.secondary,
      // Sized to the session, whatever else the day holds. Whether it fits is
      // decided at generation, once the day's weights are known.
      ...(aimProfile(day.primary).zone2Finisher ? { zone2Minutes: zone2MinutesFor(sessionMinutes) } : {}),
      slots: slots.map((spec, i) => ({ ...spec, id: `defslot-${dayIdx}-${i}`, priority: i + 1 })),
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
  // A slot that asks for a video (the abs) takes one over any other candidate
  // for it, and otherwise falls back to whatever the library has.
  preferredVideo: 50,
  // An exercise that trains an area the client asked to focus on. Smaller
  // than usedEarlierInWeek, so a focus never brings back the same exercise
  // every day when there is an alternative.
  focusMuscle: 10,
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
  if (slot.preferVideo && ex.exerciseType === 'video') score += SCORING.preferredVideo;
  const focus = focusMusclesOf(profile.focusAreas);
  if ((ex.primaryMuscles || []).some(m => focus.has(m))) score += SCORING.focusMuscle;
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
    ex.movementPattern === slot.movementPattern &&
    !alreadyUsedIds.has(ex.id) &&
    // Cardio belongs in the warm-up or the cooldown, never in the training
    // block. Enforced here rather than in checkEligibility, which answers a
    // different question — whether this person can safely perform this
    // exercise at this gym — and whose result also feeds bookend selection,
    // so excluding cardio there left the warm-up with nothing to be.
    //
    // A filter rather than a scoring penalty: a penalty only made cardio
    // unlikely in a main slot, and it still won whenever nothing else matched
    // the pattern, which is exactly when it was least wanted.
    ex.exerciseCategory !== 'cardio'
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
  secondsPerRep: 2,
  setupSecondsPerExercise: 60,
  warmupMinutes: 5,
};

export const estimateExerciseSeconds = (sets: number, reps: number, restSeconds: number): number =>
  sets * reps * TIMING.secondsPerRep + Math.max(sets - 1, 0) * restSeconds + TIMING.setupSecondsPerExercise;

// bookendMinutes defaults to the old flat warm-up allowance so existing
// callers keep their previous behaviour; the generator passes the real
// warm-up + cooldown for the session's tier.
export const estimateDayMinutes = (
  // `fixedMinutes` is for something that runs a set length however it is done,
  // such as a follow-along video, in place of counting sets and reps.
  exercises: { sets: number; reps: number; restSeconds: number; fixedMinutes?: number }[],
  bookendMinutes: number = TIMING.warmupMinutes,
): number => {
  const seconds = exercises.reduce((a, e) =>
    a + (e.fixedMinutes !== undefined ? e.fixedMinutes * 60 : estimateExerciseSeconds(e.sets, e.reps, e.restSeconds)), 0);
  return Math.round(seconds / 60) + bookendMinutes;
};

// ---------------------------------------------------------------------------
// Prescription
// ---------------------------------------------------------------------------

// Rest values come straight from the goal table above, so rounding only has to
// keep them on steps a timer can show. Five-second steps under a minute leave
// every value in that table exactly as written, 45 s included.
const REST_STEP_SECONDS = 5;
// Past a minute the unit people actually use changes. Nobody counts 140
// seconds; they wait two minutes. Half-minute steps above the boundary keep
// every long rest expressible as "1 min", "1:30 min", "2 min".
const LONG_REST_BOUNDARY_SECONDS = 60;
const LONG_REST_STEP_SECONDS = 30;

export const roundRestSeconds = (seconds: number): number => {
  const step = seconds > LONG_REST_BOUNDARY_SECONDS ? LONG_REST_STEP_SECONDS : REST_STEP_SECONDS;
  return Math.max(REST_STEP_SECONDS, Math.round(seconds / step) * step);
};

const prescriptionFor = (slot: ExerciseSlot, profile: GenerationProfile) => {
  const sets = profile.experience === 'Beginner' ? slot.setsMin : slot.setsMax;
  const reps = Math.round((slot.repsMin + slot.repsMax) / 2);
  // Rest is the same whatever the session length; a longer session spends its
  // extra time on warm-up, ramp-up sets and accessories instead.
  const restSeconds = roundRestSeconds(slot.restSeconds);
  return { sets, reps, restSeconds };
};

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export type GenerationFailureReason =
  'no_candidate_for_slot' | 'cannot_fit_duration' | 'no_blueprint_days' | 'no_day_could_be_built';

export interface GenerationFailure {
  ok: false;
  reason: GenerationFailureReason;
  detail: string;
  // DROP-2: a week-level failure is one the client's aims and split cannot
  // satisfy at all — regenerating the week is the fix. Day-level problems no
  // longer arrive here; they come back on a successful result as dayFailures.
  scope: 'week';
}

// DROP-2: one day that cannot be built fails that day only. The rest of the
// week still generates and is delivered, and the failed day is reported for
// the admin queue — the fix there is usually a same-day exercise swap, not
// regenerating anything.
export interface DayFailure {
  dayName: string;
  reason: GenerationFailureReason;
  detail: string;
  scope: 'day';
}

export interface GenerationSuccess {
  ok: true;
  days: WorkoutDay[];
  decisions: SlotDecision[];
  dayFailures: DayFailure[];
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
  // A follow-along video (the abs) is watched and followed, not counted in
  // sets: it is timed by its own length, like the cardio.
  if (le.exerciseType === 'video') {
    return {
      id: `gex-${idSuffix}`,
      name: le.name,
      targetMuscle: le.targetMuscle || 'Full body',
      slotIntentId: slot.id,
      exerciseInstanceId: `${slot.id}:${le.id}`,
      sets: 0,
      reps: '',
      isCardio: true,
      cardioMinutes: videoMinutesOf(le),
      equipmentId: le.equipmentId || 'manual',
      libraryExerciseId: le.id,
    };
  }
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
    // DATA-1: the slot's own id is what persists through a substitution; the
    // instance key pairs it with whichever exercise is currently filling it.
    slotIntentId: slot.id,
    exerciseInstanceId: `${slot.id}:${le.id}`,
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
// dayMuscleMatch is per overlapping muscle and deliberately small: three
// overlaps (24) still lose to a single explicit bookend tag (30), so an admin's
// tagging always outranks the day, and the day only breaks ties within the
// group of exercises already marked for this end of the session.
const BOOKEND_SCORING = { taggedForBookend: 30, mobility: 20, mobilityPattern: 15, cardio: 10, dayMuscleMatch: 8 };

// Dynamic stretching and the cooldown stretches are follow-along videos from
// the library, each its own exercise in the day. Chosen for the muscles the day
// trains, and rotated through the week so one video does not play every day.
const BOOKEND_VIDEO_SCORING = { tagged: 30, dayMuscleMatch: 8, usedEarlierInWeek: -45 };

// A video whose length cannot be read still has to be fitted into a block, so
// it is counted as this. Short enough that guessing wrong costs little.
const DEFAULT_VIDEO_MINUTES = 3;
// A set of videos may run this far past the time asked of it rather than leave
// the block short by a video that is only a little too long.
const VIDEO_OVERSHOOT_MINUTES = 2;

/**
 * Minutes a video runs, read from the free-text length an admin typed
 * ("10 min", "10 minutes", "12:30", "1:05:00", "90 sec"). Null when there is
 * nothing to read — the label is whatever was typed, so "Follow-along video"
 * or an empty field is expected, and the caller falls back to a fixed length.
 */
export const parseVideoMinutes = (label?: string | null): number | null => {
  const text = (label || '').trim().toLowerCase();
  if (!text) return null;
  const clock = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (clock) {
    const [a, b] = [Number(clock[1]), Number(clock[2])];
    const seconds = clock[3] === undefined ? a * 60 + b : a * 3600 + b * 60 + Number(clock[3]);
    return seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : null;
  }
  const mins = text.match(/(\d+(?:[.,]\d+)?)\s*(?:minutes?|mins?|m)\b/);
  if (mins) {
    const n = Number(mins[1].replace(',', '.'));
    return n > 0 ? Math.max(1, Math.round(n)) : null;
  }
  const secs = text.match(/(\d+)\s*(?:seconds?|secs?|s)\b/);
  if (secs && Number(secs[1]) > 0) return Math.max(1, Math.round(Number(secs[1]) / 60));
  return null;
};

export const videoMinutesOf = (ex: Pick<LibraryExercise, 'videoDurationLabel'>): number =>
  parseVideoMinutes(ex.videoDurationLabel) ?? DEFAULT_VIDEO_MINUTES;

const isTaggedVideo = (ex: LibraryExercise, kind: 'warmup' | 'cooldown'): boolean =>
  ex.exerciseType === 'video' && (!!ex.bookendRoles?.includes(kind) || ex.exerciseCategory === kind);

/**
 * The videos that make up the dynamic stretching (warm-up) or the stretches
 * (cooldown), adding up to about `targetMinutes`. Only videos tagged for this
 * end are considered. Best first — the day's muscles, then ones not used earlier
 * in the week — taking each that still fits and passing over one that does not.
 * Empty when there is no time to fill or nothing tagged fits, and the caller
 * writes the stretching out instead.
 */
export const selectBookendVideos = (
  kind: 'warmup' | 'cooldown',
  pool: LibraryExercise[],
  targetMinutes: number,
  dayMuscles: Set<MuscleGroup> | MuscleGroup[] = [],
  options: {
    usedEarlierInWeek?: Set<string>;
    /** The most these videos may add up to, whatever the target: the session's room for them. */
    maxMinutes?: number;
  } = {},
): LibraryExercise[] => {
  if (targetMinutes <= 0) return [];
  const trained = dayMuscles instanceof Set ? dayMuscles : new Set(dayMuscles);
  const limit = Math.min(targetMinutes + VIDEO_OVERSHOOT_MINUTES, options.maxMinutes ?? Infinity);
  const ranked = pool
    .filter(ex => ex.generationEnabled !== false && isTaggedVideo(ex, kind))
    .map(ex => {
      let score = BOOKEND_VIDEO_SCORING.tagged;
      for (const m of ex.primaryMuscles || []) if (trained.has(m)) score += BOOKEND_VIDEO_SCORING.dayMuscleMatch;
      if (options.usedEarlierInWeek?.has(ex.id)) score += BOOKEND_VIDEO_SCORING.usedEarlierInWeek;
      return { ex, score, minutes: videoMinutesOf(ex) };
    })
    .sort((a, b) => (b.score - a.score) || a.ex.id.localeCompare(b.ex.id));
  const chosen: LibraryExercise[] = [];
  let total = 0;
  for (const c of ranked) {
    if (total >= targetMinutes) break;
    if (total + c.minutes > limit) continue;
    chosen.push(c.ex);
    total += c.minutes;
  }
  return chosen;
};

/** A follow-along video as its own entry at one end of the session. */
export const buildVideoBookendExercise = (
  kind: 'warmup' | 'cooldown',
  le: LibraryExercise,
  idSuffix: string,
): Exercise => ({
  id: `gbk-${idSuffix}`,
  name: le.name,
  targetMuscle: le.targetMuscle || 'Full body',
  sets: 0,
  reps: '',
  isCardio: true,
  cardioMinutes: videoMinutesOf(le),
  equipmentId: le.equipmentId || 'manual',
  libraryExerciseId: le.id,
  bookend: kind,
  notes: 'Follow along with the video.',
});

// The machine or movement an end of the session is built around: the cardio
// and the walk. Follow-along videos are never this — they are the stretching
// that follows it, chosen by selectBookendVideos.
//
// With `cardioFirst` (how every plan is built) it is a cardio machine: a
// treadmill or bike if the gym has one, otherwise any cardio machine, and only
// with no cardio at all does it fall back to the best-tagged exercise. Without
// it a mobility exercise tagged for the end could outscore every machine, and the
// ten minutes of cardio a session opens with became a stretching routine.
export const selectBookendExercise = (
  kind: 'warmup' | 'cooldown',
  pool: LibraryExercise[],
  // What this day actually trains. A warm-up prepares the tissue about to be
  // loaded, so a leg day should be warmed up on something that drives the legs
  // and an upper day on something that drives the upper body. Optional, and an
  // empty set simply scores nothing — every existing caller keeps its old
  // behaviour without passing it.
  dayMuscles: Set<MuscleGroup> | MuscleGroup[] = [],
  options: { cardioFirst?: boolean } = {},
): LibraryExercise | null => {
  if (options.cardioFirst) {
    const cardio = pool.filter(ex => ex.exerciseCategory === 'cardio');
    const tiers = [cardio.filter(ex => isTreadmillExercise(ex) || isBikeExercise(ex)), cardio];
    for (const tier of tiers) {
      const found = tier.length > 0 ? selectBookendExercise(kind, tier, dayMuscles) : null;
      if (found) return found;
    }
  }
  const trained = dayMuscles instanceof Set ? dayMuscles : new Set(dayMuscles);
  const scoreOne = (ex: LibraryExercise): number => {
    let score = 0;
    // Counted per muscle rather than as a yes/no, so on a lower day a
    // stairmaster (quads + glutes) is picked over a treadmill (quads only).
    for (const m of ex.primaryMuscles || []) {
      if (trained.has(m)) score += BOOKEND_SCORING.dayMuscleMatch;
    }
    // Explicitly marked for this bookend. The legacy exerciseCategory check
    // below still counts, so exercises tagged before bookendRoles existed keep
    // working without being re-tagged.
    if (ex.bookendRoles?.includes(kind)) score += BOOKEND_SCORING.taggedForBookend;
    if (ex.exerciseCategory === kind) score += BOOKEND_SCORING.taggedForBookend;
    if (ex.exerciseCategory === 'mobility') score += BOOKEND_SCORING.mobility;
    if (ex.movementPattern === 'mobility') score += BOOKEND_SCORING.mobilityPattern;
    if (ex.exerciseCategory === 'cardio') score += BOOKEND_SCORING.cardio;
    return score;
  };
  const scored = pool
    .filter(ex => ex.generationEnabled !== false && ex.exerciseType !== 'video' && scoreOne(ex) > 0)
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
  // Named for the exercise being done, with the note below saying what to do
  // on it. An earlier version titled this "Warm-up" instead, because a bare
  // machine name read as equipment being prescribed with no instruction. The
  // note is what fixes that: "Treadmill" followed by "easy pace, enough to
  // raise your heart rate" is a usable instruction, where "Treadmill" alone
  // was not. Falls back to the block name when the library cannot fill it.
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
  // The exercise's own instruction for this end of the session, falling back
  // to the day's generic steps when an admin has not written one — a thin
  // library still produces a bookend the client can follow.
  notes: (kind === 'warmup' ? le?.warmupNote : le?.cooldownNote)?.trim()
    || block.steps.join(' · '),
});

// Whether an exercise is done on a treadmill, or on a bike — the machines the
// cardio at each end of a session is meant to be on. Read from the equipment it
// needs, or failing that from its name, since a library entry may be tagged with
// either.
const usesEquipment = (ex: LibraryExercise, id: RegExp): boolean =>
  (ex.requiredEquipmentIds || []).some(e => id.test(e)) || id.test(ex.name || '');
export const isTreadmillExercise = (ex: LibraryExercise): boolean => usesEquipment(ex, /treadmill/i);
export const isBikeExercise = (ex: LibraryExercise): boolean => usesEquipment(ex, /bike|cycl/i);

// Zone 2 is steady cardio at a pace where you can still hold a conversation,
// and it is done on the treadmill. A gym with no treadmill gets whatever other
// cardio it has; among equal choices one not done earlier in the week is
// preferred, so a client is not on the same machine every session.
export const selectZone2Exercise = (
  pool: LibraryExercise[],
  usedEarlierInWeek: Set<string> = new Set(),
): LibraryExercise | null => {
  const candidates = pool.filter(ex => ex.generationEnabled !== false && ex.exerciseCategory === 'cardio');
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) =>
    (Number(isTreadmillExercise(b)) - Number(isTreadmillExercise(a)))
    || (Number(usedEarlierInWeek.has(a.id)) - Number(usedEarlierInWeek.has(b.id)))
    || a.id.localeCompare(b.id)
  )[0];
};

const ZONE2_NOTE = 'Keep it easy and steady: a pace where you could still talk in full sentences, '
  + 'around 6 or 7 out of 10 effort. Stay at that pace for the whole time.';

export const buildZone2Exercise = (le: LibraryExercise, minutes: number, idSuffix: string): Exercise => ({
  id: `gz2-${idSuffix}`,
  name: le.name,
  targetMuscle: 'Zone 2 cardio',
  sets: 0,
  reps: '',
  isCardio: true,
  cardioMinutes: minutes,
  equipmentId: le.equipmentId || 'manual',
  libraryExerciseId: le.id,
  finisher: 'zone2',
  notes: ZONE2_NOTE,
});

// Zone 2 is the first thing to give when the weights need the time: it shrinks
// in steps down to this floor, and below it is left out for that day. The main
// lifts are never cut for it.
const ZONE2_FLOOR_MINUTES = 5;
const ZONE2_STEP_MINUTES = 5;

export const generatePlan = (
  blueprint: PlanTemplate,
  library: LibraryExercise[],
  gym: Gym | null | undefined,
  profile: GenerationProfile,
): GenerationResult => {
  const blueprintDays = blueprint.blueprintDays || [];
  if (blueprintDays.length === 0) {
    return { ok: false, reason: 'no_blueprint_days', scope: 'week', detail: `Template ${blueprint.id} has no blueprint days` };
  }

  const ctx: EligibilityContext = { profile, availableEquipmentIds: gymEquipmentIds(gym) };
  const pool = eligibleExercises(library, ctx);

  const days: WorkoutDay[] = [];
  const decisions: SlotDecision[] = [];
  // DROP-2: collected rather than returned. A day that cannot be built stops
  // that day, not the week.
  const dayFailures: DayFailure[] = [];
  // Full-body splits (and any split where a slot template repeats — e.g. two
  // Upper days) reuse the exact same slots on more than one day. Selection is
  // otherwise deterministic, so without this a client on a 3-day full-body
  // plan got the identical session three times: same squat, same press, same
  // row, every day. Tracked across the whole week and fed back in as a soft
  // preference — never a hard exclusion, since a repeat is still the right
  // pick when the library has nothing else for that pattern.
  const usedEarlierInWeek = new Set<string>();
  // Warm-up and cooldown videos used so far this week, per end, so several
  // videos rotate instead of one playing every day.
  const bookendVideosUsed = { warmup: new Set<string>(), cooldown: new Set<string>() };

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
    // The warm-up and cooldown are chosen before the weights are fitted, since
    // the videos in them set their own length and that length comes off the
    // training time. Each is the cardio (or walk) it is built around, then
    // stretching: follow-along videos from the library when there are tagged
    // ones that fit, written out when there are not. They are matched to the
    // muscles the day was built to train, which is the same set whether or not
    // an exercise is later dropped for time.
    const regions = regionsOfPatterns(picked.map(p => p.slot.movementPattern));
    const minutesFor = BOOKEND_MINUTES[shape.band];
    const cardioMinutes = Math.min(minutesFor.cardio, shape.warmupMinutes);
    const walkMinutes = Math.min(minutesFor.walk, shape.cooldownMinutes);
    const allowedBookendMinutes = maxBookendMinutes(profile.sessionMinutes);
    const stretchable = shape.band !== 'short';
    const warmupVideos = stretchable
      ? selectBookendVideos('warmup', pool, shape.warmupMinutes - cardioMinutes, musclesInDay, {
          usedEarlierInWeek: bookendVideosUsed.warmup,
          maxMinutes: allowedBookendMinutes - cardioMinutes - shape.cooldownMinutes,
        })
      : [];
    const warmupVideoMinutes = warmupVideos.reduce((sum, v) => sum + videoMinutesOf(v), 0);
    const warmupTotal = warmupVideos.length > 0 ? cardioMinutes + warmupVideoMinutes : shape.warmupMinutes;
    const cooldownVideos = stretchable
      ? selectBookendVideos('cooldown', pool, shape.cooldownMinutes - walkMinutes, musclesInDay, {
          usedEarlierInWeek: bookendVideosUsed.cooldown,
          maxMinutes: allowedBookendMinutes - warmupTotal - walkMinutes,
        })
      : [];
    const cooldownVideoMinutes = cooldownVideos.reduce((sum, v) => sum + videoMinutesOf(v), 0);
    const cooldownTotal = cooldownVideos.length > 0 ? walkMinutes + cooldownVideoMinutes : shape.cooldownMinutes;
    const blocks = bookendsFor(shape, regions, { warmup: warmupVideos.length > 0, cooldown: cooldownVideos.length > 0 });
    const warmup = { ...blocks.warmup, minutes: warmupTotal };
    const cooldown = { ...blocks.cooldown, minutes: cooldownTotal };
    const warmupLe = selectBookendExercise('warmup', pool, musclesInDay, { cardioFirst: true });
    const cooldownLe = selectBookendExercise('cooldown', pool, musclesInDay, { cardioFirst: true });
    const trainingBudget = Math.max(0, profile.sessionMinutes - warmup.minutes - cooldown.minutes);
    // The zone-2 block, for an aim that ends its session with one. Its minutes
    // come out of the training time, so the weights are fitted into what is
    // left. With no cardio exercise at this gym there is nothing to put there:
    // the day is built without it, and the gap is recorded below.
    const zoneTarget = bpDay.zone2Minutes ?? 0;
    const zoneLibraryExercise = zoneTarget > 0 ? selectZone2Exercise(pool, usedEarlierInWeek) : null;
    let zoneMinutes = zoneLibraryExercise ? zoneTarget : 0;
    const availableForWeights = () => trainingBudget - zoneMinutes;
    const measure = () => estimateDayMinutes(picked.map(p => {
      if (p.le.exerciseType === 'video') return { sets: 0, reps: 0, restSeconds: 0, fixedMinutes: videoMinutesOf(p.le) };
      const { sets, reps, restSeconds } = prescriptionFor(p.slot, profile);
      return { sets, reps, restSeconds };
    }), 0);

    // DROP-1: whole exercises come out, never partial sets, in this order —
    // every secondary-aim exercise first (MIXAIM-7: all of it ranks below any
    // primary-aim work, whatever its own role), then primary-aim accessory,
    // then primary-aim supporting, then the work added for the client's focus
    // areas. So a session sheds the second aim before it sheds finishing work,
    // and finishing work before it gives up a movement pattern; what the
    // client explicitly asked for goes last. Within a tier the
    // lowest-priority exercise goes first. Primary-aim primary work is never
    // dropped; a day that still doesn't fit is DROP-2's case.
    const isSecondary = (sl: ExerciseSlot) => sl.aimTier === 'secondary';
    const isFocus = (sl: ExerciseSlot) => !!sl.focusArea && !isSecondary(sl);
    // The abs are the exception: they hold their place through all of it and
    // are the last optional exercise to go, after the focus areas too.
    const DROP_TIERS: ((sl: ExerciseSlot) => boolean)[] = [
      isSecondary,
      sl => !isSecondary(sl) && !isFocus(sl) && !sl.dropLast && roleOf(sl) === 'accessory',
      sl => !isSecondary(sl) && !isFocus(sl) && !sl.dropLast && roleOf(sl) === 'supporting',
      isFocus,
      sl => !isSecondary(sl) && !!sl.dropLast,
    ];

    // The next exercise to give up, by the tiers above, or -1 when only the
    // main work is left.
    const nextToDrop = (): number => {
      let dropIdx = -1;
      for (const inTier of DROP_TIERS) {
        let worstPriority = -Infinity;
        picked.forEach((p, i) => {
          if (inTier(p.slot) && p.slot.priority > worstPriority) {
            worstPriority = p.slot.priority;
            dropIdx = i;
          }
        });
        if (dropIdx !== -1) break;
      }
      return dropIdx;
    };

    const droppedIds: string[] = [];

    // A session holds at most so many exercises, whatever is asked of it: 5 at
    // 45 minutes, 6 at 60, 7 at 75. Two goals each bring a block of their own,
    // and each focus area brings more; together they made thirteen. The same
    // order decides what goes: the second goal's copies of the lifts first, then
    // finishing work, then the day's other lifts, then the client's own focus
    // areas, and the abs last.
    const exerciseCap = maxExercisesFor(profile.sessionMinutes);
    while (picked.length > exerciseCap) {
      const idx = nextToDrop();
      if (idx === -1) break;
      droppedIds.push(picked[idx].slot.id);
      picked.splice(idx, 1);
    }

    while (measure() > availableForWeights()) {
      const dropIdx = nextToDrop();
      if (dropIdx === -1 && zoneMinutes > 0) {
        // Every optional lift is gone and the main lifts still do not fit
        // alongside the cardio. The cardio gives next: shorter, then not at all.
        zoneMinutes = zoneMinutes > ZONE2_FLOOR_MINUTES ? Math.max(ZONE2_FLOOR_MINUTES, zoneMinutes - ZONE2_STEP_MINUTES) : 0;
        continue;
      }
      if (dropIdx === -1) {
        // Every accessory and supporting exercise is already gone and the
        // primary work still overruns. Primary work is never cut to fit, and a
        // partial primary prescription is never delivered, so this day stops
        // here and the week carries on without it.
        dayFailures.push({
          dayName: bpDay.name,
          reason: 'cannot_fit_duration',
          scope: 'day',
          detail: `"${bpDay.name}" needs ${measure()} min of primary work but only ${trainingBudget} min is available after warm-up and cooldown`,
        });
        break;
      }
      droppedIds.push(picked[dropIdx].slot.id);
      picked.splice(dropIdx, 1);
    }

    if (measure() > availableForWeights()) continue;  // recorded just above

    if (picked.length === 0) {
      const wanted = bpDay.slots.map(sl => sl.movementPattern).join(', ');
      dayFailures.push({
        dayName: bpDay.name,
        reason: 'no_candidate_for_slot',
        scope: 'day',
        detail: `Nothing at this gym can fill any slot in "${bpDay.name}" (needed: ${wanted})`,
      });
      continue;
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

    // What became of the zone-2 block, so an admin can see why a day has none:
    // no cardio at the gym, or no time left for it beside the main lifts.
    if (zoneTarget > 0) {
      decisions.push({
        dayName: bpDay.name,
        slotId: 'zone2',
        movementPattern: 'zone2_cardio',
        selectedExerciseId: zoneMinutes > 0 && zoneLibraryExercise ? zoneLibraryExercise.id : '',
        selectedExerciseName: zoneMinutes > 0 && zoneLibraryExercise ? zoneLibraryExercise.name : '',
        score: 0,
        ...(zoneMinutes > 0 ? {} : {
          dropped: true,
          droppedReason: zoneLibraryExercise ? 'duration' as const : 'no_candidate' as const,
        }),
      });
    }

    // Always present, whatever the library contains. Training cold is a
    // beginner injury risk, and it is the first thing skipped when it is left
    // to chance.
    days.push({
      id: `gday-${d}`,
      name: bpDay.name,
      // Bookends bracket the working exercises, in the order they're done; the
      // zone-2 block, when there is one, closes the weights before the cooldown.
      exercises: [
        // The cardio shows its own minutes, 10, whether the rest of the warm-up
        // is videos after it or the written stretching listed beneath it.
        buildBookendExercise('warmup', { ...warmup, minutes: cardioMinutes }, warmupLe, `${d}-warmup`),
        ...warmupVideos.map((v, i) => buildVideoBookendExercise('warmup', v, `${d}-warmup-v${i}`)),
        ...picked.map((p, i) => buildExercise(p.le, p.slot, profile, `${d}-${i}`)),
        ...(zoneMinutes > 0 && zoneLibraryExercise ? [buildZone2Exercise(zoneLibraryExercise, zoneMinutes, `${d}`)] : []),
        buildBookendExercise('cooldown', { ...cooldown, minutes: walkMinutes }, cooldownLe, `${d}-cooldown`),
        ...cooldownVideos.map((v, i) => buildVideoBookendExercise('cooldown', v, `${d}-cooldown-v${i}`)),
      ],
      warmup,
      cooldown,
      warmupSetsPerCompound: shape.warmupSetsPerCompound,
    });

    // Seeded from what actually survived the day, not from `picked` before
    // trimming — an exercise dropped for time was never really trained, so it
    // shouldn't cost itself a later day's variety.
    picked.forEach(p => usedEarlierInWeek.add(p.le.id));
    if (zoneMinutes > 0 && zoneLibraryExercise) usedEarlierInWeek.add(zoneLibraryExercise.id);
    warmupVideos.forEach(v => bookendVideosUsed.warmup.add(v.id));
    cooldownVideos.forEach(v => bookendVideosUsed.cooldown.add(v.id));
  }

  // Every day failed, so there is no plan to deliver — that is a week-level
  // problem (the aims, split and gym cannot produce a single session), and
  // regenerating the week is the fix rather than swapping one exercise.
  if (days.length === 0) {
    return {
      ok: false,
      reason: 'no_day_could_be_built',
      scope: 'week',
      detail: dayFailures.length > 0
        ? `No day could be built. First reason: ${dayFailures[0].detail}`
        : 'No day could be built from this blueprint.',
    };
  }

  return { ok: true, days, decisions, dayFailures };
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

  // DROP-2: a week can legitimately come back short when one day was
  // infeasible and was flagged for an admin instead of being delivered
  // half-built. Validation must not then reject the days that did build —
  // that would turn one bad day back into a failed week, which is the
  // behaviour DROP-2 exists to remove. More days than asked for is still
  // wrong, and no days at all never reaches validation.
  if (days.length > profile.daysPerWeek) {
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

      // A zone-2 block and a follow-along video are timed, not counted in sets.
      if (!ex.finisher && !ex.isCardio && (!ex.setDetails || ex.setDetails.length === 0)) {
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
    // A video warm-up or cooldown carries its own length on the day.
    const warmupMinutes = day.warmup?.minutes ?? shape.warmupMinutes;
    const cooldownMinutes = day.cooldown?.minutes ?? shape.cooldownMinutes;
    const zoneMinutes = day.exercises.reduce((sum, ex) => sum + (ex.finisher ? ex.cardioMinutes || 0 : 0), 0);
    const minutes = estimateDayMinutes(day.exercises.filter(ex => !ex.bookend && !ex.finisher).map(ex => ({
      sets: ex.setDetails?.length || ex.sets || 0,
      reps: parseInt(ex.setDetails?.[0]?.reps || '0', 10) || 0,
      restSeconds: ex.setDetails?.[0]?.restSec ?? 60,
      ...(ex.isCardio ? { fixedMinutes: ex.cardioMinutes || 0 } : {}),
    })), warmupMinutes + cooldownMinutes + zoneMinutes);
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
      if (ex.bookend || ex.finisher) return;
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
