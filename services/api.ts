
import { Gym, User, WorkoutPlan } from '../types';
import { DEFAULT_GYM } from '../constants';

const API_BASE = 'http://localhost:3001/api';

const MOCK_PLANS: WorkoutPlan[] = [
  {
    id: 'plan-1',
    name: 'Upper Body Power',
    totalDurationMinutes: 60,
    lastPerformed: '2 days ago',
    exercises: [
      { id: 'ex-1', name: 'Bench Press', targetMuscle: 'Chest', sets: 4, reps: '8', equipmentId: 'zone-weights-1' },
      { id: 'ex-2', name: 'Shoulder Press', targetMuscle: 'Shoulders', sets: 3, reps: '12', equipmentId: 'zone-racks' },
      { id: 'ex-3', name: 'Cable Rows', targetMuscle: 'Back', sets: 3, reps: '10', equipmentId: 'zone-machines-1' }
    ]
  },
  {
    id: 'plan-2',
    name: 'Leg Day Focus',
    totalDurationMinutes: 45,
    lastPerformed: '5 days ago',
    exercises: [
      { id: 'ex-4', name: 'Squats', targetMuscle: 'Quads', sets: 5, reps: '5', equipmentId: 'zone-racks' },
      { id: 'ex-5', name: 'Leg Press', targetMuscle: 'Quads', sets: 3, reps: '15', equipmentId: 'zone-machines-2' }
    ]
  }
];

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
      return { ...data.user, savedPlans: MOCK_PLANS };
    } catch (error) {
      console.warn("Backend unavailable. Using mock login.", error);
      if (email === 'admin@gym.com') {
         return { 
           id: 'admin-1', 
           name: 'Admin User', 
           email, 
           role: 'admin', 
           joinedDate: '2023-01-01', 
           stats: { workoutsCompleted: 100, totalMinutes: 5000, streakDays: 10 },
           savedPlans: []
         };
      }
      return { 
        id: 'user-1', 
        name: 'Demo User', 
        email, 
        role: 'user', 
        joinedDate: new Date().toISOString(), 
        stats: { workoutsCompleted: 12, totalMinutes: 480, streakDays: 3 },
        savedPlans: MOCK_PLANS
      };
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
      return { ...data.user, savedPlans: [] };
    } catch (error) {
       console.warn("Backend unavailable. Using mock signup.");
       return { 
         id: `user-${Date.now()}`, 
         name, 
         email, 
         role: 'user', 
         joinedDate: new Date().toISOString(), 
         stats: { workoutsCompleted: 0, totalMinutes: 0, streakDays: 0 },
         savedPlans: []
       };
    }
  },

  async fetchGyms(): Promise<Gym[]> {
    try {
      const response = await fetch(`${API_BASE}/gyms`);
      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const data = await response.json();
      return data.length > 0 ? data : [DEFAULT_GYM];
    } catch (error) {
      console.warn("Backend unavailable. Using local mock data.", error);
      return [DEFAULT_GYM];
    }
  },

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

  async deleteGym(gymId: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/gyms/${gymId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.warn("Backend unavailable. Change not persisted to DB.");
    }
  }
};
