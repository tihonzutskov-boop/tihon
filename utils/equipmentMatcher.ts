import { EquipmentItem, Gym, GymZone, GymMachine, LibraryExercise, EquipmentType } from '../types';
import { DEFAULT_EQUIPMENT } from '../services/api';

/**
 * Normalizes text for matching and searching.
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
 * Returns all unique equipment IDs present in a gym zone.
 * Considers:
 * 1. zone.equipmentIds explicitly declared
 * 2. zone.machines with equipmentId references
 * 3. Inferred equipment IDs from machine names/icons (e.g. treadmill, dumbbells, bench, etc.)
 */
export function getZoneEquipmentIds(zone: GymZone | null | undefined, allEquipment: EquipmentItem[] = DEFAULT_EQUIPMENT): string[] {
  if (!zone) return [];
  const ids = new Set<string>(zone.equipmentIds || []);

  // Check placed machines
  if (zone.machines && zone.machines.length > 0) {
    zone.machines.forEach(machine => {
      if (machine.equipmentId) {
        ids.add(machine.equipmentId);
      } else {
        // Infer from machine name or icon
        const matched = findMatchingEquipmentItem(machine.name, allEquipment);
        if (matched) ids.add(matched.id);
      }
    });
  }

  // Zone type auto-inferences
  const zoneName = (zone.name || '').toLowerCase();
  if (zone.type === EquipmentType.FUNCTIONAL || zone.type === EquipmentType.STUDIO || zoneName.includes('turf') || zoneName.includes('mat') || zoneName.includes('functional')) {
    ids.add('eq-floor-mat');
  }

  if (zone.type === EquipmentType.CARDIO) {
    if (zoneName.includes('treadmill')) ids.add('eq-treadmill');
    if (zoneName.includes('row')) ids.add('eq-rower');
    if (zoneName.includes('bike')) ids.add('eq-assault-bike');
  }

  if (zone.type === EquipmentType.FREE_WEIGHTS) {
    ids.add('eq-dumbbells');
    if (zoneName.includes('bench') || zone.machines?.some(m => m.name.toLowerCase().includes('bench'))) {
      ids.add('eq-adj-bench');
    }
  }

  if (zone.type === EquipmentType.RACK || zoneName.includes('squat') || zoneName.includes('rack')) {
    ids.add('eq-squat-rack');
    ids.add('eq-barbell-plates');
  }

  return Array.from(ids);
}

/**
 * Fuzzy matches a piece of equipment from a machine name or query.
 */
export function findMatchingEquipmentItem(name: string, allEquipment: EquipmentItem[]): EquipmentItem | undefined {
  if (!name) return undefined;
  const norm = normalizeText(name);

  // Exact ID or Name match
  const exact = allEquipment.find(eq => eq.id === name || normalizeText(eq.name) === norm);
  if (exact) return exact;

  if (norm.includes('treadmill') || norm.includes('run')) return allEquipment.find(e => e.id === 'eq-treadmill');
  if (norm.includes('rower') || norm.includes('rowing') || norm.includes('concept2')) return allEquipment.find(e => e.id === 'eq-rower');
  if (norm.includes('dumbbell') || norm.includes('db')) return allEquipment.find(e => e.id === 'eq-dumbbells');
  if (norm.includes('incline bench') || norm.includes('flat bench') || norm.includes('bench')) return allEquipment.find(e => e.id === 'eq-adj-bench');
  if (norm.includes('squat rack') || norm.includes('power rack') || norm.includes('power cage') || norm.includes('rack')) return allEquipment.find(e => e.id === 'eq-squat-rack');
  if (norm.includes('barbell') || norm.includes('olympic') || norm.includes('bumper') || norm.includes('plates')) return allEquipment.find(e => e.id === 'eq-barbell-plates');
  if (norm.includes('cable') || norm.includes('crossover') || norm.includes('functional trainer')) return allEquipment.find(e => e.id === 'eq-cable-crossover');
  if (norm.includes('pulldown') || norm.includes('lat pull') || norm.includes('seated row')) return allEquipment.find(e => e.id === 'eq-lat-pulldown');
  if (norm.includes('leg press') || norm.includes('45')) return allEquipment.find(e => e.id === 'eq-leg-press');
  if (norm.includes('leg ext') || norm.includes('leg extension') || norm.includes('leg curl')) return allEquipment.find(e => e.id === 'eq-leg-extension');
  if (norm.includes('assault bike') || norm.includes('air bike') || norm.includes('fan bike')) return allEquipment.find(e => e.id === 'eq-assault-bike');
  if (norm.includes('kettlebell') || norm.includes('kb')) return allEquipment.find(e => e.id === 'eq-kettlebells');
  if (norm.includes('plyo') || norm.includes('jump box') || norm.includes('box')) return allEquipment.find(e => e.id === 'eq-plyo-box');
  if (norm.includes('pull-up') || norm.includes('pullup') || norm.includes('chin-up') || norm.includes('rig')) return allEquipment.find(e => e.id === 'eq-pullup-bar');
  if (norm.includes('band') || norm.includes('rope') || norm.includes('battle rope')) return allEquipment.find(e => e.id === 'eq-resistance-bands');
  if (norm.includes('mat') || norm.includes('floor') || norm.includes('turf') || norm.includes('bodyweight')) return allEquipment.find(e => e.id === 'eq-floor-mat');

  // Substring search
  return allEquipment.find(eq => norm.includes(normalizeText(eq.name)) || normalizeText(eq.name).includes(norm));
}

