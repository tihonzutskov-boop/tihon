import { GymZone, LibraryExercise, Exercise, Gym, GymMachine, EquipmentType } from '../types';
import { getEnglishExerciseName } from '../translations';

/**
 * Standardize text helper (lowercase, trimmed, collapsed whitespace, punctuation stripped).
 */
export function normalizeText(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Maps exercise synonyms and variations to a standardized English exercise name / canonical pattern.
 */
export function standardizeExerciseName(name: string | undefined | null): string {
  if (!name) return '';

  // First convert translated names (Estonian/Russian) to English if applicable
  const englishName = getEnglishExerciseName(name);
  const norm = normalizeText(englishName);

  // Synonyms & Movement Pattern Canonical Mapping
  if (norm.includes('back squat') || norm.includes('barbell squat') || (norm.includes('squat') && !norm.includes('leg press') && !norm.includes('goblet') && !norm.includes('front'))) {
    return 'barbell back squat';
  }
  if (norm.includes('front squat')) return 'front squat';
  if (norm.includes('goblet squat')) return 'goblet squat';
  
  if (norm.includes('bench press') || norm.includes('flat bench') || norm.includes('barbell bench')) {
    if (norm.includes('dumbbell')) return 'dumbbell bench press';
    if (norm.includes('incline')) return 'incline bench press';
    return 'barbell bench press';
  }
  if (norm.includes('chest press') || norm.includes('machine bench press')) return 'machine chest press';

  if (norm.includes('deadlift') || norm.includes('rdl') || norm.includes('romanian deadlift')) {
    return 'deadlift';
  }

  if (norm.includes('overhead press') || norm.includes('military press') || norm.includes('shoulder press') || norm.includes('ohp')) {
    if (norm.includes('dumbbell')) return 'dumbbell shoulder press';
    return 'overhead press';
  }

  if (norm.includes('lat pulldown') || (norm.includes('pulldown') && !norm.includes('tricep'))) {
    return 'lat pulldown';
  }

  if (norm.includes('cable row') || norm.includes('seated row') || norm.includes('seated cable row')) {
    return 'seated cable row';
  }
  if (norm.includes('bent over row') || norm.includes('barbell row')) return 'barbell bent over row';
  if (norm.includes('dumbbell row')) return 'dumbbell row';

  if (norm.includes('leg press') || norm.includes('45 degree leg press') || norm.includes('incline leg press')) {
    return 'machine leg press';
  }

  if (norm.includes('leg extension') || norm.includes('quad extension')) return 'leg extension';
  if (norm.includes('leg curl') || norm.includes('hamstring curl')) return 'leg curl';

  if (norm.includes('hammer curl') || norm.includes('bicep curl') || norm.includes('biceps curl') || norm.includes('dumbbell curl')) {
    return 'dumbbell bicep curl';
  }

  if (norm.includes('tricep pushdown') || norm.includes('triceps pushdown') || norm.includes('tricep extension')) {
    return 'triceps pushdown';
  }

  if (norm.includes('treadmill') || norm.includes('hike') || norm.includes('treadmill run')) {
    return 'treadmill';
  }

  if (norm.includes('rowing') || norm.includes('rower') || norm.includes('concept2')) {
    return 'concept2 rowing';
  }

  if (norm.includes('assault bike') || norm.includes('air bike')) return 'assault bike';
  if (norm.includes('pull up') || norm.includes('chin up') || norm.includes('pullup') || norm.includes('chinup')) return 'pull up';
  if (norm.includes('push up') || norm.includes('pushup')) return 'push up';
  if (norm.includes('plank')) return 'plank';

  return norm;
}

export interface ExerciseCapabilities {
  canonicalName: string;
  zoneKeywords: string[];
  equipmentKeywords: string[];
  equipmentTypes: EquipmentType[];
}

/**
 * Returns required capabilities and keywords for matching exercises against equipment & zones.
 */
export function getExerciseCapabilities(rawName: string): ExerciseCapabilities {
  const canonical = standardizeExerciseName(rawName);

  if (canonical === 'barbell back squat' || canonical === 'front squat') {
    return {
      canonicalName: canonical,
      zoneKeywords: ['squat', 'rack', 'power rack', 'barbell'],
      equipmentKeywords: ['rack', 'squat', 'power rack', 'barbell'],
      equipmentTypes: [EquipmentType.RACK, EquipmentType.FREE_WEIGHTS]
    };
  }

  if (canonical === 'barbell bench press' || canonical === 'incline bench press') {
    return {
      canonicalName: canonical,
      zoneKeywords: ['bench press', 'bench', 'chest', 'free weights', 'rack'],
      equipmentKeywords: ['bench', 'bench press', 'barbell', 'flat bench'],
      equipmentTypes: [EquipmentType.FREE_WEIGHTS, EquipmentType.RACK]
    };
  }

  if (canonical === 'dumbbell bench press' || canonical === 'dumbbell bicep curl' || canonical === 'dumbbell shoulder press' || canonical === 'dumbbell row') {
    return {
      canonicalName: canonical,
      // Deliberately no bare 'rack' keyword — it also matches squat/power
      // rack zones and machines (a machine literally named "Squat Rack"
      // matches the keyword "rack"), which previously sent dumbbell
      // exercises to the wrong equipment entirely. A "Dumbbell rack" zone
      // still matches fine via the 'dumbbell' keyword alone.
      zoneKeywords: ['dumbbell', 'free weights', 'bench'],
      equipmentKeywords: ['dumbbell', 'bench'],
      equipmentTypes: [EquipmentType.FREE_WEIGHTS]
    };
  }

  if (canonical === 'deadlift') {
    return {
      canonicalName: canonical,
      zoneKeywords: ['platform', 'rack', 'barbell', 'free weights', 'deadlift'],
      equipmentKeywords: ['platform', 'barbell', 'rack', 'deadlift'],
      equipmentTypes: [EquipmentType.FREE_WEIGHTS, EquipmentType.RACK]
    };
  }

  if (canonical === 'overhead press') {
    return {
      canonicalName: canonical,
      zoneKeywords: ['rack', 'barbell', 'free weights', 'overhead', 'shoulder'],
      equipmentKeywords: ['rack', 'barbell', 'overhead'],
      equipmentTypes: [EquipmentType.RACK, EquipmentType.FREE_WEIGHTS]
    };
  }

  if (canonical === 'lat pulldown' || canonical === 'seated cable row' || canonical === 'triceps pushdown') {
    return {
      canonicalName: canonical,
      zoneKeywords: ['cable', 'cross', 'pulldown', 'row', 'lat', 'tross'],
      equipmentKeywords: ['cable', 'pulldown', 'row', 'lat'],
      equipmentTypes: [EquipmentType.MACHINE]
    };
  }

  if (canonical === 'machine leg press') {
    return {
      canonicalName: canonical,
      zoneKeywords: ['leg press', 'leg', 'press'],
      equipmentKeywords: ['leg press', '45 degree', 'press'],
      equipmentTypes: [EquipmentType.MACHINE]
    };
  }

  if (canonical === 'leg extension' || canonical === 'leg curl') {
    return {
      canonicalName: canonical,
      zoneKeywords: ['leg', 'extension', 'curl', 'hamstring', 'quad', 'machine'],
      equipmentKeywords: ['leg extension', 'leg curl', 'hamstring', 'quad'],
      equipmentTypes: [EquipmentType.MACHINE]
    };
  }

  if (canonical === 'treadmill') {
    return {
      canonicalName: canonical,
      zoneKeywords: ['treadmill', 'cardio', 'walk', 'run', 'hike'],
      equipmentKeywords: ['treadmill', 'cardio'],
      equipmentTypes: [EquipmentType.CARDIO]
    };
  }

  if (canonical === 'concept2 rowing') {
    return {
      canonicalName: canonical,
      zoneKeywords: ['rower', 'rowing', 'concept2', 'cardio'],
      equipmentKeywords: ['rower', 'rowing', 'concept2'],
      equipmentTypes: [EquipmentType.CARDIO]
    };
  }

  if (canonical === 'assault bike') {
    return {
      canonicalName: canonical,
      zoneKeywords: ['bike', 'assault', 'air bike', 'cardio'],
      equipmentKeywords: ['bike', 'assault', 'air bike'],
      equipmentTypes: [EquipmentType.CARDIO]
    };
  }

  if (canonical === 'pull up' || canonical === 'push up' || canonical === 'plank') {
    return {
      canonicalName: canonical,
      zoneKeywords: ['turf', 'functional', 'bodyweight', 'rig', 'rack'],
      equipmentKeywords: ['turf', 'rig', 'rack', 'mat'],
      equipmentTypes: [EquipmentType.FUNCTIONAL, EquipmentType.RACK]
    };
  }

  // Fallback capabilities generated from canonical name tokens
  const tokens = canonical.split(' ').filter(t => t.length > 2);
  return {
    canonicalName: canonical,
    zoneKeywords: tokens,
    equipmentKeywords: tokens,
    equipmentTypes: [EquipmentType.MACHINE, EquipmentType.FREE_WEIGHTS, EquipmentType.CARDIO, EquipmentType.RACK, EquipmentType.FUNCTIONAL]
  };
}

export interface ExerciseLocationResult {
  matchedZones: GymZone[];
  matchedMachines: { zone: GymZone; machine: GymMachine }[];
  primaryZone: GymZone | null;
  primaryMachine: GymMachine | null;
  needsManualReview: boolean;
  isMapped: boolean;
}

/**
 * Resolves exercise location(s) within a gym based on exercise name as the primary identifier.
 * Ensures exercises are linked to correct machines and zones, prevents incorrect assignments,
 * maps to all supporting equipment, and flags unmapped exercises for manual review.
 */
export function getExerciseLocations(
  exercise: LibraryExercise | Exercise | { name: string; equipmentRequired?: string; equipmentId?: string; machineId?: string } | null | undefined,
  gym: Gym | undefined | null
): ExerciseLocationResult {
  if (!exercise || !exercise.name || !gym || !gym.zones || gym.zones.length === 0) {
    return {
      matchedZones: [],
      matchedMachines: [],
      primaryZone: null,
      primaryMachine: null,
      needsManualReview: true,
      isMapped: false
    };
  }

  const exName = exercise.name;
  const canonicalName = standardizeExerciseName(exName);
  const caps = getExerciseCapabilities(exName);

  const matchedZonesMap = new Map<string, GymZone>();
  const matchedMachinesList: { zone: GymZone; machine: GymMachine }[] = [];

  // Check each zone and machine in the gym
  gym.zones.forEach(zone => {
    const zNameNorm = normalizeText(zone.name);
    const zDescNorm = normalizeText(zone.description);
    const zTypeNorm = normalizeText(zone.type);
    const zText = `${zNameNorm} ${zDescNorm} ${zTypeNorm}`;

    let zoneMatched = false;

    // Check machines in zone
    if (zone.machines && zone.machines.length > 0) {
      zone.machines.forEach(machine => {
        const mNameNorm = normalizeText(machine.name);
        const mDescNorm = normalizeText(machine.longDescription);
        const mText = `${mNameNorm} ${mDescNorm}`;

        // Match against equipment keywords or canonical name
        const matchByCanonical = mText.includes(canonicalName) || canonicalName.split(' ').every(w => w.length <= 3 || mText.includes(w));
        const matchByKeywords = caps.equipmentKeywords.some(kw => mText.includes(kw));

        if (matchByCanonical || matchByKeywords) {
          zoneMatched = true;
          matchedMachinesList.push({ zone, machine });
        }
      });
    }

    // Match by zone name, type, and capabilities
    const matchZoneByKeywords = caps.zoneKeywords.some(kw => zText.includes(kw));
    const matchZoneByType = caps.equipmentTypes.includes(zone.type);

    if (zoneMatched || (matchZoneByKeywords && matchZoneByType)) {
      matchedZonesMap.set(zone.id, zone);
    }
  });

  // Verify explicit equipmentId / machineId if specified
  if (exercise.equipmentId && exercise.equipmentId !== 'manual') {
    const explicitZone = gym.zones.find(z => z.id === exercise.equipmentId);
    if (explicitZone && !matchedZonesMap.has(explicitZone.id)) {
      // Check if explicitZone actually supports the exercise
      const zText = `${normalizeText(explicitZone.name)} ${normalizeText(explicitZone.description)} ${normalizeText(explicitZone.type)}`;
      if (caps.zoneKeywords.some(kw => zText.includes(kw))) {
        matchedZonesMap.set(explicitZone.id, explicitZone);
      }
    }
  }

  const matchedZones = Array.from(matchedZonesMap.values());

  // Determine primary zone & machine
  let primaryZone: GymZone | null = null;
  let primaryMachine: GymMachine | null = null;

  if (exercise.equipmentId && matchedZonesMap.has(exercise.equipmentId)) {
    primaryZone = matchedZonesMap.get(exercise.equipmentId)!;
  } else if (matchedZones.length > 0) {
    primaryZone = matchedZones[0];
  }

  if (exercise.machineId && matchedMachinesList.some(m => m.machine.id === exercise.machineId)) {
    const found = matchedMachinesList.find(m => m.machine.id === exercise.machineId);
    if (found) primaryMachine = found.machine;
  } else if (primaryZone && primaryZone.machines && primaryZone.machines.length > 0) {
    const foundInZone = matchedMachinesList.find(m => m.zone.id === primaryZone!.id);
    primaryMachine = foundInZone ? foundInZone.machine : primaryZone.machines[0];
  }

  const isMapped = matchedZones.length > 0;
  const needsManualReview = !isMapped;

  return {
    matchedZones,
    matchedMachines: matchedMachinesList,
    primaryZone,
    primaryMachine,
    needsManualReview,
    isMapped
  };
}

/**
 * Checks whether an exercise is available in a given gym zone based on exercise name criteria.
 */
export function isExerciseAvailableInZone(
  exercise: LibraryExercise | Exercise | { name: string; equipmentRequired?: string; equipmentId?: string } | null | undefined,
  zone: GymZone | undefined | null
): boolean {
  if (!exercise || !exercise.name) return false;
  if (!zone) return true;

  // Direct Zone ID match check if explicitly set
  if (exercise.equipmentId && exercise.equipmentId === zone.id) {
    return true;
  }

  const canonical = standardizeExerciseName(exercise.name);
  const caps = getExerciseCapabilities(exercise.name);

  const zNameNorm = normalizeText(zone.name);
  const zDescNorm = normalizeText(zone.description);
  const zTypeNorm = normalizeText(zone.type);
  const machineText = (zone.machines || [])
    .map(m => `${normalizeText(m.name)} ${normalizeText(m.longDescription)}`)
    .join(' ');

  const fullZoneText = `${zNameNorm} ${zDescNorm} ${zTypeNorm} ${machineText}`;

  // 1. Direct machine match in zone
  if (machineText.includes(canonical)) return true;

  // 2. Keyword overlap with exercise capabilities
  const keywordMatch = caps.zoneKeywords.some(kw => fullZoneText.includes(kw));
  const typeMatch = caps.equipmentTypes.includes(zone.type);

  if (keywordMatch && typeMatch) return true;

  // 3. Equipment required matching
  if (exercise.equipmentRequired) {
    const reqNorm = normalizeText(exercise.equipmentRequired);
    if (reqNorm && reqNorm !== 'none' && reqNorm !== 'bodyweight' && fullZoneText.includes(reqNorm)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether an exercise is available on a specific machine.
 */
export function isExerciseAvailableOnMachine(
  exercise: LibraryExercise | Exercise | { name: string } | null | undefined,
  machine: GymMachine | null | undefined
): boolean {
  if (!exercise || !exercise.name || !machine) return false;
  const canonical = standardizeExerciseName(exercise.name);
  const caps = getExerciseCapabilities(exercise.name);
  const mText = `${normalizeText(machine.name)} ${normalizeText(machine.longDescription)}`;

  if (mText.includes(canonical)) return true;
  return caps.equipmentKeywords.some(kw => mText.includes(kw));
}

/**
 * Filter and rank exercises for a search query, muscle filter, category filter, and location/zone.
 * Ensures search results and exercise locations remain synchronized after any changes to equipment/floor plan data.
 */
export function searchAndFilterExercises({
  exercises = [],
  searchQuery = '',
  muscleFilter = 'All',
  categoryFilter = 'All',
  selectedZoneId = 'All',
  gym
}: {
  exercises: { raw: LibraryExercise; translated: LibraryExercise }[];
  searchQuery?: string;
  muscleFilter?: string;
  categoryFilter?: string;
  selectedZoneId?: string;
  gym?: Gym | null;
}) {
  const safeExercises = Array.isArray(exercises) ? exercises : [];
  const query = normalizeText(searchQuery);
  const selectedZone = selectedZoneId !== 'All' && gym?.zones ? gym.zones.find(z => z.id === selectedZoneId) : null;

  // 1. Filter exercises matching zone/location, muscle, category, and search query
  const filtered = safeExercises.filter(({ raw, translated }) => {
    if (!raw || !translated) return false;
    // Check location/zone match strictly
    if (selectedZone) {
      const available = isExerciseAvailableInZone(raw, selectedZone) || isExerciseAvailableInZone(translated, selectedZone);
      if (!available) {
        return false;
      }
    }

    // Check muscle filter
    if (muscleFilter !== 'All') {
      const matchRawMuscle = raw.targetMuscle === muscleFilter || normalizeText(raw.targetMuscle).includes(normalizeText(muscleFilter));
      const matchTransMuscle = translated.targetMuscle === muscleFilter || normalizeText(translated.targetMuscle).includes(normalizeText(muscleFilter));
      if (!matchRawMuscle && !matchTransMuscle) {
        return false;
      }
    }

    // Check category filter
    if (categoryFilter !== 'All') {
      const matchRawCat = raw.category === categoryFilter || normalizeText(raw.category).includes(normalizeText(categoryFilter));
      const matchTransCat = translated.category === categoryFilter || normalizeText(translated.category).includes(normalizeText(categoryFilter));
      if (!matchRawCat && !matchTransCat) {
        return false;
      }
    }

    // Check search query
    if (query) {
      const rawCanonical = standardizeExerciseName(raw.name);
      const transCanonical = standardizeExerciseName(translated.name);

      const exName = `${normalizeText(translated.name)} ${normalizeText(raw.name)} ${rawCanonical} ${transCanonical}`;
      const exMuscle = `${normalizeText(translated.targetMuscle)} ${normalizeText(raw.targetMuscle)}`;
      const exCat = `${normalizeText(translated.category)} ${normalizeText(raw.category)}`;
      const exEquip = `${normalizeText(translated.equipmentRequired)} ${normalizeText(raw.equipmentRequired)}`;

      const matchesName = exName.includes(query);
      const matchesMuscle = exMuscle.includes(query);
      const matchesCat = exCat.includes(query);
      const matchesEquip = exEquip.includes(query);

      if (!matchesName && !matchesMuscle && !matchesCat && !matchesEquip) {
        return false;
      }
    }

    return true;
  });

  // 2. Deduplicate results by exercise ID
  const seenIds = new Set<string>();
  const uniqueFiltered = filtered.filter(({ raw }) => {
    if (seenIds.has(raw.id)) return false;
    seenIds.add(raw.id);
    return true;
  });

  // 3. Rank & Sort results (Most relevant exercise name matches first)
  uniqueFiltered.sort((a, b) => {
    if (!query) {
      return normalizeText(a.translated.name).localeCompare(normalizeText(b.translated.name));
    }

    const aName = normalizeText(a.translated.name);
    const bName = normalizeText(b.translated.name);
    const aCanonical = standardizeExerciseName(a.raw.name);
    const bCanonical = standardizeExerciseName(b.raw.name);

    const aExact = aName === query || aCanonical === query ? 100 : aName.startsWith(query) ? 80 : aName.includes(query) ? 50 : 0;
    const bExact = bName === query || bCanonical === query ? 100 : bName.startsWith(query) ? 80 : bName.includes(query) ? 50 : 0;

    if (aExact !== bExact) return bExact - aExact;

    const aEquip = normalizeText(a.translated.equipmentRequired).includes(query) ? 30 : 0;
    const bEquip = normalizeText(b.translated.equipmentRequired).includes(query) ? 30 : 0;
    if (aEquip !== bEquip) return bEquip - aEquip;

    const aMuscle = normalizeText(a.translated.targetMuscle).includes(query) ? 20 : 0;
    const bMuscle = normalizeText(b.translated.targetMuscle).includes(query) ? 20 : 0;
    if (aMuscle !== bMuscle) return bMuscle - aMuscle;

    return aName.localeCompare(bName);
  });

  return uniqueFiltered;
}
