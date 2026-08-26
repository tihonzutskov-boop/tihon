import React from 'react';
import {
  Activity,
  Zap,
  Target,
  Box,
  Layers,
  Timer,
  DoorOpen,
  Lock,
  Bath,
  Droplets,
  Building2,
  Users,
  Coffee,
  ShowerHead,
  Sprout,
  ShieldCheck,
  Anchor,
  Repeat,
  ChevronsRight,
  Info,
  Sparkles,
  LucideProps
} from 'lucide-react';
// Hand-drawn pixel-art set for the actual machine/equipment icons (see that
// file for why: no open pixel-art icon set has real gym equipment icons).
import {
  Dumbbell,
  Footprints,
  Bike,
  Waves,
  Weight,
  BicepsFlexed,
  Sliders,
  Disc,
  HeartPulse,
  Flame,
  Gauge,
  Shield,
} from '../components/icons/PixelMachineIcons';
import { EquipmentType, GymZone, GymMachine } from '../types';

export const ICON_MAP: Record<string, React.FC<LucideProps>> = {
  Dumbbell,
  Footprints,
  Bike,
  Waves,
  Weight,
  BicepsFlexed,
  Sliders,
  Disc,
  HeartPulse,
  Flame,
  Gauge,
  Shield,
  Activity,
  Zap,
  Target,
  Box,
  Layers,
  Timer,
  DoorOpen,
  Lock,
  Bath,
  Droplets,
  Building2,
  Users,
  Coffee,
  ShowerHead,
  Sprout,
  ShieldCheck,
  Anchor,
  Repeat,
  ChevronsRight,
  Info,
  Sparkles
};

export const MACHINE_ICONS_LIST = [
  { name: 'Dumbbell', label: 'Dumbbells / Free Weights', icon: Dumbbell },
  { name: 'Footprints', label: 'Treadmill / Running', icon: Footprints },
  { name: 'Bike', label: 'Exercise Bike / Cycle', icon: Bike },
  { name: 'Waves', label: 'Rowing Machine / Rower', icon: Waves },
  { name: 'Weight', label: 'Squat Rack / Barbell', icon: Weight },
  { name: 'BicepsFlexed', label: 'Bench Press / Arms', icon: BicepsFlexed },
  { name: 'Sliders', label: 'Cable Machine / Pulleys', icon: Sliders },
  { name: 'Disc', label: 'Leg Press / Plate Loaded', icon: Disc },
  { name: 'HeartPulse', label: 'Cardio / Aerobics', icon: HeartPulse },
  { name: 'Flame', label: 'Functional Turf / HIIT', icon: Flame },
  { name: 'Gauge', label: 'Weight Stack / Machine', icon: Gauge },
  { name: 'Shield', label: 'Power Rig / Safety Cage', icon: Shield },
  { name: 'DoorOpen', label: 'Reception / Entrance', icon: DoorOpen },
  { name: 'Lock', label: 'Locker Rooms', icon: Lock },
  { name: 'Bath', label: 'Restrooms / Toilets', icon: Bath },
  { name: 'Droplets', label: 'Water Station', icon: Droplets },
  { name: 'Users', label: 'Group Fitness / Classes', icon: Users },
  { name: 'Activity', label: 'General Activity', icon: Activity },
  { name: 'Timer', label: 'Interval Timer', icon: Timer },
];