/**
 * Returns required equipment IDs for an exercise, inferring from text if empty.
 */
export function getExerciseRequiredEquipmentIds(exercise: LibraryExercise, allEquipment: EquipmentItem[] = DEFAULT_EQUIPMENT): string[] {
  if (exercise.requiredEquipmentIds && exercise.requiredEquipmentIds.length > 0) {
    return exercise.requiredEquipmentIds;
  }

  const ids = new Set<string>();
  const text = `${exercise.name} ${exercise.equipmentRequired || ''}`.toLowerCase();

  if (text.includes('dumbbell') || text.includes('db ')) ids.add('eq-dumbbells');
  if (text.includes('barbell') || text.includes('deadlift') || text.includes('bench press') || text.includes('squat')) ids.add('eq-barbell-plates');
  // Deliberately no bare 'rack' — plenty of unrelated equipment labels
  // legitimately contain that word too (e.g. "Dumbbell rack"), and a bare
  // match here previously tagged those exercises with a squat rack instead
  // of what they actually need.
  if (text.includes('squat') || text.includes('cage')) ids.add('eq-squat-rack');
  if (text.includes('bench') || text.includes('incline') || text.includes('seated dumbbell') || text.includes('chest press')) ids.add('eq-adj-bench');
  if (text.includes('cable') || text.includes('tricep pushdown') || text.includes('fly')) ids.add('eq-cable-crossover');
  if (text.includes('pulldown') || text.includes('lat pull')) ids.add('eq-lat-pulldown');
  if (text.includes('leg press') || text.includes('45°')) ids.add('eq-leg-press');
  if (text.includes('leg extension') || text.includes('leg curl')) ids.add('eq-leg-extension');
  if (text.includes('treadmill') || text.includes('hike') || text.includes('running')) ids.add('eq-treadmill');
  if (text.includes('rowing') || text.includes('rower') || text.includes('concept2')) ids.add('eq-rower');
  if (text.includes('pull-up') || text.includes('chin-up') || text.includes('pull up')) ids.add('eq-pullup-bar');
  if (text.includes('push-up') || text.includes('push up') || text.includes('plank') || text.includes('crunch') || text.includes('mat')) ids.add('eq-floor-mat');
  if (text.includes('kettlebell') || text.includes('swing')) {
    ids.add('eq-kettlebells');
    ids.add('eq-floor-mat');
  }
  if (text.includes('box jump') || text.includes('plyo')) {
    ids.add('eq-plyo-box');
    ids.add('eq-floor-mat');
  }

  return Array.from(ids);
}

export interface ZoneExerciseMatchResult {
  fullySupported: LibraryExercise[];
  partiallySupported: {
    exercise: LibraryExercise;
    presentEquipment: EquipmentItem[];
    missingEquipment: EquipmentItem[];
  }[];
  unsupportedCount: number;
}

/**
 * Evaluates which exercises from the Exercise Library can be performed in a zone
 * based on the equipment currently placed in that zone.
 */
export function evaluateZoneExercises(
  zoneOrEquipmentIds: GymZone | string[] | null | undefined,
  allExercises: LibraryExercise[] = [],
  allEquipment: EquipmentItem[] = DEFAULT_EQUIPMENT
): ZoneExerciseMatchResult {
  const safeEquipment = Array.isArray(allEquipment) ? allEquipment : DEFAULT_EQUIPMENT;
  const safeExercises = Array.isArray(allExercises) ? allExercises : [];

  let effectiveEquipmentIds: string[] = [];
  if (Array.isArray(zoneOrEquipmentIds)) {
    effectiveEquipmentIds = zoneOrEquipmentIds;
  } else if (zoneOrEquipmentIds && typeof zoneOrEquipmentIds === 'object') {
    effectiveEquipmentIds = getZoneEquipmentIds(zoneOrEquipmentIds, safeEquipment);
  }

  const zoneSet = new Set(effectiveEquipmentIds);
  const equipmentMap = new Map(safeEquipment.map(eq => [eq.id, eq]));

  const fullySupported: LibraryExercise[] = [];
  const partiallySupported: ZoneExerciseMatchResult['partiallySupported'] = [];
  let unsupportedCount = 0;

  for (const ex of safeExercises) {
    if (!ex) continue;
    const requiredIds = getExerciseRequiredEquipmentIds(ex, safeEquipment);

    // If an exercise has zero equipment required, it strictly needs open floor space (eq-floor-mat)
    // as per user requirement: bodyweight movements need "open floor space / mat area" tag on zone!
    const effectiveRequired = requiredIds.length === 0 ? ['eq-floor-mat'] : requiredIds;

    const presentList: EquipmentItem[] = [];
    const missingList: EquipmentItem[] = [];

    effectiveRequired.forEach(reqId => {
      const eqItem = equipmentMap.get(reqId) || {
        id: reqId,
        name: reqId.replace(/^eq-/, '').replace(/-/g, ' ').toUpperCase(),
        category: 'Equipment'
      };

      if (zoneSet.has(reqId)) {
        presentList.push(eqItem);
      } else {
        missingList.push(eqItem);
      }
    });

    if (missingList.length === 0) {
      fullySupported.push(ex);
    } else if (missingList.length === 1 && presentList.length >= 1) {
      partiallySupported.push({
        exercise: ex,
        presentEquipment: presentList,
        missingEquipment: missingList
      });
    } else {
      unsupportedCount++;
    }
  }

  return { fullySupported, partiallySupported, unsupportedCount };
}

