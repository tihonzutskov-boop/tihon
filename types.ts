export enum EquipmentType {
  CARDIO = 'Cardio',
  FREE_WEIGHTS = 'Free Weights',
  MACHINE = 'Machine',
  RACK = 'Power Rack',
  FUNCTIONAL = 'Functional',
  CORRIDOR = 'Corridor',
  FACILITY = 'Facility',
  RECEPTION = 'Reception',
  LOBBY = 'Lobby',
  GYM_FLOOR = 'Gym Floor',
  STUDIO = 'Group Fitness Studio',
  CHANGING = 'Changing Rooms',
  SHOWERS = 'Showers',
  TOILETS = 'Toilets',
  SAUNA = 'Sauna',
  POOL = 'Pool',
  OFFICE = 'Office',
  STORAGE = 'Storage',
  CAFE = 'Café',
}

export type Language = 'et' | 'en' | 'ru';

export interface EquipmentItem {
  id: string;
  name: string;
  category: 'Free Weights' | 'Machines' | 'Benches & Racks' | 'Cables' | 'Cardio' | 'Functional & Floor' | 'Accessories' | string;
  description?: string; // Text instructions describing what it looks like / how to identify or set it up
  icon?: string;
  imageUrl?: string; // Uploaded picture of the physical equipment
  defaultFootprint?: { width: number; height: number };
  muscleGroups?: string[]; // Target muscle groups, matched against LibraryExercise.targetMuscle
}

export interface GymMachine {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  status?: 'active' | 'maintenance';
  longDescription?: string;
  videoUrl?: string;
  icon?: string;
  equipmentId?: string; // Links this placed machine to an EquipmentItem in the Equipment Library
  exerciseId?: string;  // Optional direct link to a LibraryExercise
  imageUrl?: string;
}

export interface GymAnnex {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name?: string;
  color?: string;
}

export interface GymZone {
  id: string;
  name: string;
  type: EquipmentType;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  icon: string;
  description?: string;
  machines?: GymMachine[];
  equipmentIds?: string[]; // Array of EquipmentItem.id present in this zone
  isHallway?: boolean;
}

export interface GymEntrance {
  side: 'top' | 'bottom' | 'left' | 'right';
  offset: number;
  width: number;
}

export interface SketchPoint {
  x: number;
  y: number;
}

export interface GymWallNode {
  id: string;
  x: number;
  y: number;
}

export interface GymWall {
  id: string;
  type: 'straight' | 'curved';
  wallType: 'exterior' | 'interior' | 'window' | 'door' | 'corridor' | 'staircase' | 'elevator';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  startNodeId?: string;
  endNodeId?: string;
  controlX?: number;
  controlY?: number;
  thickness?: number;
  confidence?: 'high' | 'low';
}

export interface GymHallway {
  id: string;
  name: string;
  points: SketchPoint[];
  width: number;
  color?: string;
  surfaceType?: 'walkway' | 'turf' | 'tile' | 'wood';
}

export interface GymDimensions {
  width: number;
  height: number;
  // Top-left corner of the room in canvas coordinates. Absent on gyms saved
  // before the left/top walls became draggable — treat as 0 (the previous,
  // implicit origin) rather than requiring a migration.
  x?: number;
  y?: number;
  walls?: GymWall[];
  nodes?: GymWallNode[];
  hallways?: GymHallway[];
}

export interface Gym {
  id: string;
  name: string;
  zones: GymZone[];
  dimensions?: GymDimensions;
  entrance?: GymEntrance;
  floorColor?: string;
  annexes?: GymAnnex[];
  walls?: GymWall[];
}

export interface SetDetail {
  reps: string;
  weight: string;   // kg
  restSec: number;
}