export function isAmenityZone(zone: { type?: string | EquipmentType; name?: string } | string): boolean {
  if (typeof zone === 'string') {
    const text = zone.toLowerCase();
    return (
      text.includes('locker') ||
      text.includes('changing') ||
      text.includes('wardrobe') ||
      text.includes('front desk') ||
      text.includes('reception') ||
      text.includes('desk') ||
      text.includes('wc') ||
      text.includes('toilet') ||
      text.includes('restroom') ||
      text.includes('bathroom') ||
      text.includes('shower') ||
      text.includes('sauna') ||
      text.includes('water') ||
      text.includes('hydration') ||
      text.includes('fountain') ||
      text.includes('cafe') ||
      text.includes('café') ||
      text.includes('office') ||
      text.includes('storage') ||
      text.includes('lobby') ||
      text.includes('entrance') ||
      text.includes('exit') ||
      text.includes('corridor') ||
      text.includes('facility') ||
      text.includes('lounge') ||
      text.includes('class') ||
      text.includes('studio') ||
      text.includes('yoga') ||
      text.includes('pilates') ||
      text.includes('zumba')
    );
  }

  const type = zone.type;
  const name = (zone.name || '').toLowerCase();

  const amenityTypes: (EquipmentType | string)[] = [
    EquipmentType.RECEPTION,
    EquipmentType.CHANGING,
    EquipmentType.TOILETS,
    EquipmentType.FACILITY,
    EquipmentType.CORRIDOR,
    EquipmentType.LOBBY,
    EquipmentType.SHOWERS,
    EquipmentType.SAUNA,
    EquipmentType.POOL,
    EquipmentType.OFFICE,
    EquipmentType.STORAGE,
    EquipmentType.CAFE,
    EquipmentType.STUDIO,
  ];

  if (type && amenityTypes.includes(type as EquipmentType)) {
    return true;
  }

  return (
    name.includes('locker') ||
    name.includes('changing') ||
    name.includes('wardrobe') ||
    name.includes('front desk') ||
    name.includes('reception') ||
    name.includes('desk') ||
    name.includes('wc') ||
    name.includes('toilet') ||
    name.includes('restroom') ||
    name.includes('bathroom') ||
    name.includes('shower') ||
    name.includes('sauna') ||
    name.includes('water') ||
    name.includes('hydration') ||
    name.includes('fountain') ||
    name.includes('cafe') ||
    name.includes('café') ||
    name.includes('office') ||
    name.includes('storage') ||
    name.includes('lobby') ||
    name.includes('entrance') ||
    name.includes('exit') ||
    name.includes('lounge') ||
    name.includes('infirmary') ||
    name.includes('first aid') ||
    name.includes('class') ||
    name.includes('studio') ||
    name.includes('yoga') ||
    name.includes('pilates') ||
    name.includes('zumba')
  );
}

export interface AmenityStyleConfig {
  fill: string;
  stroke: string;
  badgeBg: string;
  badgeBorder: string;
  badgeIconColor: string;
  textColor: string;
  categoryLabel: string;
  Icon: React.FC<LucideProps>;
}

export function getAmenityStyleConfig(zone: { type?: string | EquipmentType; name?: string; icon?: string }): AmenityStyleConfig {
  const name = (zone.name || '').toLowerCase();
  const type = (zone.type || '') as EquipmentType;
  const Icon = getEquipmentIcon(zone.icon, zone.name, zone.type);

  // 1. Lockers / Changing Room (Neutral Muted Solid Slate/Gray)
  if (type === EquipmentType.CHANGING || name.includes('locker') || name.includes('changing') || name.includes('wardrobe')) {
    return {
      fill: '#1e293b', // Muted slate fill
      stroke: '#475569', // Solid slate border
      badgeBg: '#334155', // Circular badge container
      badgeBorder: '#64748b',
      badgeIconColor: '#cbd5e1',
      textColor: '#f8fafc',
      categoryLabel: 'Locker Rooms',
      Icon: Lock
    };
  }

  // 2. Front Desk / Reception / Lobby (Muted Soft Blue Solid)
  if (type === EquipmentType.RECEPTION || type === EquipmentType.LOBBY || name.includes('desk') || name.includes('reception') || name.includes('lobby') || name.includes('entrance')) {
    return {
      fill: '#172554', // Dark solid soft blue
      stroke: '#38bdf8', // Solid sky blue border
      badgeBg: '#1e3a8a', // Badge container
      badgeBorder: '#60a5fa',
      badgeIconColor: '#7dd3fc',
      textColor: '#f0f9ff',
      categoryLabel: 'Front Desk',
      Icon: DoorOpen
    };
  }

  // 3. Restrooms / WC / Toilets / Bathrooms (Muted Soft Lavender/Violet Solid)
  if (type === EquipmentType.TOILETS || name.includes('wc') || name.includes('toilet') || name.includes('restroom') || name.includes('bathroom')) {
    return {
      fill: '#2e1065', // Dark solid lavender/purple
      stroke: '#a855f7', // Solid purple border
      badgeBg: '#3b0764',
      badgeBorder: '#c084fc',
      badgeIconColor: '#d8b4fe',
      textColor: '#faf5ff',
      categoryLabel: 'Restrooms',
      Icon: Bath
    };
  }

  // 4. Water Station / Hydration / Facility (Muted Soft Cyan/Teal Solid)
  if (type === EquipmentType.FACILITY || name.includes('water') || name.includes('drink') || name.includes('fountain') || name.includes('hydration')) {
    return {
      fill: '#083344', // Dark solid cyan/teal
      stroke: '#22d3ee', // Solid teal border
      badgeBg: '#164e63',
      badgeBorder: '#67e8f9',
      badgeIconColor: '#a5f3fc',
      textColor: '#ecfeff',
      categoryLabel: 'Water Station',
      Icon: Droplets
    };
  }

  // 5. Showers / Sauna / Pool
  if (type === EquipmentType.SHOWERS || type === EquipmentType.SAUNA || type === EquipmentType.POOL || name.includes('shower') || name.includes('sauna') || name.includes('pool')) {
    return {
      fill: '#0f2d3d',
      stroke: '#38bdf8',
      badgeBg: '#1e40af',
      badgeBorder: '#60a5fa',
      badgeIconColor: '#93c5fd',
      textColor: '#f0f9ff',
      categoryLabel: 'Showers & Sauna',
      Icon: ShowerHead || Droplets
    };
  }

  // 6. Café / Lounge
  if (type === EquipmentType.CAFE || name.includes('cafe') || name.includes('coffee') || name.includes('lounge')) {
    return {
      fill: '#451a03',
      stroke: '#d97706',
      badgeBg: '#78350f',
      badgeBorder: '#fbbf24',
      badgeIconColor: '#fde68a',
      textColor: '#fffbeb',
      categoryLabel: 'Café & Lounge',
      Icon: Coffee
    };
  }

  // Default Amenity (Clean Muted Gray Solid)
  return {
    fill: '#1e293b',
    stroke: '#64748b',
    badgeBg: '#334155',
    badgeBorder: '#475569',
    badgeIconColor: '#94a3b8',
    textColor: '#f1f5f9',
    categoryLabel: 'Amenity',
    Icon
  };
}

