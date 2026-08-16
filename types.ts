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
  isFloorSpace?: boolean; // Tag indicating open floor / mat area for bodyweight exercises
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
  videoUrl?: string;         // Uploaded video URL demonstrating how to perform the movement
  makeHarder?: string;       // Instructions for increasing difficulty (tempo, load, ROM, stance)
  makeEasier?: string;       // Instructions for regressing difficulty (assistance, bands, ROM, load)
}

export interface WorkoutDay {
  id: string;
  name: string;
  exercises: Exercise[];
}

export interface WorkoutPlan {
  id: string;
  name: string;
  days: WorkoutDay[];
  totalDurationMinutes: number;
}

export interface AiSuggestion {
  name: string;
  sets: number;
  reps: string;
  targetMuscle: string;
  notes: string;
  equipmentId?: string;
  machineId?: string;
  videoUrl?: string;
}

export interface AiDaySuggestion {
  dayName: string;
  exercises: AiSuggestion[];
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