export interface Exercise {
  id: string;
  name: string;
  targetMuscle: string;
  sets: number;
  reps: string;
  notes?: string;
  equipmentId: string;
  machineId?: string; // Links to a specific machine in the zone
  videoUrl?: string; // Specific video for this exercise
  makeHarder?: string; // How to make it harder variation instructions
  makeEasier?: string; // How to make it easier variation instructions
  libraryExerciseId?: string; // Optional link back to the LibraryExercise this was added from
  setDetails?: SetDetail[]; // Optional per-set reps/weight/rest, authored in the session builder; sets/reps above stay in sync as a flat summary for consumers that don't read this
  isCardio?: boolean;   // true when this exercise is tracked by a single duration instead of sets/reps (e.g. treadmill, rowing)
  cardioMinutes?: number; // minutes to perform, used when isCardio is true
  // Set by the adaptation engine when the plan is fetched for training. Absent
  // on the stored plan, which is the authored intent — these describe what the
  // training log changed about it, and carry the reason so a weight that moves
  // is never an unexplained number.
  adaptation?: ExerciseAdaptation;
  withdrawn?: boolean;
  substitutedFor?: { id: string; name: string };
  // §2.3 / DATA-1 — two keys, because a slot and the exercise filling it are
  // different things with different lifespans.
  //
  // slotIntentId survives a substitution: it carries what the slot is *for*
  // — its objective, role, target effort and prescription — so a replacement
  // inherits all of that (SUB-2).
  //
  // exerciseInstanceId changes when the exercise does, so a substitute starts
  // fresh rather than inheriting load history from the movement it replaced.
  // Composed from the slot and the library exercise, which keeps it stable
  // across reads — the adapted plan is recomputed on every request, so a
  // freshly random id here would change identity on every page load.
  slotIntentId?: string;
  exerciseInstanceId?: string;
  // Marks the warm-up and cooldown, which are real entries in the day so they
  // can be found on the map like anything else — but are not training work.
  // Every consumer that progresses load, counts weekly volume, or logs a set
  // skips them: warming up is not something you add weight to.
  bookend?: 'warmup' | 'cooldown';
}

export type AdaptationActionName =
  | 'refer' | 'withdraw' | 'substitute' | 'retry'
  | 'reduce-load' | 'add-set' | 'deload'
  | 'raise-load' | 'raise-reps' | 'maintain';

export interface ExerciseAdaptation {
  action: AdaptationActionName;
  rule: string;            // the spec rule that produced it
  reason: string;          // plain language, written to be shown to the client
  suggestedWeight?: number;
}

export interface SessionBookend {
  kind: 'warmup' | 'cooldown';
  name: string;
  minutes: number;
  steps: string[];
}

export type SessionBlockType = 'single' | 'superset' | 'circuit' | 'warmup' | 'cooldown';

export interface SessionBlock {
  id: string;
  type: SessionBlockType;
  title?: string; // editable name, shown for superset/circuit
  exerciseIds: string[]; // references Exercise.id within the same WorkoutDay.exercises
}

export interface TutorialStep {
  text: string;
  time?: number | null; // seconds into tutorialVideoUrl where playback should pause for this step
}

// A variation (Harder/Easier) can get its own tutorial two ways: link to
// another LibraryExercise that already has a full entry (and maybe its own
// tutorial), or — when the variation isn't really a different movement —
// a lightweight inline tutorial of just a pasted YouTube link and plain
// text steps, with no per-step timestamp sync.
export interface VariationTutorial {
  videoUrl?: string;
  steps?: string[];
}

// The motion an exercise trains, independent of the specific equipment used.
// Program blueprints request slots by pattern ("a horizontal push"), and the
// generator resolves each to a real exercise — so this is what makes an
// exercise selectable at all.
export type MovementPattern =
  | 'horizontal_push' | 'horizontal_pull' | 'vertical_push' | 'vertical_pull'
  | 'squat' | 'hinge' | 'lunge' | 'carry'
  // Single-joint work. Without these an isolation exercise has no truthful
  // option, so it gets tagged with whatever compound pattern is closest —
  // which then puts a curl in a pressing slot. Every exercise in a normal
  // gym should be markable without lying about what it trains.
  | 'shoulder_abduction'    // lateral / front raise, rear delt fly
  | 'horizontal_adduction'  // chest fly, pec deck
  | 'elbow_flexion'         // biceps curls
  | 'elbow_extension'       // triceps pushdown, overhead extension
  | 'knee_extension'        // leg extension
  | 'knee_flexion'          // leg / hamstring curl
  | 'hip_extension'         // glute kickback, glute bridge, pull-through
  | 'hip_adduction'         // adductor machine, cable hip adduction
  | 'hip_abduction'         // abductor machine, banded lateral walk
  | 'calf_raise'
  | 'core' | 'conditioning' | 'mobility'
  // A mobility *day* needs regional balance the same way a strength day does
  // — one generic 'mobility' tag would let the generator fill a full-body
  // session with five ankle drills and nothing for the shoulders. These give
  // it real slots to spread across joint regions instead.
  | 'hip_mobility' | 'shoulder_mobility' | 'spine_mobility' | 'ankle_mobility';

export type ExerciseCategory = 'compound' | 'isolation' | 'cardio' | 'mobility' | 'warmup' | 'cooldown';

export type ExperienceLevel = 'Beginner' | 'Intermediate' | 'Advanced';