/**
 * Visual Category Taxonomy matching the modern clean architectural design
 */
export type ZoneVisualCategory = 'strength' | 'cardio' | 'functional' | 'amenities';

export interface ZoneThemeStyle {
  fill: string;
  stroke: string;
  dashStroke: string;
  textColor: string;
}

export function getZoneThemeStyle(zone: { type?: string | EquipmentType; name?: string; color?: string }): ZoneThemeStyle {
  const name = (zone.name || '').toLowerCase();
  const type = (zone.type || '') as EquipmentType;

  // An admin-picked color (via the zone editor's Color Code field) always
  // wins over the auto-detected theme below — otherwise picking a color
  // has no visible effect for any zone whose name/type happens to match
  // one of the keyword categories, which is nearly all of them. No zone
  // in this app is ever created with color unset, so every hex value
  // (including black/white) is treated as a deliberate choice. Fill is a
  // plain opaque hex — the glass-vs-solid transparency for training vs.
  // amenity zones is applied uniformly via fillOpacity where this is
  // consumed (GymMap.tsx), not baked into the color itself.
  if (zone.color && zone.color.startsWith('#')) {
    return {
      fill: zone.color,
      stroke: zone.color,
      dashStroke: zone.color,
      textColor: '#ffffff'
    };
  }

  // 1. Treadmills / Rowers / Cardio -> Deep Cyan/Ocean Blue
  if (
    type === EquipmentType.CARDIO ||
    name.includes('treadmill') ||
    name.includes('rower') ||
    name.includes('bike') ||
    name.includes('cycle') ||
    name.includes('cardio') ||
    name.includes('elliptical')
  ) {
    return {
      fill: '#1c456b',
      stroke: '#0284c7',
      dashStroke: '#38bdf8',
      textColor: '#ffffff'
    };
  }

  // 2. Functional Turf / Stretch / HIIT / Calisthenics -> Rich Olive/Forest Green
  if (
    type === EquipmentType.FUNCTIONAL ||
    name.includes('turf') ||
    name.includes('functional') ||
    name.includes('stretch') ||
    name.includes('mobility') ||
    name.includes('hiit') ||
    name.includes('sprint')
  ) {
    return {
      fill: '#3f6136',
      stroke: '#65a30d',
      dashStroke: '#84cc16',
      textColor: '#ffffff'
    };
  }

  // 3. Squat Racks / Power Racks / Heavy Barbell Racks -> Wine Maroon / Burgundy Red
  if (
    type === EquipmentType.RACK ||
    name.includes('squat') ||
    name.includes('power rack') ||
    name.includes('deadlift') ||
    name.includes('olympic')
  ) {
    return {
      fill: '#69333d',
      stroke: '#e11d48',
      dashStroke: '#f43f5e',
      textColor: '#ffffff'
    };
  }

  // 4. Dumbbell Rack / Free Weights / Bench Press / Benches -> Warm Amber / Golden Ochre / Bronze
  if (
    type === EquipmentType.FREE_WEIGHTS ||
    name.includes('dumbbell') ||
    name.includes('bench') ||
    name.includes('kettlebell') ||
    name.includes('weight')
  ) {
    return {
      fill: '#6b562a',
      stroke: '#ca8a04',
      dashStroke: '#eab308',
      textColor: '#ffffff'
    };
  }

  // 5. Cable Cross / Leg Press / Strength Machines -> Rich Purple / Violet
  if (
    type === EquipmentType.MACHINE ||
    name.includes('cable') ||
    name.includes('press') ||
    name.includes('pulley') ||
    name.includes('machine') ||
    name.includes('extension') ||
    name.includes('curl') ||
    name.includes('lat')
  ) {
    return {
      fill: '#493169',
      stroke: '#9333ea',
      dashStroke: '#a855f7',
      textColor: '#ffffff'
    };
  }

  // 6. Group Fitness Studio / Classes -> Rose / Magenta
  if (
    type === EquipmentType.STUDIO ||
    name.includes('class') ||
    name.includes('studio') ||
    name.includes('yoga') ||
    name.includes('pilates') ||
    name.includes('zumba') ||
    name.includes('spin room')
  ) {
    return {
      fill: '#5b1f3d',
      stroke: '#e11d8f',
      dashStroke: '#f472b6',
      textColor: '#ffffff'
    };
  }

  // 7. Amenities: Front Desk, Lockers, Restrooms, Toilets, Showers, Water Station -> Deep Slate Navy
  if (
    type === EquipmentType.RECEPTION ||
    type === EquipmentType.CHANGING ||
    type === EquipmentType.TOILETS ||
    type === EquipmentType.FACILITY ||
    name.includes('front desk') ||
    name.includes('reception') ||
    name.includes('locker') ||
    name.includes('toilet') ||
    name.includes('restroom') ||
    name.includes('bath') ||
    name.includes('water') ||
    name.includes('hydration') ||
    name.includes('fountain')
  ) {
    return {
      fill: '#243447',
      stroke: '#64748b',
      dashStroke: '#94a3b8',
      textColor: '#ffffff'
    };
  }

  return {
    fill: '#334155',
    stroke: '#64748b',
    dashStroke: '#94a3b8',
    textColor: '#ffffff'
  };
}

