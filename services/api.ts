
import { Gym, User, LibraryExercise, EquipmentItem, GymZone, GymMachine, EquipmentType, WorkoutDay, QuestionnaireAnswers, PlanTemplate } from '../types';
import { DEFAULT_GYM } from '../constants';

// Relative path: works same-origin in production (Express serves the built
// frontend) and via the Vite dev server proxy in local development.
export const API_BASE = '/api';

// Canonical standard equipment items that are reusable across any gym
export const DEFAULT_EQUIPMENT: EquipmentItem[] = [
  {
    id: 'eq-dumbbells',
    name: 'Dumbbells (Full Rack)',
    category: 'Free Weights',
    icon: 'Dumbbell',
    description: 'Fixed and adjustable dumbbells from 2kg to 50kg for upper and lower body resistance training.',
    muscleGroups: ['Chest', 'Back', 'Shoulders', 'Arms'],
    defaultFootprint: { width: 60, height: 30 }
  },
  {
    id: 'eq-barbell-plates',
    name: 'Olympic Barbell & Bumper Plates',
    category: 'Free Weights',
    icon: 'Weight',
    description: 'Standard 20kg Olympic barbells with rotating sleeves and Olympic bumper plates.',
    muscleGroups: ['Legs', 'Back', 'Full Body'],
    defaultFootprint: { width: 70, height: 40 }
  },
  {
    id: 'eq-squat-rack',
    name: 'Power Rack / Squat Cage',
    category: 'Benches & Racks',
    icon: 'Layers',
    description: 'Heavy duty structural power cage with safety spotter arms, J-hooks, and pull-up bar.',
    muscleGroups: ['Legs', 'Back', 'Full Body'],
    defaultFootprint: { width: 70, height: 70 }
  },
  {
    id: 'eq-adj-bench',
    name: 'Adjustable Incline/Flat Bench',
    category: 'Benches & Racks',
    icon: 'Box',
    description: 'Multi-position utility bench adjusting from flat (0°) to 30°, 45°, and 75° angles.',
    muscleGroups: ['Chest', 'Shoulders', 'Arms'],
    defaultFootprint: { width: 40, height: 80 }
  },
  {
    id: 'eq-cable-crossover',
    name: 'Dual Cable Cross / Functional Trainer',
    category: 'Cables',
    icon: 'Sliders',
    description: 'Dual adjustable-height selectorized weight stacks with multi-grip handles.',
    muscleGroups: ['Chest', 'Back', 'Shoulders', 'Arms', 'Core'],
    defaultFootprint: { width: 180, height: 60 }
  },
  {
    id: 'eq-lat-pulldown',
    name: 'Lat Pulldown & Seated Cable Row',
    category: 'Cables',
    icon: 'Sliders',
    description: 'High and low pulley station for back vertical pulldowns and horizontal rows.',
    muscleGroups: ['Back', 'Arms'],
    defaultFootprint: { width: 80, height: 60 }
  },
  {
    id: 'eq-leg-press',
    name: '45° Plate-Loaded Leg Press',
    category: 'Machines',
    icon: 'Disc',
    description: 'Linear 45-degree angle sled leg press with dual safety lockout levers.',
    muscleGroups: ['Legs', 'Glutes'],
    defaultFootprint: { width: 80, height: 65 }
  },
  {
    id: 'eq-leg-extension',
    name: 'Leg Extension & Leg Curl Machine',
    category: 'Machines',
    icon: 'Disc',
    description: 'Isolated quadriceps knee extension and seated/lying hamstring flexion station.',
    muscleGroups: ['Legs'],
    defaultFootprint: { width: 75, height: 65 }
  },
  {
    id: 'eq-treadmill',
    name: 'Commercial Running Treadmill',
    category: 'Cardio',
    icon: 'Activity',
    description: 'Cardio running deck with digital speed and incline adjustment up to 15%.',
    muscleGroups: ['Cardio', 'Legs'],
    defaultFootprint: { width: 35, height: 60 }
  },
  {
    id: 'eq-rower',
    name: 'Concept2 Air Rower',
    category: 'Cardio',
    icon: 'Waves',
    description: 'Flywheel air-resistance rowing ergometer for total body conditioning intervals.',
    muscleGroups: ['Cardio', 'Back', 'Full Body'],
    defaultFootprint: { width: 55, height: 35 }
  },
  {
    id: 'eq-assault-bike',
    name: 'Air Resistance Assault Bike',
    category: 'Cardio',
    icon: 'Activity',
    description: 'Heavy duty fan air bike for high intensity sprint intervals.',
    muscleGroups: ['Cardio', 'Full Body'],
    defaultFootprint: { width: 40, height: 50 }
  },
  {
    id: 'eq-floor-mat',
    name: 'Open Floor / Mat Area',
    category: 'Functional & Floor',
    icon: 'Sparkles',
    description: 'Open floor space with turf or shock-absorbent rubber mats for bodyweight and core exercises.',
    muscleGroups: ['Core', 'Full Body'],
    defaultFootprint: { width: 100, height: 100 }
  },
  {
    id: 'eq-pullup-bar',
    name: 'Pull-Up Bar / Rig Station',
    category: 'Functional & Floor',
    icon: 'Layers',
    description: 'Multi-grip overhead pull-up and chin-up station.',
    muscleGroups: ['Back', 'Arms'],
    defaultFootprint: { width: 60, height: 30 }
  },
  {
    id: 'eq-kettlebells',
    name: 'Kettlebells (Competition Set)',
    category: 'Free Weights',
    icon: 'Dumbbell',
    description: 'Cast iron kettlebells from 8kg to 32kg for ballistic power and swings.',
    muscleGroups: ['Full Body', 'Core'],
    defaultFootprint: { width: 50, height: 30 }
  },
  {
    id: 'eq-plyo-box',
    name: '3-in-1 Wooden Plyo Box',
    category: 'Accessories',
    icon: 'Box',
    description: 'Three variable jump heights (20", 24", 30") for box jumps, step-ups, and depth drops.',
    muscleGroups: ['Legs', 'Cardio'],
    defaultFootprint: { width: 40, height: 40 }
  },
  {
    id: 'eq-resistance-bands',
    name: 'Resistance Bands & Battle Ropes',
    category: 'Accessories',
    icon: 'Wind',
    description: 'Elastic power loops, activation bands, and 50ft battle conditioning ropes.',
    muscleGroups: ['Full Body', 'Arms', 'Shoulders'],
    defaultFootprint: { width: 30, height: 30 }
  }
];