/**
 * Returns how many exercises an equipment item unlocks across the library.
 */
export function getEquipmentExerciseCount(
  equipmentId: string,
  allExercises: LibraryExercise[] = [],
  allEquipment: EquipmentItem[] = DEFAULT_EQUIPMENT
): number {
  if (!equipmentId) return 0;
  const safeExercises = Array.isArray(allExercises) ? allExercises : [];
  const safeEquipment = Array.isArray(allEquipment) ? allEquipment : DEFAULT_EQUIPMENT;

  let count = 0;
  for (const ex of safeExercises) {
    if (!ex) continue;
    const requiredIds = getExerciseRequiredEquipmentIds(ex, safeEquipment);
    if (requiredIds.includes(equipmentId)) {
      count++;
    }
  }
  return count;
}

/**
 * Migration helper:
 * Scans all gym zones and machine placements, ensures all placed machines link to Equipment Library items,
 * populates zone.equipmentIds, and returns migrated gyms and updated equipment catalog.
 */
export function migrateGymsAndEquipment(
  gyms: Gym[],
  currentEquipment: EquipmentItem[]
): { gyms: Gym[]; equipment: EquipmentItem[] } {
  const equipmentMap = new Map<string, EquipmentItem>(currentEquipment.map(eq => [eq.id, eq]));
  let hasEquipmentChanges = false;

  const migratedGyms = gyms.map(gym => {
    let gymModified = false;
    const migratedZones = gym.zones.map(zone => {
      let zoneModified = false;
      const zoneEqIds = new Set<string>(zone.equipmentIds || []);

      const migratedMachines = (zone.machines || []).map(machine => {
        let machineEquipId = machine.equipmentId;

        if (!machineEquipId) {
          const match = findMatchingEquipmentItem(machine.name, Array.from(equipmentMap.values()));
          if (match) {
            machineEquipId = match.id;
          } else {
            // Auto-create equipment item for new machine
            const newEqId = `eq-${normalizeText(machine.name).replace(/\s+/g, '-') || Date.now()}`;
            const newEq: EquipmentItem = {
              id: newEqId,
              name: machine.name || 'Gym Equipment',
              category: zone.type === EquipmentType.CARDIO ? 'Cardio' : zone.type === EquipmentType.FREE_WEIGHTS ? 'Free Weights' : 'Machines',
              icon: machine.icon || 'Dumbbell',
              description: machine.longDescription || `Equipment station in ${zone.name}`,
              defaultFootprint: { width: machine.width, height: machine.height }
            };
            equipmentMap.set(newEq.id, newEq);
            machineEquipId = newEq.id;
            hasEquipmentChanges = true;
          }
          zoneModified = true;
          gymModified = true;
        }

        if (machineEquipId) {
          zoneEqIds.add(machineEquipId);
        }

        return {
          ...machine,
          equipmentId: machineEquipId
        };
      });

      // Include floor mat for functional zones
      if (zone.type === EquipmentType.FUNCTIONAL || (zone.name || '').toLowerCase().includes('turf') || (zone.name || '').toLowerCase().includes('mat')) {
        if (!zoneEqIds.has('eq-floor-mat')) {
          zoneEqIds.add('eq-floor-mat');
          zoneModified = true;
        }
      }

      if (zoneModified || (zone.equipmentIds?.length !== zoneEqIds.size)) {
        gymModified = true;
        return {
          ...zone,
          machines: migratedMachines,
          equipmentIds: Array.from(zoneEqIds)
        };
      }

      return zone;
    });

    if (gymModified) {
      return { ...gym, zones: migratedZones };
    }
    return gym;
  });

  return {
    gyms: migratedGyms,
    equipment: Array.from(equipmentMap.values())
  };
}