export const VISUAL_CATEGORY_STYLES: Record<ZoneVisualCategory, {
  color: string;
  stroke: string;
  badgeColor: string;
  label: string;
}> = {
  strength: {
    color: '#ea580c', // Vibrant Orange / Terracotta
    stroke: '#ea580c',
    badgeColor: '#ea580c',
    label: 'Strength'
  },
  cardio: {
    color: '#3b82f6', // Bright Royal Blue
    stroke: '#3b82f6',
    badgeColor: '#3b82f6',
    label: 'Cardio'
  },
  functional: {
    color: '#10b981', // Vivid Emerald Green
    stroke: '#10b981',
    badgeColor: '#10b981',
    label: 'Functional'
  },
  amenities: {
    color: '#94a3b8', // Refined Silver Slate
    stroke: '#94a3b8',
    badgeColor: '#94a3b8',
    label: 'Amenities'
  }
};

export function getZoneVisualCategory(zone: { type?: string | EquipmentType; name?: string; color?: string } | string): ZoneVisualCategory {
  const name = (typeof zone === 'string' ? zone : (zone.name || '')).toLowerCase();
  const type = typeof zone === 'string' ? '' : (zone.type || '');

  // 1. Amenities & Infrastructure
  if (
    type === EquipmentType.RECEPTION || 
    type === EquipmentType.CHANGING || 
    type === EquipmentType.TOILETS || 
    type === EquipmentType.FACILITY || 
    type === EquipmentType.CORRIDOR ||
    type === EquipmentType.LOBBY ||
    type === EquipmentType.SHOWERS ||
    type === EquipmentType.SAUNA ||
    type === EquipmentType.POOL ||
    type === EquipmentType.CAFE ||
    name.includes('front desk') || 
    name.includes('desk') || 
    name.includes('reception') || 
    name.includes('locker') || 
    name.includes('restroom') || 
    name.includes('toilet') || 
    name.includes('water') || 
    name.includes('facility') || 
    name.includes('amenity') || 
    name.includes('hallway') ||
    name.includes('dumbbell rack')
  ) {
    return 'amenities';
  }

  // 2. Cardio
  if (
    type === EquipmentType.CARDIO || 
    name.includes('cardio') || 
    name.includes('treadmill') || 
    name.includes('rower') || 
    name.includes('rowing') || 
    name.includes('bike') || 
    name.includes('cycle') || 
    name.includes('spin') || 
    name.includes('stair') || 
    name.includes('elliptical')
  ) {
    return 'cardio';
  }

  // 3. Functional
  if (
    type === EquipmentType.FUNCTIONAL || 
    name.includes('turf') || 
    name.includes('functional') || 
    name.includes('stretch') || 
    name.includes('mobility') || 
    name.includes('hiit') || 
    name.includes('crossfit') || 
    name.includes('sled') || 
    name.includes('track') || 
    name.includes('calisthenic')
  ) {
    return 'functional';
  }

  // 4. Default: Strength (Power racks, Squat racks, Cable cross, Leg press, Free weights, Weight machines)
  return 'strength';
}

