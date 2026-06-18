
import { Gym, User, LibraryExercise } from '../types';
import { DEFAULT_GYM } from '../constants';

const API_BASE = 'http://localhost:3001/api';

/**
 * API Service to interact with the Node/Postgres backend.
 * Includes error handling to fallback gracefully if backend is offline.
 */
export const api = {
  
  // --- AUTH ---
  async login(email: string): Promise<User> {
    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error('Login failed');
      const data = await response.json();
      return data.user;
    } catch (error) {
      console.warn("Backend unavailable. Using mock login.", error);
      // Mock Login for demo
      if (email === 'admin@gym.com') {
         return { id: 'admin-1', name: 'Admin User', email, role: 'admin', joinedDate: '2023-01-01', stats: { workoutsCompleted: 100, totalMinutes: 5000, streakDays: 10 } };
      }
      return { id: 'user-1', name: 'Demo User', email, role: 'user', joinedDate: new Date().toISOString(), stats: { workoutsCompleted: 5, totalMinutes: 120, streakDays: 1 } };
    }
  },

  async signup(name: string, email: string): Promise<User> {
    try {
      const response = await fetch(`${API_BASE}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      if (!response.ok) throw new Error('Signup failed');
      const data = await response.json();
      return data.user;
    } catch (error) {
       console.warn("Backend unavailable. Using mock signup.");
       return { id: `user-${Date.now()}`, name, email, role: 'user', joinedDate: new Date().toISOString(), stats: { workoutsCompleted: 0, totalMinutes: 0, streakDays: 0 } };
    }
  },

  // --- GYMS ---

  // Fetch all gyms
  async fetchGyms(): Promise<Gym[]> {
    try {
      const response = await fetch(`${API_BASE}/gyms`);
      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const data = await response.json();
      
      // Ensure we return at least one gym if DB is empty, or return the fetched list
      return data.length > 0 ? data : [DEFAULT_GYM];
    } catch (error) {
      console.warn("Backend unavailable. Using local mock data.", error);
      return [DEFAULT_GYM];
    }
  },

  // Create a new gym
  async createGym(gym: Gym): Promise<void> {
    try {
      await fetch(`${API_BASE}/gyms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gym),
      });
    } catch (error) {
      console.warn("Backend unavailable. Change not persisted to DB.");
    }
  },

  // Save/Update an existing gym
  async saveGym(gym: Gym): Promise<void> {
    try {
      await fetch(`${API_BASE}/gyms/${gym.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gym),
      });
    } catch (error) {
      console.warn("Backend unavailable. Change not persisted to DB.");
    }
  },

  // Delete a gym
  async deleteGym(gymId: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/gyms/${gymId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.warn("Backend unavailable. Change not persisted to DB.");
    }
  },

  // --- EXERCISES & VIDEO LIBRARY ---

  // Fetch all exercises
  async fetchExercises(): Promise<LibraryExercise[]> {
    try {
      const response = await fetch(`${API_BASE}/exercises`);
      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const data = await response.json();
      return data.length > 0 ? data : DEFAULT_EXERCISES;
    } catch (error) {
      console.warn("Backend unavailable. Using local fallback storage or default exercises.", error);
      const cached = localStorage.getItem('gym_exercises');
      if (cached) {
         try { return JSON.parse(cached); } catch (e) { }
      }
      return DEFAULT_EXERCISES;
    }
  },

  // Create a new exercise
  async createExercise(exercise: LibraryExercise): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/exercises`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exercise),
      });
      if (!response.ok) throw new Error("API signup/create error");
    } catch (error) {
       console.warn("Backend save postponed. Syncing locally.");
    }
    // Sync into local backup cache
    const cached = localStorage.getItem('gym_exercises');
    let exercises: LibraryExercise[] = cached ? JSON.parse(cached) : [...DEFAULT_EXERCISES];
    exercises.push(exercise);
    localStorage.setItem('gym_exercises', JSON.stringify(exercises));
  },

  // Save/Update an existing exercise
  async saveExercise(exercise: LibraryExercise): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/exercises/${exercise.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exercise),
      });
      if (!response.ok) throw new Error("API save error");
    } catch (error) {
       console.warn("Backend save postponed. Syncing locally.");
    }
    // Sync into local backup cache
    const cached = localStorage.getItem('gym_exercises');
    let exercises: LibraryExercise[] = cached ? JSON.parse(cached) : [...DEFAULT_EXERCISES];
    exercises = exercises.map(ex => ex.id === exercise.id ? exercise : ex);
    localStorage.setItem('gym_exercises', JSON.stringify(exercises));
  },

  // Delete an exercise
  async deleteExercise(id: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/exercises/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error("API delete error");
    } catch (error) {
       console.warn("Backend delete postponed. Syncing locally.");
    }
    // Sync into local backup cache
    const cached = localStorage.getItem('gym_exercises');
    let exercises: LibraryExercise[] = cached ? JSON.parse(cached) : [...DEFAULT_EXERCISES];
    exercises = exercises.filter(ex => ex.id !== id);
    localStorage.setItem('gym_exercises', JSON.stringify(exercises));
  }
};

