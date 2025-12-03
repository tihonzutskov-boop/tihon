
import { Gym } from '../types';
import { DEFAULT_GYM } from '../constants';

const API_BASE = 'http://localhost:3001/api';

/**
 * API Service to interact with the Node/Postgres backend.
 * Includes error handling to fallback gracefully if backend is offline.
 */
export const api = {
  
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