/**
 * Color Taxonomy tied to zone function
 */
export const ZONE_TAXONOMY_CONFIG: Record<string, {
  color: string;
  borderColor: string;
  label: string;
  iconName: string;
}> = {
  [EquipmentType.CARDIO]: {
    color: '#2563eb', // Blue
    borderColor: '#2563eb',
    label: 'Cardio',
    iconName: 'Activity'
  },
  [EquipmentType.MACHINE]: {
    color: '#9a3412', // Terracotta
    borderColor: '#9a3412',
    label: 'Strength Machines',
    iconName: 'Sliders'
  },
  [EquipmentType.FREE_WEIGHTS]: {
    color: '#475569', // Slate
    borderColor: '#475569',
    label: 'Free Weights',
    iconName: 'Dumbbell'
  },
  [EquipmentType.RACK]: {
    color: '#9a3412', // Terracotta
    borderColor: '#9a3412',
    label: 'Power & Squat Racks',
    iconName: 'Weight'
  },
  [EquipmentType.FUNCTIONAL]: {
    color: '#059669', // Emerald Green
    borderColor: '#059669',
    label: 'Functional Turf',
    iconName: 'Flame'
  },
  [EquipmentType.RECEPTION]: {
    color: '#475569', // Slate
    borderColor: '#475569',
    label: 'Front Desk',
    iconName: 'Info'
  },
  [EquipmentType.CHANGING]: {
    color: '#475569', // Slate
    borderColor: '#475569',
    label: 'Locker Rooms',
    iconName: 'Lock'
  },
  [EquipmentType.TOILETS]: {
    color: '#475569', // Slate
    borderColor: '#475569',
    label: 'Restrooms',
    iconName: 'Bath'
  },
  [EquipmentType.FACILITY]: {
    color: '#06b6d4', // Cyan
    borderColor: '#06b6d4',
    label: 'Water Station',
    iconName: 'Droplets'
  },
  [EquipmentType.CORRIDOR]: {
    color: '#64748b', // Slate
    borderColor: '#94a3b8',
    label: 'Walkways',
    iconName: 'Footprints'
  },
  [EquipmentType.STUDIO]: {
    color: '#e11d8f', // Rose / Magenta
    borderColor: '#e11d8f',
    label: 'Classes',
    iconName: 'Users'
  }
};

/**
 * Returns functional color for a zone
 */
export function getTaxonomyColor(type: string | EquipmentType, fallbackColor?: string): string {
  if (ZONE_TAXONOMY_CONFIG[type]) {
    return ZONE_TAXONOMY_CONFIG[type].color;
  }
  return fallbackColor || '#0284c7';
}

/**
 * Checks if a zone, equipment, or exercise is Beginner Friendly
 */
