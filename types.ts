
export enum EquipmentType {
  CARDIO = 'Cardio',
  FREE_WEIGHTS = 'Free Weights',
  MACHINE = 'Machine',
  RACK = 'Power Rack',
  FUNCTIONAL = 'Functional',
  CORRIDOR = 'Corridor',
  FACILITY = 'Facility',
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
}

export interface GymEntrance {
  side: 'top' | 'bottom' | 'left' | 'right';
  offset: number; // 0 to 100 percentage
  width: number;
}

export interface GymDimensions {
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
}

export interface Exercise {
  id: string;
  name: string;
  targetMuscle: string;
  sets: number;
  reps: string; // string to allow range like "8-12"
  notes?: string;
  equipmentId: string;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  exercises: Exercise[];
  totalDurationMinutes: number;
}

export interface AiSuggestion {
  name: string;
  sets: number;
  reps: string;
  targetMuscle: string;
  notes: string;
}