// Helper to sanitize default YouTube video URLs without overwriting user entered URLs
const sanitizeExerciseVideos = (exercises: LibraryExercise[]): LibraryExercise[] => {
  const youtubeDefaults: Record<string, string> = {
    'ex-squat': 'https://www.youtube.com/watch?v=ultWZbUMPL8',
    'ex-rowing': 'https://www.youtube.com/watch?v=H0r_Zcp4pG4',
    'ex-treadmill': 'https://www.youtube.com/watch?v=8iPEnn-ltC8',
    'ex-legpress': 'https://www.youtube.com/watch?v=IZxyjW7MPJQ',
    'ex-dumbbell-curl': 'https://www.youtube.com/watch?v=yTwo27QT6Lg'
  };

  return exercises.map(ex => {
    // If the exercise already has a videoUrl, preserve it EXACTLY as entered
    if (ex.videoUrl && ex.videoUrl.trim() !== '') {
      return ex;
    }

    let videoUrl = '';
    if (youtubeDefaults[ex.id]) {
      videoUrl = youtubeDefaults[ex.id];
    } else {
      const nameLower = (ex.name || '').toLowerCase();
      if (nameLower.includes('bench press')) videoUrl = 'https://www.youtube.com/watch?v=rT7DgCr-3pg';
      else if (nameLower.includes('deadlift')) videoUrl = 'https://www.youtube.com/watch?v=_oyxCn2iSjU';
      else if (nameLower.includes('squat')) videoUrl = 'https://www.youtube.com/watch?v=ultWZbUMPL8';
      else if (nameLower.includes('pulldown')) videoUrl = 'https://www.youtube.com/watch?v=CAwf7n6Luuc';
      else if (nameLower.includes('shoulder press')) videoUrl = 'https://www.youtube.com/watch?v=qEwKCR5JCog';
      else if (nameLower.includes('row')) videoUrl = 'https://www.youtube.com/watch?v=H0r_Zcp4pG4';
      else if (nameLower.includes('treadmill') || nameLower.includes('hike')) videoUrl = 'https://www.youtube.com/watch?v=8iPEnn-ltC8';
      else if (nameLower.includes('press')) videoUrl = 'https://www.youtube.com/watch?v=IZxyjW7MPJQ';
      else if (nameLower.includes('curl')) videoUrl = 'https://www.youtube.com/watch?v=yTwo27QT6Lg';
      else videoUrl = 'https://www.youtube.com/watch?v=SW_C1A-rejs';
    }
    return { ...ex, videoUrl };
  });
};