export function isBeginnerFriendly(item: { type?: string; name?: string; category?: string; equipmentRequired?: string } | string): boolean {
  if (typeof item === 'string') {
    const text = item.toLowerCase();
    return (
      text.includes('cardio') ||
      text.includes('treadmill') ||
      text.includes('bike') ||
      text.includes('rower') ||
      text.includes('machine') ||
      text.includes('cable') ||
      text.includes('lat pull') ||
      text.includes('leg press') ||
      text.includes('chest press') ||
      text.includes('water') ||
      text.includes('reception') ||
      text.includes('locker') ||
      text.includes('turf') ||
      text.includes('stretching') ||
      text.includes('mat') ||
      text.includes('beginner')
    );
  }

  const type = item.type || '';
  const name = (item.name || '').toLowerCase();
  const category = (item.category || '').toLowerCase();

  // Landmarks & amenities
  if ([EquipmentType.RECEPTION, EquipmentType.CHANGING, EquipmentType.TOILETS, EquipmentType.FACILITY].includes(type as EquipmentType)) {
    return true;
  }

  // Cardio, Selectorized Machines, Functional Turf are beginner friendly
  if (type === EquipmentType.CARDIO || type === EquipmentType.MACHINE || type === EquipmentType.FUNCTIONAL) {
    return true;
  }

  // Text matching
  if (
    name.includes('treadmill') ||
    name.includes('bike') ||
    name.includes('rower') ||
    name.includes('cable') ||
    name.includes('lat pull') ||
    name.includes('leg press') ||
    name.includes('chest press') ||
    name.includes('stretching') ||
    name.includes('turf') ||
    name.includes('water') ||
    category.includes('cardio') ||
    category.includes('machine') ||
    category.includes('stretching')
  ) {
    return true;
  }

  return false;
}

/**
 * Returns the best matching Lucide icon for a given equipment name, icon string, or zone type.
 */
export function getEquipmentIcon(iconName?: string, name?: string, type?: string): React.FC<LucideProps> {
  // 1. Direct match in ICON_MAP
  if (iconName && ICON_MAP[iconName]) {
    return ICON_MAP[iconName];
  }

  // 2. Fallback based on text matching
  const text = `${name || ''} ${type || ''}`.toLowerCase();

  if (text.includes('front desk') || text.includes('reception') || text.includes('desk') || text.includes('info')) {
    return Info;
  }
  if (text.includes('locker') || text.includes('changing') || text.includes('wardrobe')) {
    return Lock;
  }
  if (text.includes('restroom') || text.includes('toilet') || text.includes('bathroom') || text.includes('wc') || text.includes('shower')) {
    return Bath;
  }
  if (text.includes('water') || text.includes('fountain') || text.includes('drink') || text.includes('hydration')) {
    return Droplets;
  }
  if (text.includes('class') || text.includes('studio') || text.includes('yoga') || text.includes('pilates') || text.includes('zumba')) {
    return Users;
  }
  if (text.includes('treadmill') || text.includes('tread') || text.includes('run') || text.includes('walk')) {
    return Activity;
  }
  if (text.includes('row') || text.includes('rower') || text.includes('concept2')) {
    return Anchor;
  }
  if (text.includes('bike') || text.includes('cycle') || text.includes('spin')) {
    return Bike;
  }
  if (text.includes('dumbbell') || text.includes('db ') || text.includes('free weight')) {
    return Dumbbell;
  }
  if (text.includes('squat') || text.includes('rack') || text.includes('power cage') || text.includes('barbell') || text.includes('deadlift')) {
    return Dumbbell;
  }
  if (text.includes('bench') || text.includes('bicep') || text.includes('chest') || text.includes('tricep')) {
    return BicepsFlexed;
  }
  if (text.includes('cable') || text.includes('cross') || text.includes('pulley') || text.includes('lat pull')) {
    return Repeat;
  }
  if (text.includes('leg press') || text.includes('hack') || text.includes('plate') || text.includes('press')) {
    return ChevronsRight;
  }
  if (text.includes('turf') || text.includes('functional') || text.includes('hiit') || text.includes('stretch')) {
    return Activity;
  }

  // 3. Fallback based on EquipmentType
  if (type === EquipmentType.CARDIO) return Activity;
  if (type === EquipmentType.FREE_WEIGHTS) return Dumbbell;
  if (type === EquipmentType.RACK) return Dumbbell;
  if (type === EquipmentType.MACHINE) return Repeat;
  if (type === EquipmentType.FUNCTIONAL) return Activity;
  if (type === EquipmentType.RECEPTION) return Info;
  if (type === EquipmentType.CHANGING) return Lock;
  if (type === EquipmentType.TOILETS) return Bath;
  if (type === EquipmentType.FACILITY) return Droplets;
  if (type === EquipmentType.STUDIO) return Users;

  return Dumbbell;
}

