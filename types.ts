export enum EquipmentType {
  CARDIO = 'Cardio',
  FREE_WEIGHTS = 'Free Weights',
  MACHINE = 'Machine',
  RACK = 'Power Rack',
  FUNCTIONAL = 'Functional',
  CORRIDOR = 'Corridor',
  FACILITY = 'Facility',
}

export type Language = 'et' | 'en' | 'ru';

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

export interface SketchStroke {
  id: string;
  points: SketchPoint[];
  color: string;
  width: number;
}

export interface GymDimensions {
  width: number;
  height: number;
  sketchStrokes?: SketchStroke[];
}

export interface GymAnnex {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Gym {
  id: string;
  name: string;
  zones: GymZone[];
  dimensions?: GymDimensions;
  entrance?: GymEntrance;
  floorColor?: string;
  annexes?: GymAnnex[];
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
}

export interface LibraryExercise {
  id: string;
  name: string;
  targetMuscle: string;      // Target muscle group(s)
  equipmentRequired: string; // e.g., Dumbbell, barbell, leg press machine
  category: string;          // compound/isolation, strength, cardio, mobility, etc.
  instructions: string;      // Clear instructions on how to perform the exercise
  equipmentId?: string;      // Optional mapped zone/location ID on the gym map
  videoUrl?: string;         // Optional video URL
  imageUrl?: string;         // Optional image URL
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