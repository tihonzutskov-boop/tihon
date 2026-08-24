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
}

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface WorkoutDay {
  id: string;
  name: string;
  exercises: Exercise[];
  weekday?: Weekday;
  blocks?: SessionBlock[]; // optional grouping/authoring metadata built by the session builder; exercises[] stays the flat source of truth so existing consumers (GuidedSession, self-service builder) work unchanged when this is absent
}

export interface WorkoutPlan {
  id: string;
  name: string;
  days: WorkoutDay[];
  totalDurationMinutes: number;
}

export interface QuestionnaireAnswers {
  age: number;
  heightCm: number;
  weightKg: number;
  sex: string;
  goals: string[];           // multi-select
  level: string;              // only 'Beginner' selectable for now
  daysPerWeek: string;        // '1'..'4'
  minutesPerSession: string;  // '30 min'..'90 min'
  equipment: string;
  avoidExercises?: string;
  injuryAreas: string[];      // multi-select common areas
  injuryNotes?: string;
  medicalClearance?: string;  // only present if injuries disclosed
  consent?: boolean;          // only present if injuries disclosed
}

export interface PlanTemplate {
  id: string;
  name: string;
  goal: string;          // one of QUESTIONNAIRE_GOALS
  daysPerWeek: string;    // '1'..'4'
  durationMin: number;    // target single-session length in minutes (e.g. 45), set by the admin
  days: WorkoutDay[];     // authored with no weekday set
}

export interface CoachingClient {
  userId: number;
  name: string;
  email: string;
  avatarUrl?: string;
  answers: QuestionnaireAnswers;
  submittedAt: string;
  plan: { name: string; days: WorkoutDay[] } | null;
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