// API Service to interact with the backend / local storage
export const api = {
  
  // --- AUTH ---
  // All auth is via Google Sign-In; the backend verifies the ID token and
  // issues its own httpOnly session cookie. Admin role is decided server-side
  // (ADMIN_EMAILS allow-list) — never trust a client-supplied role.
  async googleLogin(idToken: string): Promise<User> {
    const response = await fetch(`${API_BASE}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    if (!response.ok) throw new Error('Google sign-in failed');
    const data = await response.json();
    return data.user;
  },

  async logout(): Promise<void> {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
  },

  async fetchMe(): Promise<User | null> {
    try {
      const response = await fetch(`${API_BASE}/auth/me`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.user;
    } catch {
      return null;
    }
  },

  // --- WORKOUT TRACKING ---

  async completeWorkout(dayName: string, exerciseCount: number, planDayId?: string): Promise<void> {
    await fetch(`${API_BASE}/workouts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dayName, exerciseCount, planDayId }),
    });
  },

  async fetchMyWorkouts(): Promise<{ logs: any[]; stats: { workoutsCompleted: number; totalMinutes: number; streakDays: number } }> {
    try {
      const response = await fetch(`${API_BASE}/workouts/me`);
      if (!response.ok) throw new Error(`Status: ${response.status}`);
      return await response.json();
    } catch {
      return { logs: [], stats: { workoutsCompleted: 0, totalMinutes: 0, streakDays: 0 } };
    }
  },

  // --- PERSONAL TRAINING PLAN ---

  async fetchMyPlan(): Promise<{ id: number; name: string; days: WorkoutDay[] } | null> {
    try {
      const response = await fetch(`${API_BASE}/plans/me`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.plan;
    } catch {
      return null;
    }
  },

  async savePlan(name: string, days: WorkoutDay[]): Promise<void> {
    await fetch(`${API_BASE}/plans/me`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, days }),
    });
  },

  // --- TRAINING QUESTIONNAIRE ---

  async fetchMyQuestionnaire(): Promise<QuestionnaireAnswers | null> {
    try {
      const response = await fetch(`${API_BASE}/questionnaire/me`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.answers;
    } catch {
      return null;
    }
  },

  async saveQuestionnaire(answers: QuestionnaireAnswers): Promise<{ assignedPlan: boolean }> {
    try {
      const response = await fetch(`${API_BASE}/questionnaire/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      if (!response.ok) return { assignedPlan: false };
      const data = await response.json();
      return { assignedPlan: !!data.assignedPlan };
    } catch {
      return { assignedPlan: false };
    }
  },

  // --- PLAN TEMPLATE CATALOG ---

  async fetchPlanTemplates(): Promise<PlanTemplate[]> {
    try {
      const response = await fetch(`${API_BASE}/plan-templates`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.templates;
    } catch {
      return [];
    }
  },

  async createPlanTemplate(template: PlanTemplate): Promise<void> {
    await fetch(`${API_BASE}/plan-templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(template),
    });
  },

  async savePlanTemplate(template: PlanTemplate): Promise<void> {
    await fetch(`${API_BASE}/plan-templates/${template.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(template),
    });
  },

  async deletePlanTemplate(id: string): Promise<void> {
    await fetch(`${API_BASE}/plan-templates/${id}`, { method: 'DELETE' });
  },

  // --- GYMS ---

  async fetchGyms(): Promise<Gym[]> {
    try {
      const response = await fetch(`${API_BASE}/gyms`);
      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const data = await response.json();
      return data.length > 0 ? data : [DEFAULT_GYM];
    } catch (error) {
      console.warn("Backend unavailable. Using local mock data.", error);
      const cached = localStorage.getItem('gym_locations');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {}
      }
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
    const cached = localStorage.getItem('gym_locations');
    let gyms: Gym[] = cached ? JSON.parse(cached) : [DEFAULT_GYM];
    gyms.push(gym);
    localStorage.setItem('gym_locations', JSON.stringify(gyms));
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
    const cached = localStorage.getItem('gym_locations');
    let gyms: Gym[] = cached ? JSON.parse(cached) : [DEFAULT_GYM];
    gyms = gyms.map(g => g.id === gym.id ? gym : g);
    localStorage.setItem('gym_locations', JSON.stringify(gyms));
  },

  async deleteGym(gymId: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/gyms/${gymId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.warn("Backend unavailable. Change not persisted to DB.");
    }
    const cached = localStorage.getItem('gym_locations');
    let gyms: Gym[] = cached ? JSON.parse(cached) : [DEFAULT_GYM];
    gyms = gyms.filter(g => g.id !== gymId);
    localStorage.setItem('gym_locations', JSON.stringify(gyms));
  },

  // --- EQUIPMENT LIBRARY ---

  async fetchEquipment(): Promise<EquipmentItem[]> {
    try {
      const response = await fetch(`${API_BASE}/equipment`);
      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const data = await response.json();
      return data.length > 0 ? data : DEFAULT_EQUIPMENT;
    } catch (error) {
      console.warn("Backend unavailable. Using local equipment storage.", error);
      const cached = localStorage.getItem('gym_equipment');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        } catch {}
      }
      localStorage.setItem('gym_equipment', JSON.stringify(DEFAULT_EQUIPMENT));
      return DEFAULT_EQUIPMENT;
    }
  },

  async createEquipment(equipment: EquipmentItem): Promise<void> {
    try {
      await fetch(`${API_BASE}/equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(equipment),
      });
    } catch (error) {
      console.warn("Backend save postponed. Syncing equipment locally.");
    }
    const cached = localStorage.getItem('gym_equipment');
    let list: EquipmentItem[] = cached ? JSON.parse(cached) : [...DEFAULT_EQUIPMENT];
    list.push(equipment);
    localStorage.setItem('gym_equipment', JSON.stringify(list));
  },

  async saveEquipment(equipment: EquipmentItem): Promise<void> {
    try {
      await fetch(`${API_BASE}/equipment/${equipment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(equipment),
      });
    } catch (error) {
      console.warn("Backend save postponed. Syncing equipment locally.");
    }
    const cached = localStorage.getItem('gym_equipment');
    let list: EquipmentItem[] = cached ? JSON.parse(cached) : [...DEFAULT_EQUIPMENT];
    list = list.map(item => item.id === equipment.id ? equipment : item);
    localStorage.setItem('gym_equipment', JSON.stringify(list));
  },

  async deleteEquipment(id: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/equipment/${id}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.warn("Backend delete postponed. Syncing equipment locally.");
    }
    const cached = localStorage.getItem('gym_equipment');
    let list: EquipmentItem[] = cached ? JSON.parse(cached) : [...DEFAULT_EQUIPMENT];
    list = list.filter(item => item.id !== id);
    localStorage.setItem('gym_equipment', JSON.stringify(list));
  },

  // --- EXERCISES & VIDEO LIBRARY ---

  async fetchExercises(): Promise<LibraryExercise[]> {
    try {
      const response = await fetch(`${API_BASE}/exercises`);
      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const data = await response.json();
      const list = data.length > 0 ? data : DEFAULT_EXERCISES;
      return sanitizeExerciseVideos(list);
    } catch (error) {
      console.warn("Backend unavailable. Using local fallback storage or default exercises.", error);
      const cached = localStorage.getItem('gym_exercises');
      if (cached) {
         try {
           const parsed = JSON.parse(cached);
           if (Array.isArray(parsed) && parsed.length > 0) {
             return sanitizeExerciseVideos(parsed);
           }
         } catch (e) { }
      }
      return sanitizeExerciseVideos(DEFAULT_EXERCISES);
    }
  },

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
    const cached = localStorage.getItem('gym_exercises');
    let exercises: LibraryExercise[] = cached ? JSON.parse(cached) : [...DEFAULT_EXERCISES];
    exercises.push(exercise);
    localStorage.setItem('gym_exercises', JSON.stringify(exercises));
  },

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
    const cached = localStorage.getItem('gym_exercises');
    let exercises: LibraryExercise[] = cached ? JSON.parse(cached) : [...DEFAULT_EXERCISES];
    exercises = exercises.map(ex => ex.id === exercise.id ? exercise : ex);
    localStorage.setItem('gym_exercises', JSON.stringify(exercises));
  },

  async deleteExercise(id: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/exercises/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error("API delete error");
    } catch (error) {
       console.warn("Backend delete postponed. Syncing locally.");
    }
    const cached = localStorage.getItem('gym_exercises');
    let exercises: LibraryExercise[] = cached ? JSON.parse(cached) : [...DEFAULT_EXERCISES];
    exercises = exercises.filter(ex => ex.id !== id);
    localStorage.setItem('gym_exercises', JSON.stringify(exercises));
  }
};

// Default high-quality standard exercises that declare their required equipment items
export const DEFAULT_EXERCISES: LibraryExercise[] = [
  {
    id: 'ex-squat',
    name: 'Barbell Squat',
    targetMuscle: 'Legs/Quads',
    equipmentRequired: 'Power Rack, Barbell',
    requiredEquipmentIds: ['eq-squat-rack', 'eq-barbell-plates'],
    category: 'Compound (Strength)',
    instructions: 'Keep your chest high, engage your core, squat deep in a full range of motion while maintaining flat heels on the floor.',
    equipmentId: 'zone-squat-racks',
    videoUrl: 'https://www.youtube.com/watch?v=ultWZbUMPL8',
    makeHarder: 'Add a 2-3 second pause at the bottom of the squat, use a 4-second slow descent tempo, or increase barbell load.',
    makeEasier: 'Elevate heels on small plates for ankle mobility, squat to a box or bench, or switch to a lighter goblet squat.'
  },
  {
    id: 'ex-bench-press',
    name: 'Bench Press',
    targetMuscle: 'Chest/Triceps',
    equipmentRequired: 'Bench, Barbell',
    requiredEquipmentIds: ['eq-barbell-plates', 'eq-adj-bench'],
    category: 'Compound (Strength)',
    instructions: 'Lie flat on the bench with eyes beneath the bar, plant feet firmly, unrack with locked arms, touch lower sternum under control, and press upward.',
    equipmentId: 'zone-squat-racks',
    videoUrl: 'https://www.youtube.com/watch?v=rT7DgCr-3pg',
    makeHarder: 'Add a 2-second pause with the barbell hovering just over the chest, or slow down lowering tempo to 3 seconds.',
    makeEasier: 'Perform floor press to reduce shoulder depth, switch to lighter dumbbells, or reduce working weight.'
  },
  {
    id: 'ex-db-row',
    name: 'Dumbbell Row',
    targetMuscle: 'Back/Lats',
    equipmentRequired: 'Dumbbells, Bench',
    requiredEquipmentIds: ['eq-dumbbells', 'eq-adj-bench'],
    category: 'Compound (Strength)',
    instructions: 'Place one knee and supporting hand firmly on the bench. Grip a dumbbell with the free hand, retract shoulder blade and drive elbow past torso towards hip.',
    equipmentId: 'zone-dumbbells',
    videoUrl: 'https://www.youtube.com/watch?v=roCP6wCXPqo',
    makeHarder: 'Hold 1-2 second contraction at top with elbow tucked high, or perform from an unsupported hinge stance.',
    makeEasier: 'Use a lighter dumbbell, or perform a chest-supported row lying prone on an incline bench.'
  },
  {
    id: 'ex-db-overhead-press',
    name: 'Overhead Press',
    targetMuscle: 'Shoulders/Delts',
    equipmentRequired: 'Dumbbells',
    requiredEquipmentIds: ['eq-dumbbells'],
    category: 'Compound (Strength)',
    instructions: 'Stand tall with dumbbells at shoulder height and palms facing forward. Press dumbbells overhead until arms are extended, then lower under steady control.',
    equipmentId: 'zone-dumbbells',
    videoUrl: 'https://www.youtube.com/watch?v=qEwKCR5JCog',
    makeHarder: 'Perform seated with no back support, or use a 3-second eccentric descent on each rep.',
    makeEasier: 'Perform seated with high back support on an adjustable bench to eliminate core stabilization fatigue.'
  },
  {
    id: 'ex-db-incline-press',
    name: 'Incline Dumbbell Bench Press',
    targetMuscle: 'Upper Chest/Anterior Deltoids',
    equipmentRequired: 'Dumbbells, Bench',
    requiredEquipmentIds: ['eq-dumbbells', 'eq-adj-bench'],
    category: 'Compound (Strength)',
    instructions: 'Set bench to 30°–45° incline. Kick dumbbells to shoulders, retract scapula, and press vertically without clashing weights together at lockout.',
    equipmentId: 'zone-dumbbells',
    videoUrl: 'https://www.youtube.com/watch?v=8iPEnn-ltC8',
    makeHarder: 'Slow down tempo to 3 seconds descent, or pause at the deep stretch position before driving upward.',
    makeEasier: 'Lower the bench incline to 15°-20°, or reduce dumbbell poundage for cleaner control.'
  },
  {
    id: 'ex-dumbbell-curl',
    name: 'Seated Dumbbell Hammer Curl',
    targetMuscle: 'Arms/Biceps',
    equipmentRequired: 'Dumbbells, Bench',
    requiredEquipmentIds: ['eq-dumbbells', 'eq-adj-bench'],
    category: 'Isolation (Hypertrophy)',
    instructions: 'Sit stable with chest proud, grip dumbbells with a neutral hammer orientation, keep elbows firmly tucked against your ribcage, and curl without swaying upper body shoulders.',
    equipmentId: 'zone-dumbbells',
    videoUrl: 'https://www.youtube.com/watch?v=yTwo27QT6Lg',
    makeHarder: 'Perform with back flat against a steep incline bench, or pause at 90-degree flexion.',
    makeEasier: 'Alternate arms one at a time to reduce fatigue, or use a slightly lighter dumbbell pair.'
  },
  {
    id: 'ex-deadlift',
    name: 'Conventional Barbell Deadlift',
    targetMuscle: 'Back/Posterior Chain',
    equipmentRequired: 'Olympic Barbell & Bumper Plates',
    requiredEquipmentIds: ['eq-barbell-plates'],
    category: 'Compound (Strength)',
    instructions: 'Stand with mid-foot beneath the barbell. Hinge hips back, brace lats, push floor away through heels while keeping spine neutral.',
    equipmentId: 'zone-squat-racks',
    videoUrl: 'https://www.youtube.com/watch?v=_oyxCn2iSjU',
    makeHarder: 'Perform deficit deadlifts standing on a 2-inch bumper plate, or pause for 2 seconds 1 inch off the floor.',
    makeEasier: 'Elevate barbell plates on blocks or rack pins (rack pull) to shorten range of motion and preserve lumbar form.'
  },
  {
    id: 'ex-lat-pulldown',
    name: 'Wide-Grip Lat Pulldown',
    targetMuscle: 'Back/Lats',
    equipmentRequired: 'Lat Pulldown Machine',
    requiredEquipmentIds: ['eq-lat-pulldown'],
    category: 'Compound (Strength)',
    instructions: 'Secure knees beneath thighs pad, grip wide, lean back slightly, pull bar down towards upper chest while driving elbows towards your back pockets.',
    equipmentId: 'zone-cable-cross',
    videoUrl: 'https://www.youtube.com/watch?v=CAwf7n6Luuc',
    makeHarder: 'Squeeze and pause at chest for 2 seconds, slow down the return to 3 seconds eccentric.',
    makeEasier: 'Switch to a close neutral grip attachment or lighten the weight stack.'
  },
  {
    id: 'ex-cable-chest-fly',
    name: 'Standing Cable Chest Fly',
    targetMuscle: 'Chest/Pectorals',
    equipmentRequired: 'Dual Cable Cross',
    requiredEquipmentIds: ['eq-cable-crossover'],
    category: 'Isolation (Hypertrophy)',
    instructions: 'Step forward into a staggered stance, keep slight elbow bend, hug forward in an arc motion focusing on maximum chest contraction at peak.',
    equipmentId: 'zone-cable-cross',
    videoUrl: 'https://www.youtube.com/watch?v=qEwKCR5JCog',
    makeHarder: 'Cross hands over slightly at peak contraction and hold for 2 seconds.',
    makeEasier: 'Step closer to the pulley origin or reduce weight stack resistance.'
  },
  {
    id: 'ex-tricep-pushdown',
    name: 'Cable Triceps Rope Pushdown',
    targetMuscle: 'Arms/Triceps',
    equipmentRequired: 'Dual Cable Cross / Cable Station',
    requiredEquipmentIds: ['eq-cable-crossover'],
    category: 'Isolation (Hypertrophy)',
    instructions: 'Pin elbows beside ribcage, extend arms downwards spreading the rope apart at the bottom contraction, control the return slowly.',
    equipmentId: 'zone-cable-cross',
    videoUrl: 'https://www.youtube.com/watch?v=SW_C1A-rejs',
    makeHarder: 'Spread rope widely at lockout and hold for 2 seconds before slow eccentric release.',
    makeEasier: 'Switch to a straight bar attachment or reduce weight setting.'
  },
  {
    id: 'ex-legpress',
    name: 'Machine Leg Press 45°',
    targetMuscle: 'Glutes/Quads',
    equipmentRequired: '45-Degree Plate-Loaded Leg Press',
    requiredEquipmentIds: ['eq-leg-press'],
    category: 'Compound (Strength)',
    instructions: 'Set deep comfortable feet placement, unlock structural handle safety pins, pull yourself down into seat support, and avoid rolling lower back off pad on negative phase.',
    equipmentId: 'zone-leg-press',
    videoUrl: 'https://www.youtube.com/watch?v=IZxyjW7MPJQ',
    makeHarder: 'Perform single-leg presses (unilateral), or add a 3-second descent tempo.',
    makeEasier: 'Place feet slightly higher on the carriage and limit bottom depth slightly.'
  },
  {
    id: 'ex-leg-extension',
    name: 'Seated Quadriceps Leg Extension',
    targetMuscle: 'Legs/Quads',
    equipmentRequired: 'Leg Extension Machine',
    requiredEquipmentIds: ['eq-leg-extension'],
    category: 'Isolation (Hypertrophy)',
    instructions: 'Align knee joint axis with machine pivot point. Extend legs fully, hold 1 second at top contraction, and control negative descent.',
    equipmentId: 'zone-leg-press',
    videoUrl: 'https://www.youtube.com/watch?v=IZxyjW7MPJQ',
    makeHarder: 'Hold 2-second peak isometric lock at top, or perform single-leg extensions.',
    makeEasier: 'Reduce stack weight and focus purely on smooth rhythmic movement without locking knees.'
  },
  {
    id: 'ex-rowing',
    name: 'Concept2 Rowing Conditioning',
    targetMuscle: 'Back/Full Body',
    equipmentRequired: 'Concept2 Rowing Machine',
    requiredEquipmentIds: ['eq-rower'],
    category: 'Cardio / Aerobic',
    instructions: 'Drive primarily with your legs by keeping heels flat, extend hips, and coordinate handles to follow after your body matches the lean angle.',
    equipmentId: 'zone-rowers',
    videoUrl: 'https://www.youtube.com/watch?v=H0r_Zcp4pG4',
    makeHarder: 'Increase damper setting or maintain a split pace under 1:45/500m with power sprints.',
    makeEasier: 'Lower damper setting to 3-4 and maintain a steady aerobic pace of 24-26 strokes/min.'
  },
  {
    id: 'ex-treadmill',
    name: 'Treadmill Run',
    targetMuscle: 'Cardio',
    equipmentRequired: 'Treadmill',
    requiredEquipmentIds: ['eq-treadmill'],
    category: 'Cardio / Aerobic',
    instructions: 'Set the target treadmill incline level and keep a steady active pace. Avoid holding onto handrails to maximize core engagement.',
    equipmentId: 'zone-treadmills',
    videoUrl: 'https://www.youtube.com/watch?v=8iPEnn-ltC8',
    makeHarder: 'Increase deck incline to 6%-10% or add high-speed sprint interval surges.',
    makeEasier: 'Reduce incline to 1% and transition from running to brisk power walking.'
  },
  {
    id: 'ex-pullup',
    name: 'Pull-up',
    targetMuscle: 'Back/Lats',
    equipmentRequired: 'Pull-up Bar',
    requiredEquipmentIds: ['eq-pullup-bar'],
    category: 'Compound (Strength)',
    instructions: 'Hang from overhead bar with pronated grip. Engage lats, pull chest up towards the bar until chin clears bar, lower under full control.',
    equipmentId: 'zone-functional-turf',
    videoUrl: 'https://www.youtube.com/watch?v=CAwf7n6Luuc',
    makeHarder: 'Wear a dip belt with added weight plates, or perform 3-second isometric pause at the top.',
    makeEasier: 'Loop a heavy resistance band under your foot/knee for assistance, or perform slow eccentric jump negatives.'
  },
  {
    id: 'ex-pushup',
    name: 'Push-up',
    targetMuscle: 'Chest/Core',
    equipmentRequired: 'Floor Space / Mat Area',
    requiredEquipmentIds: ['eq-floor-mat'],
    category: 'Bodyweight (Strength)',
    instructions: 'Hands under shoulders, body forming straight plank line. Lower chest to 2 inches from the floor, press up without letting hips sag.',
    equipmentId: 'zone-functional-turf',
    videoUrl: 'https://www.youtube.com/watch?v=rT7DgCr-3pg',
    makeHarder: 'Elevate your feet on a bench or box (decline push-up), or wear a weighted vest.',
    makeEasier: 'Elevate your hands on a bench/bar (incline push-up), or drop knees to the mat.'
  },
  {
    id: 'ex-plank',
    name: 'Plank',
    targetMuscle: 'Core',
    equipmentRequired: 'Floor Space / Mat Area',
    requiredEquipmentIds: ['eq-floor-mat'],
    category: 'Core / Stability',
    instructions: 'Rest on forearms with elbows beneath shoulders. Squeeze glutes and brace abs tightly, keeping a straight spine without arching.',
    equipmentId: 'zone-functional-turf',
    videoUrl: 'https://www.youtube.com/watch?v=SW_C1A-rejs',
    makeHarder: 'Squeeze glutes maximally and actively pull elbows towards toes (RKC Plank), or lift one foot alternating.',
    makeEasier: 'Perform from knees or elevate forearms onto an inclined bench or box.'
  },
  {
    id: 'ex-kettlebell-swing',
    name: 'Kettlebell Russian Swing',
    targetMuscle: 'Glutes/Hamstrings/Core',
    equipmentRequired: 'Kettlebells & Floor Space',
    requiredEquipmentIds: ['eq-kettlebells', 'eq-floor-mat'],
    category: 'Functional (Power)',
    instructions: 'Hinge hips back with kettlebell between legs. Snap hips violently forward to launch bell to eye level without using shoulder pulling power.',
    equipmentId: 'zone-functional-turf',
    videoUrl: 'https://www.youtube.com/watch?v=yTwo27QT6Lg',
    makeHarder: 'Use a single-arm grip alternating hands at the apex, or increase kettlebell weight.',
    makeEasier: 'Use a lighter kettlebell and practice the hip hinge pattern without explosive momentum.'
  },
  {
    id: 'ex-plyo-box-jump',
    name: 'Plyometric Box Jump',
    targetMuscle: 'Legs/Explosive Power',
    equipmentRequired: 'Plyo Box & Floor Space',
    requiredEquipmentIds: ['eq-plyo-box', 'eq-floor-mat'],
    category: 'Functional (Power)',
    instructions: 'Stand facing plyo box. Dip into a quarter squat, swing arms powerfully, jump explosively and land softly in athletic squat on top of box.',
    equipmentId: 'zone-functional-turf',
    videoUrl: 'https://www.youtube.com/watch?v=ultWZbUMPL8',
    makeHarder: 'Rotate box to higher height (30"), or perform depth jumps stepping down immediately into jump.',
    makeEasier: 'Rotate box to lowest height (20") or perform quick alternating step-ups instead of jumping.'
  }
];