// Body areas a user can report as injured. An exercise lists the areas it
// meaningfully stresses, and the eligibility filter excludes it for anyone
// reporting one of them.
export type JointStressArea =
  | 'Back' | 'Knees' | 'Shoulders' | 'Neck' | 'Wrists' | 'Hips' | 'Ankles'
  | 'Elbows' | 'Chest' | 'Groin' | 'Hamstrings' | 'Achilles';

// Single source for both the exercise tagging chips and the questionnaire's
// injury picker. Eligibility compares these two by exact string, so a value
// present in one list and missing from the other silently stops excluding
// anything — keeping one array avoids that drift.
export const ALL_JOINT_STRESS_AREAS: JointStressArea[] = [
  'Back', 'Knees', 'Shoulders', 'Neck', 'Wrists', 'Hips', 'Ankles',
  'Elbows', 'Chest', 'Groin', 'Hamstrings', 'Achilles',
];

// Structured muscle tags, separate from the free-text targetMuscle which is
// display copy and can't be reasoned about. These let the generator check a
// week actually covers the body, and avoid stacking redundant exercises that
// train the same thing.
export type MuscleGroup =
  // Split finer than the usual "Back"/"Shoulders" so a plan can tell a
  // pulldown from a row, or a lateral raise from a front raise. Coverage
  // checks roll these back up into regions (see CORE_COVERAGE), so splitting
  // does not make a week look under-trained.
  | 'Chest' | 'Upper chest'
  | 'Lats' | 'Upper back' | 'Lower back'
  | 'Front delts' | 'Side delts' | 'Rear delts'
  | 'Biceps' | 'Triceps' | 'Forearms'
  | 'Quads' | 'Hamstrings' | 'Glutes' | 'Calves' | 'Adductors' | 'Abductors'
  | 'Abs' | 'Obliques';

export const ALL_MUSCLE_GROUPS: MuscleGroup[] = [
  'Chest', 'Upper chest',
  'Lats', 'Upper back', 'Lower back',
  'Front delts', 'Side delts', 'Rear delts',
  'Biceps', 'Triceps', 'Forearms',
  'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Adductors', 'Abductors',
  'Abs', 'Obliques',
];

export interface LibraryExercise {
  id: string;
  name: string;
  targetMuscle: string;      // Target muscle group(s)
  equipmentRequired: string; // e.g., Dumbbell, barbell, leg press machine
  requiredEquipmentIds?: string[]; // Array of EquipmentItem.id required for this exercise (links to Equipment Library)
  category: string;          // compound/isolation, strength, cardio, mobility, etc.
  instructions: string;      // Clear movement execution & form instructions
  equipmentId?: string;      // Optional mapped zone/location ID on the gym map
  videoUrl?: string;         // Pasted YouTube/video link, shown via the "Watch Guide Video" embed
  imageUrl?: string;         // Uploaded GIF demonstrating the movement
  makeHarder?: string;       // Instructions for increasing difficulty (tempo, load, ROM, stance)
  makeEasier?: string;       // Instructions for regressing difficulty (assistance, bands, ROM, load)
  tutorialVideoUrl?: string;      // Uploaded tutorial video file (data URI) — a real <video>, separate from videoUrl, so it supports timestamp-based seeking
  tutorialVideoFileName?: string; // Original filename of the uploaded tutorial video
  steps?: TutorialStep[];         // Step-by-step tutorial breakdown, each optionally pinned to a tutorialVideoUrl timestamp
  exerciseType?: 'standard' | 'video'; // 'video' = a YouTube follow-along (warmup, mobility, cooldown) with no equipment/sets — undefined behaves as 'standard'
  videoDurationLabel?: string;         // Free-text duration for a video exercise (e.g. "10 min"), shown to trainees — admin-entered since we don't fetch real video metadata
  harderExerciseId?: string;  // Link mode: another LibraryExercise.id that's "the harder version" of this one
  easierExerciseId?: string;  // Link mode: another LibraryExercise.id that's "the easier version" of this one
  harderTutorial?: VariationTutorial; // Quick tutorial mode for the harder variation
  easierTutorial?: VariationTutorial; // Quick tutorial mode for the easier variation

