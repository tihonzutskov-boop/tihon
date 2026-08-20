
import { EquipmentType, GymZone, Gym } from './types';

// Shared with the admin Coaching roster so the questionnaire's goal
// options and the admin's grouping-by-goal can never drift apart.
export const QUESTIONNAIRE_GOALS = ['Weight loss', 'Muscle gain', 'General fitness', 'Endurance'];

// Mock Data
// Coordinates are RELATIVE to the gym floor top-left (0,0)
const DEFAULT_ZONES: GymZone[] = [
  // CARDIO ZONES (Blue #2563eb)
  {
    id: 'zone-treadmills',
    name: 'Treadmills',
    type: EquipmentType.CARDIO,
    x: 30,
    y: 30,
    width: 220,
    height: 100,
    color: '#2563eb', // Cardio Blue
    icon: 'Activity',
    description: 'Cardio warm-up & running area with digital incline and pace tracking.',
    equipmentIds: ['eq-treadmill'],
    machines: [
      { 
        id: 'tread-1', 
        name: 'Treadmill 1', 
        x: 20, y: 20, width: 35, height: 60,
        icon: 'Activity',
        videoUrl: 'https://www.youtube.com/embed/8iPEnn-ltC8',
        longDescription: 'Standard treadmill for warmups and cardio intervals. Features incline settings up to 15% and speeds up to 12mph.'
      },
      { id: 'tread-2', name: 'Treadmill 2', x: 70, y: 20, width: 35, height: 60, icon: 'Activity' },
      { id: 'tread-3', name: 'Treadmill 3', x: 120, y: 20, width: 35, height: 60, icon: 'Activity' },
      { id: 'tread-4', name: 'Treadmill 4', x: 170, y: 20, width: 35, height: 60, icon: 'Activity' },
    ]
  },
  {
    id: 'zone-rowers',
    name: 'Rowers',
    type: EquipmentType.CARDIO,
    x: 30,
    y: 145,
    width: 220,
    height: 95,
    color: '#2563eb', // Cardio Blue
    icon: 'Waves',
    description: 'Concept2 air-resistance rowers for full body conditioning and intervals.',
    equipmentIds: ['eq-rower'],
    machines: [
       { 
         id: 'row-1', 
         name: 'Rower A', 
         x: 20, y: 20, width: 55, height: 35,
         icon: 'Waves',
         videoUrl: 'https://www.youtube.com/embed/H0r_Zcp4pG4',
         longDescription: 'Concept2 Rower. Focus on driving with your legs before pulling with your arms. Great for full body conditioning.'
       },
       { id: 'row-2', name: 'Rower B', x: 90, y: 20, width: 55, height: 35, icon: 'Waves' },
       { id: 'row-3', name: 'Rower C', x: 155, y: 20, width: 50, height: 35, icon: 'Waves' },
    ]
  },

  // AMENITIES / FIXED INFRASTRUCTURE (Slate #475569)
  {
    id: 'zone-dumbbells',
    name: 'Dumbbell rack',
    type: EquipmentType.FREE_WEIGHTS,
    x: 30,
    y: 255,
    width: 220,
    height: 205,
    color: '#475569', // Solid slate
    icon: 'Dumbbell',
    description: 'Complete pairs of urethane dumbbells from 2kg to 50kg with adjustable benches.',
    equipmentIds: ['eq-dumbbells', 'eq-adj-bench'],
    machines: [
      { id: 'db-rack-main', name: 'Main Dumbbell Rack', x: 15, y: 15, width: 190, height: 40, icon: 'Dumbbell' },
      { id: 'bench-1', name: 'Incline Bench 1', x: 30, y: 80, width: 40, height: 80, icon: 'BicepsFlexed' },
      { id: 'bench-2', name: 'Flat Bench 2', x: 90, y: 80, width: 40, height: 80, icon: 'BicepsFlexed' },
      { id: 'bench-3', name: 'Incline Bench 3', x: 150, y: 80, width: 40, height: 80, icon: 'BicepsFlexed' },
    ]
  },

  // FUNCTIONAL TURF ZONE (Green #059669)
  {
    id: 'zone-functional-turf',
    name: 'Functional turf',
    type: EquipmentType.FUNCTIONAL,
    x: 265,
    y: 30,
    width: 220,
    height: 210,
    color: '#059669', // Green
    icon: 'Flame',
    description: 'Sprint track, kettlebells, battle ropes, plyo boxes and mobility mats.',
    equipmentIds: ['eq-floor-mat', 'eq-pullup-bar', 'eq-kettlebells', 'eq-plyo-box', 'eq-resistance-bands']
  },

  // STRENGTH MACHINES & CABLES (Terracotta #9a3412)
  {
    id: 'zone-cable-cross',
    name: 'Cable cross',
    type: EquipmentType.MACHINE,
    x: 265,
    y: 255,
    width: 220,
    height: 95,
    color: '#9a3412', // Terracotta
    icon: 'Sliders',
    description: 'Dual adjustable cable cross columns with multi-grip pull-up bar.',
    equipmentIds: ['eq-cable-crossover', 'eq-lat-pulldown', 'eq-pullup-bar'],
    machines: [
      { id: 'cable-tower', name: 'Dual Cable Cross', x: 20, y: 15, width: 180, height: 60, icon: 'Sliders' }
    ]
  },
  {
    id: 'zone-leg-press',
    name: 'Leg press',
    type: EquipmentType.MACHINE,
    x: 265,
    y: 365,
    width: 220,
    height: 95,
    color: '#9a3412', // Terracotta
    icon: 'Disc',
    description: '45-degree linear leg press and seated leg extension stations.',
    equipmentIds: ['eq-leg-press', 'eq-leg-extension'],
    machines: [
      {
        id: 'leg-press-1',
        name: '45° Leg Press',
        x: 20, y: 15, width: 80, height: 65,
        icon: 'Disc',
        videoUrl: 'https://www.youtube.com/embed/IZxyjW7MPJQ',
        longDescription: '45-degree leg press machine. Ensure back is flat against the pad and do not lock knees at the top of the movement.'
      },
      { id: 'leg-ext-1', name: 'Leg Extension', x: 120, y: 15, width: 75, height: 65, icon: 'Disc' }
    ]
  },

  // STRENGTH SQUAT RACKS (Terracotta #9a3412)
  {
    id: 'zone-squat-racks',
    name: 'Squat racks',
    type: EquipmentType.RACK,
    x: 500,
    y: 30,
    width: 220,
    height: 210,
    color: '#9a3412', // Terracotta
    icon: 'Weight',
    description: 'Olympic power racks with integrated oak lifting platforms and bumper plates.',
    equipmentIds: ['eq-squat-rack', 'eq-barbell-plates', 'eq-adj-bench'],
    machines: [
      { 
        id: 'rack-1', 
        name: 'Power Rack 1', 
        x: 20, y: 20, width: 70, height: 70,
        icon: 'Weight',
        videoUrl: 'https://www.youtube.com/embed/ultWZbUMPL8',
        longDescription: 'Power Rack suitable for Squats, Overhead Press, and Rack Pulls. Includes safety bars and pull-up handles.'
      },
      { id: 'rack-2', name: 'Power Rack 2', x: 120, y: 20, width: 70, height: 70, icon: 'Weight' },
      { id: 'rack-3', name: 'Power Rack 3', x: 20, y: 115, width: 70, height: 70, icon: 'Weight' },
      { id: 'rack-4', name: 'Power Rack 4', x: 120, y: 115, width: 70, height: 70, icon: 'Weight' },
    ]
  },

  // AMENITIES: FRONT DESK & RECEPTION (Slate #475569)
  {
    id: 'zone-front-desk',
    name: 'Front desk',
    type: EquipmentType.RECEPTION,
    x: 500,
    y: 255,
    width: 220,
    height: 205,
    color: '#475569', // Solid slate
    icon: 'DoorOpen',
    description: 'Front desk, check-in terminal, locker key pickup & member assistance.'
  }
];

export const DEFAULT_GYM: Gym = {
  id: 'default-gym',
  name: 'Main Location',
  zones: DEFAULT_ZONES,
  dimensions: { width: 750, height: 490 },
  entrance: { side: 'bottom', offset: 50, width: 100 },
  floorColor: '#141d2f'
};

// For backward compatibility if needed
export const GYM_ZONES = DEFAULT_ZONES;