// Default high-quality standard exercises that load instantly as demo data
const DEFAULT_EXERCISES: LibraryExercise[] = [
  {
    id: 'ex-squat',
    name: 'Barbell Back Squat',
    targetMuscle: 'Legs/Quads',
    equipmentRequired: 'Olympic Barbell & Squat Rack',
    category: 'Compound (Strength)',
    instructions: 'Keep your chest high, engage your core, squat deep in a full range of motion while maintaining flat heels on the floor.',
    equipmentId: 'zone-racks',
    videoUrl: 'https://www.youtube.com/embed/SW_C1A-rejs'
  },
  {
    id: 'ex-rowing',
    name: 'Concept2 Rowing Conditioning',
    targetMuscle: 'Back/Full Body',
    equipmentRequired: 'Concept2 Rowing Machine',
    category: 'Cardio / Aerobic',
    instructions: 'Drive primarily with your legs by keeping heels flat, extend hips, and coordinate handles to follow after your body matches the lean angle.',
    equipmentId: 'zone-cardio-2',
    videoUrl: 'https://www.youtube.com/embed/H0r_Zcp4pG4'
  },
  {
    id: 'ex-treadmill',
    name: 'Treadmill Incline Hike',
    targetMuscle: 'Cardio',
    equipmentRequired: 'Commercial Treadmill',
    category: 'Cardio / Aerobic',
    instructions: 'Set the target treadmill incline level to 10%–15% and keep a steady active walking pace at 3.0–3.5 mph. Avoid holding onto handrails to maximize core engagement.',
    equipmentId: 'zone-cardio-1',
    videoUrl: 'https://www.youtube.com/embed/8iPEnn-ltC8'
  },
  {
    id: 'ex-legpress',
    name: 'Machine Leg Press 45°',
    targetMuscle: 'Glutes/Quads',
    equipmentRequired: '45-Degree Plate-Loaded Leg Press',
    category: 'Compound (Strength)',
    instructions: 'Set deep comfortable feet placement, unlock structural handle safety pins, pull yourself down into seat support, and avoid rolling lower back off pad on negative phase.',
    equipmentId: 'zone-machines-2',
    videoUrl: 'https://www.youtube.com/embed/IZxyjW7MPJQ'
  },
  {
    id: 'ex-dumbbell-curl',
    name: 'Seated Dumbbell Hammer Curl',
    targetMuscle: 'Arms/Biceps',
    equipmentRequired: 'Set of Dumbbells & Bench',
    category: 'Isolation (Hypertrophy)',
    instructions: 'Sit stable with chest proud, grip dumbbells with a neutral hammer orientation, keep elbows firmly tucked against your ribcage, and curl without swaying upper body shoulders.',
    equipmentId: 'zone-weights-1',
    videoUrl: 'https://www.youtube.com/embed/8iPEnn-ltC8'
  }
];