  // --- Automatic generation metadata ---
  // All optional so existing hand-authored exercises keep working untouched,
  // but the generator treats missing values as "cannot establish eligibility"
  // and skips the exercise rather than guessing (fail closed). An exercise
  // only becomes selectable once an admin has actually filled these in.
  movementPattern?: MovementPattern;
  exerciseCategory?: ExerciseCategory;
  // Which bookends this exercise can serve, independent of what kind of
  // movement it is. exerciseCategory conflated the two — an exercise could be
  // 'cardio' or 'warmup' but never both, so a bike that suits the warm-up and
  // the cooldown equally had no way to say so. Empty for most exercises.
  bookendRoles?: ('warmup' | 'cooldown')[];
  // What to actually do with this exercise at each end of a session. Kept
  // separate because the same machine rarely means the same thing twice — a
  // treadmill warm-up builds to an easy jog, the same treadmill as a cooldown
  // walks it back down. Falls back to the day's generic block steps when
  // empty, so an untagged library still produces a usable bookend.
  warmupNote?: string;
  cooldownNote?: string;
  minExperience?: ExperienceLevel; // hard gate, not a scoring penalty — a beginner never gets an advanced-only lift
  jointStress?: JointStressArea[]; // areas this exercise loads; excluded for users reporting injury there
  primaryMuscles?: MuscleGroup[];   // what this mainly trains — drives weekly balance checks
  secondaryMuscles?: MuscleGroup[]; // meaningfully worked, but not the point of the movement
  generationEnabled?: boolean;     // explicit admin opt-in — without it the exercise is never auto-selected
}

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface WorkoutDay {
  id: string;
  name: string;
  exercises: Exercise[];
  // Emitted by the generator for every day, whatever the exercise library
  // contains — a library gap should cost a better warm-up, never the warm-up
  // itself. Absent on hand-authored plans predating this.
  warmup?: SessionBookend;
  cooldown?: SessionBookend;
  // Ramp-up sets before the first working set of each compound. Scales with the
  // session length: extra time buys preparation, not extra working volume.
  warmupSetsPerCompound?: number;
  weekday?: Weekday;
  blocks?: SessionBlock[]; // optional grouping/authoring metadata built by the session builder; exercises[] stays the flat source of truth so existing consumers (GuidedSession, self-service builder) work unchanged when this is absent
}

export interface WorkoutPlan {
  id: string;
  name: string;
  days: WorkoutDay[];
  totalDurationMinutes: number;
}

// A generation attempt the engine refused to complete — it fails closed
// rather than delivering a questionable plan, and these surface for a human
// instead of being silently swallowed.
export interface GenerationFailureRecord {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  templateId: string | null;
  gymId: string | null;
  reason: string;
  detail: string | null;
  createdAt: string;
}

export interface QuestionnaireAnswers {
  age: number;
  heightCm: number;
  weightKg: number;
  sex: string;
  goals: string[];           // multi-select
  level: string;              // only 'Beginner' selectable for now
  daysPerWeek: string;        // '1'..'4'
  preferredDays: Weekday[];   // which weekdays, in calendar order — length matches daysPerWeek
  minutesPerSession: string;  // '30 min'..'90 min'
  gymId?: string;             // which gym they train at — determines the equipment pool available to plan generation
  equipment: string;
  avoidExercises?: string;
  injuryAreas: string[];      // multi-select common areas
  injuryNotes?: string;
  medicalClearance?: string;  // only present if injuries disclosed
  consent?: boolean;          // only present if injuries disclosed
}

// One unfilled requirement in a blueprint day — "a horizontal push goes
// here" — that the generator resolves to a real exercise per user. Distinct
// from SessionBlock, which groups exercises that have *already* been chosen.
// SLOT-1: a main-block slot's role decides both where it sits in the session
// and how early it is dropped when the day runs over. Replaces the old
// required/optional pair — 'primary' is what 'required' meant, and what was
// one undifferentiated 'optional' bucket now splits by whether losing it costs
// the session a movement pattern (supporting) or only finishing work
// (accessory).
export type SlotRole = 'primary' | 'supporting' | 'accessory';

export interface ExerciseSlot {
  id: string;
  movementPattern: MovementPattern;
  exerciseCategory?: ExerciseCategory; // narrows selection (e.g. isolation-only accessory slot)
  priority: number;                    // lower = more important; the duration fitter drops the highest number first
  optional?: boolean;                  // only an optional slot may be dropped to fit the session length
  // Absent on admin-authored blueprints written before SLOT-1; consumers fall
  // back to reading `optional` for those (see roleOf in planGeneration).
  role?: SlotRole;
  // MIXAIM-7: which of the day's two aims this slot serves. Orthogonal to
  // role — a secondary-aim slot has a role within its own aim's block — and
  // it outranks role when deciding what gets cut: all secondary-aim work goes
  // before any primary-aim work, whatever their roles. Absent means primary.
  aimTier?: 'primary' | 'secondary';
  setsMin: number;
  setsMax: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
}

