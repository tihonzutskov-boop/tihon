
import { EquipmentType, GymZone, Gym } from './types';

// Mock Data
// Coordinates are now RELATIVE to the gym floor top-left (0,0)
const DEFAULT_ZONES: GymZone[] = [
  {
    id: 'zone-cardio-1',
    name: 'Treadmills',
    type: EquipmentType.CARDIO,
    x: 40,
    y: 40,
    width: 200,
    height: 100,
    color: '#38bdf8', // Sky blue
    icon: 'Treadmill',
  },
  {
    id: 'zone-cardio-2',
    name: 'Rowers',
    type: EquipmentType.CARDIO,
    x: 40,
    y: 170,
    width: 200,
    height: 60,
    color: '#38bdf8',
    icon: 'Waves',
  },
  {
    id: 'zone-weights-1',
    name: 'Dumbbell Rack',
    type: EquipmentType.FREE_WEIGHTS,
    x: 40,
    y: 340,
    width: 250,
    height: 200,
    color: '#fbbf24', // Amber
    icon: 'Dumbbell',
  },
  {
    id: 'zone-turf',
    name: 'Functional Turf',
    type: EquipmentType.FUNCTIONAL,
    x: 290,
    y: 40,
    width: 200,
    height: 500,
    color: '#a3e635', // Lime
    icon: 'Activity',
  },
  {
    id: 'zone-racks',
    name: 'Squat Racks',
    type: EquipmentType.RACK,
    x: 540,
    y: 40,
    width: 200,
    height: 200,
    color: '#f87171', // Red
    icon: 'Box',
  },
  {
    id: 'zone-machines-1',
    name: 'Cable Cross',
    type: EquipmentType.MACHINE,
    x: 540,
    y: 290,
    width: 100,
    height: 100,
    color: '#c084fc', // Purple
    icon: 'Cable',
  },
  {
    id: 'zone-machines-2',
    name: 'Leg Press',
    type: EquipmentType.MACHINE,
    x: 670,
    y: 290,
    width: 80,
    height: 100,
    color: '#c084fc',
    icon: 'Disc',
  },
  {
    id: 'zone-bench',
    name: 'Bench Press',
    type: EquipmentType.FREE_WEIGHTS,
    x: 540,
    y: 440,
    width: 200,
    height: 100,
    color: '#fbbf24',
    icon: 'ArrowDown',
  }
];

export const DEFAULT_GYM: Gym = {
  id: 'default-gym',
  name: 'Main Location',
  zones: DEFAULT_ZONES,
  dimensions: { width: 780, height: 580 },
  entrance: { side: 'bottom', offset: 50, width: 80 },
  floorColor: '#1e293b'
};

// For backward compatibility if needed, though we primarily use DEFAULT_GYM now
export const GYM_ZONES = DEFAULT_ZONES;
