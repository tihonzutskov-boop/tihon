
import { Gym, User } from '../types';
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
  }
};