export interface BlueprintDay {
  id: string;
  name: string;      // e.g. "Upper", "Full Body"
  slots: ExerciseSlot[];
  // MIXAIM-1: aims are distributed across days rather than mixed inside one,
  // so every day belongs to exactly one aim. Held as data rather than encoded
  // in the name, so the engine and the admin queue can both read it.
  primaryAim?: string;
  // MIXAIM-1: the day's optional secondary aim, whose essential work is
  // appended below all primary-aim work and cut first (MIXAIM-7 / DROP-1).
  secondaryAim?: string | null;
}

// A template is category metadata only — which goal it targets, the
// days/week and session length it's for, and a display name. The rules
// engine (buildDefaultBlueprint in utils/planGeneration.ts) builds every
// plan's actual exercises from goal + days/week alone, the same way for
// every client, so there is nothing here for an admin to author.
//
// days/blueprintDays are kept only so a template saved before this change
// still round-trips through this type without a cast; nothing reads them
// any more, on either the client or the server.
export interface PlanTemplate {
  id: string;
  name: string;
  goal: string;          // one of QUESTIONNAIRE_GOALS
  daysPerWeek: string;    // '1'..'4'
  durationMin: number;    // target single-session length in minutes (e.g. 45), set by the admin
  days?: WorkoutDay[];
  blueprintDays?: BlueprintDay[];
  minExperience?: ExperienceLevel;
}

export interface CoachingClient {
  userId: number;
  name: string;
  email: string;
  avatarUrl?: string;
  joinedDate: string;
  // An admin can also be a client — often the first real one, testing the
  // product on themselves — so they appear here and are marked rather than
  // hidden.
  isAdmin?: boolean;
  // Null until the client submits the intake questionnaire. They are still a
  // client before that — they registered — so they appear in the list either
  // way, and this being null is what marks them as not yet onboarded.
  answers: QuestionnaireAnswers | null;
  submittedAt: string | null;
  plan: { name: string; days: WorkoutDay[] } | null;
  // Whether the client is actually training, as distinct from whether a plan
  // was assigned to them. A plan with zero logged sessions means they have
  // not started, which no other field here would reveal.
  sessionsLogged: number;
  lastLoggedAt: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  avatarUrl?: string;
  joinedDate: string;
  stats?: {
    workoutsCompleted: number;
    totalMinutes: number;
    streakDays: number;
  };
}

export interface AuthResponse {
  user: User;
  token?: string;
}

// ---------------------------------------------------------------------------
// Training log — the input the adaptive engine runs on
// ---------------------------------------------------------------------------

// How hard a set felt, 1–5. The client is asked "how hard was that?", but each
// point is anchored in reps left, because the rules key off proximity to
// failure rather than mood. Beginners are never programmed to failure, so they
// have no felt reference for it — the anchors are what keep the answer usable.
export type EffortRating = 1 | 2 | 3 | 4 | 5;

export interface EffortLevel {
  value: EffortRating;
  label: string;       // what the client taps
  repsLeft: string;    // the anchor that makes the number mean something
}

export const EFFORT_SCALE: EffortLevel[] = [
  { value: 1, label: 'Very easy',           repsLeft: '5 or more left' },
  { value: 2, label: 'Easy',                repsLeft: 'about 4 left' },
  { value: 3, label: 'About right',         repsLeft: '2–3 left' },
  { value: 4, label: 'Hard',                repsLeft: '1 left' },
  { value: 5, label: "Couldn't do another", repsLeft: 'none left' },
];

// One set as it was actually performed. targetReps is carried alongside so the
// progression rule can compare done-versus-prescribed without re-deriving what
// the plan said at the time — the plan may since have changed.
export interface LoggedSet {
  reps: number;
  targetReps: number;
}

// One exercise, as performed in one session. Weight is what the client actually
// used: in week 1 they choose it and the app records it, and from then on it is
// the working weight the progression rule advances.
export interface ExerciseLog {
  id?: number;
  exerciseId: string;
  planDayId?: string;
  weight?: number | null;      // null for bodyweight movements
  weightUnit?: 'kg' | 'lb';
  sets: LoggedSet[];
  effort?: EffortRating | null;
  pain?: boolean;
  // Where it hurt. Without this a substitute can only avoid the joints the
  // withdrawn exercise happened to load, which is a guess; with it, anything
  // loading the painful area is excluded outright.
  painArea?: JointStressArea | null;
  painNote?: string;
  loggedAt?: string;
}
