import { describe, it, expect } from 'vitest';
import { deriveMuscleGroups, deriveExerciseCategory, suggestEquipmentIds, suggestMovementPattern } from './exerciseTagDerivation';

describe('deriveMuscleGroups', () => {
  it('reads every muscle in a slash-separated value', () => {
    expect(deriveMuscleGroups('Arms/Biceps')).toEqual(['Biceps']);
    expect(deriveMuscleGroups('Chest/Triceps').sort()).toEqual(['Chest', 'Triceps']);
    expect(deriveMuscleGroups('Glutes/Hamstrings/Abs').sort()).toEqual(['Abs', 'Glutes', 'Hamstrings']);
  });

  it('prefers the longer phrase over the word inside it', () => {
    // "Upper Chest" must resolve to its own head, not the bare "Chest" it
    // contains, and "Posterior Chain" must not be read as a back muscle.
    expect(deriveMuscleGroups('Upper Chest/Anterior Deltoids').sort())
      .toEqual(['Front delts', 'Upper chest']);
    expect(deriveMuscleGroups('Back/Posterior Chain').sort())
      .toEqual(['Hamstrings', 'Upper back']);
  });

  it('resolves specific heads rather than a whole region', () => {
    expect(deriveMuscleGroups('Lats')).toEqual(['Lats']);
    expect(deriveMuscleGroups('Lower Back')).toEqual(['Lower back']);
    expect(deriveMuscleGroups('Rear Delts')).toEqual(['Rear delts']);
    expect(deriveMuscleGroups('Chest/Pectorals')).toEqual(['Chest']);
  });

  it('stays silent when the text names a region but not which head', () => {
    // "Shoulders" could be front, side or rear delts. Picking one would be a
    // guess, and a wrong muscle tag skews the variety scoring.
    expect(deriveMuscleGroups('Shoulders/Delts')).toEqual([]);
  });

  it('returns nothing for values that name no specific muscle', () => {
    // Guessing here would be worse than leaving it to the admin.
    expect(deriveMuscleGroups('Cardio')).toEqual([]);
    expect(deriveMuscleGroups('Legs/Explosive Power')).toEqual([]);
    expect(deriveMuscleGroups('')).toEqual([]);
    expect(deriveMuscleGroups(undefined)).toEqual([]);
  });

  it('never returns duplicates', () => {
    expect(deriveMuscleGroups('Chest/Pectorals/Chest')).toEqual(['Chest']);
  });

  it('handles every real library value without crashing', () => {
    const real = [
      'Arms/Biceps', 'Arms/Triceps', 'Back/Full Body', 'Back/Lats', 'Back/Posterior Chain',
      'Cardio', 'Chest/Core', 'Chest/Pectorals', 'Chest/Triceps', 'Core',
      'Glutes/Hamstrings/Core', 'Glutes/Quads', 'Legs/Explosive Power', 'Legs/Quads',
      'Shoulders/Delts', 'Upper Chest/Anterior Deltoids',
    ];
    real.forEach(v => expect(Array.isArray(deriveMuscleGroups(v))).toBe(true));
    expect(deriveMuscleGroups('Legs/Quads')).toEqual(['Quads']);
    expect(deriveMuscleGroups('Back/Full Body')).toEqual(['Upper back']);
  });
});

describe('deriveExerciseCategory', () => {
  it('maps the strength categories', () => {
    expect(deriveExerciseCategory('Compound (Strength)')).toBe('compound');
    expect(deriveExerciseCategory('Isolation (Hypertrophy)')).toBe('isolation');
    expect(deriveExerciseCategory('Bodyweight (Strength)')).toBe('');
  });

  it('maps cardio and core variants', () => {
    expect(deriveExerciseCategory('Cardio / Aerobic')).toBe('cardio');
    expect(deriveExerciseCategory('Cardio')).toBe('cardio');
    expect(deriveExerciseCategory('Core / Stability')).toBe('isolation');
  });

  it('infers nothing from equipment-shaped categories', () => {
    // These describe what you hold, not how the exercise trains.
    ['Free Weights', 'Machines', 'Cables', 'Accessories', 'Benches & Racks', 'Functional & Floor']
      .forEach(c => expect(deriveExerciseCategory(c)).toBe(''));
  });

  it('handles empty input', () => {
    expect(deriveExerciseCategory('')).toBe('');
    expect(deriveExerciseCategory(undefined)).toBe('');
  });
});

describe('suggestEquipmentIds', () => {
  // Mirrors a real admin library: a mix of built-in and custom names.
  const equipment = [
    { id: 'eq-dumbbells', name: 'Dumbbell rack' },
    { id: 'eq-barbell', name: 'Olympic Barbell & Bumper Plates' },
    { id: 'eq-bench', name: 'Adjustable Incline/Flat Bench' },
    { id: 'eq-cable', name: 'Dual Cable Cross / Functional Trainer' },
    { id: 'eq-latpull', name: 'Lat Pulldown & Seated Cable Row' },
    { id: 'eq-treadmill', name: 'Commercial Running Treadmill' },
    { id: 'eq-bike', name: 'Bike' },
    { id: 'eq-mat', name: 'Open Floor / Mat Area' },
  ];

  it('matches equipment named in the exercise', () => {
    expect(suggestEquipmentIds('Seated Dumbbell Hammer Curl', '', equipment)).toContain('eq-dumbbells');
    expect(suggestEquipmentIds('Treadmill Run', '', equipment)).toContain('eq-treadmill');
    expect(suggestEquipmentIds('Wide-Grip Lat Pulldown', '', equipment)).toContain('eq-latpull');
  });

  it('works against custom names the built-in inference does not know', () => {
    // 'Dumbbell rack' is the admin's own wording, not a built-in id.
    expect(suggestEquipmentIds('Dumbbell Row', '', equipment)[0]).toBe('eq-dumbbells');
    expect(suggestEquipmentIds('Assault Bike Intervals', '', equipment)).toEqual(['eq-bike']);
  });

  it('drops a match that only brushes one word of a long name', () => {
    // "Dumbbell Row" shares just "row" with "Lat Pulldown & Seated Cable
    // Row" — coincidence, not a requirement. Suggesting it would be worse
    // than silence: accepting it makes the exercise ineligible anywhere
    // without that machine.
    const result = suggestEquipmentIds('Dumbbell Row', '', equipment);
    expect(result[0]).toBe('eq-dumbbells');
    expect(result).not.toContain('eq-latpull');
  });

  it('matches singular exercise wording against plural equipment names', () => {
    // "…Dumbbell…" vs "Dumbbell rack" — this correct match was previously
    // missed entirely while weaker ones still surfaced.
    expect(suggestEquipmentIds('Seated Dumbbell Hammer Curl', '', equipment)).toEqual(['eq-dumbbells']);
  });

  it('ignores body-position words shared by chance', () => {
    // "Seated" appears in both the exercise and "…Seated Cable Row".
    expect(suggestEquipmentIds('Seated Dumbbell Hammer Curl', '', equipment)).not.toContain('eq-latpull');
  });

  it('still matches when enough of the equipment name is present', () => {
    expect(suggestEquipmentIds('Wide-Grip Lat Pulldown', '', equipment)).toContain('eq-latpull');
  });

  it('reads the free-text equipment field as well as the name', () => {
    expect(suggestEquipmentIds('Row', 'Dumbbell', equipment)).toContain('eq-dumbbells');
  });

  it('stays silent rather than guessing on a weak partial match', () => {
    // "Cable machine" overlaps "Dual Cable Cross / Functional Trainer" by a
    // single word out of four. Precision is favoured over recall here: a
    // missed suggestion costs one click in the picker below, a wrong one
    // accepted silently restricts where the exercise can be used.
    expect(suggestEquipmentIds('Chest Fly', 'Cable machine', equipment)).not.toContain('eq-cable');
  });

  it('does not match on generic words alone', () => {
    // "Bench Press" must not pull in every item containing "press"/"rack",
    // and must not match the barbell item merely via "plates"/"olympic".
    const result = suggestEquipmentIds('Leg Press', '', equipment);
    expect(result).not.toContain('eq-barbell');
    expect(result).not.toContain('eq-dumbbells');
  });

  it('returns nothing when the name identifies no equipment', () => {
    expect(suggestEquipmentIds('Plank', '', equipment)).toEqual([]);
    expect(suggestEquipmentIds('', '', equipment)).toEqual([]);
  });

  it('returns nothing when the library is empty', () => {
    expect(suggestEquipmentIds('Dumbbell Row', '', [])).toEqual([]);
  });
});

describe('suggestEquipmentIds — whole-word matching', () => {
  const equipment = [
    { id: 'eq-pullup', name: 'Pull-Up Bar / Rig Station' },
    { id: 'eq-latpull', name: 'Lat Pulldown & Seated Cable Row' },
    { id: 'eq-dumbbells', name: 'Dumbbell rack' },
  ];

  it('does not match a word buried inside a longer one', () => {
    // "pull" (from Pull-Up Bar) sits inside "pulldown" — a lat pulldown
    // does not need a pull-up bar.
    const result = suggestEquipmentIds('Wide-Grip Lat Pulldown', '', equipment);
    expect(result).not.toContain('eq-pullup');
    expect(result).toContain('eq-latpull');
  });

  it('still matches the pull-up bar for an actual pull-up', () => {
    expect(suggestEquipmentIds('Pull-up', '', equipment)).toContain('eq-pullup');
  });
});

describe('suggestMovementPattern', () => {
  it('reads the common compound movements from the name', () => {
    expect(suggestMovementPattern('Bench Press')).toBe('horizontal_push');
    expect(suggestMovementPattern('Overhead Press')).toBe('vertical_push');
    expect(suggestMovementPattern('Wide-Grip Lat Pulldown')).toBe('vertical_pull');
    expect(suggestMovementPattern('Dumbbell Row')).toBe('horizontal_pull');
    expect(suggestMovementPattern('Barbell Squat')).toBe('squat');
    expect(suggestMovementPattern('Conventional Barbell Deadlift')).toBe('hinge');
    expect(suggestMovementPattern('Plank')).toBe('core');
    expect(suggestMovementPattern('Treadmill Run')).toBe('conditioning');
  });

  it('prefers the more specific rule when a name matches two', () => {
    // Contains "squat" but is a lunge pattern.
    expect(suggestMovementPattern('Bulgarian Split Squat')).toBe('lunge');
    // Contains "row" but is conditioning, not a horizontal pull.
    expect(suggestMovementPattern('Concept2 Rowing Conditioning')).toBe('conditioning');
  });

  it('stays silent when the name does not settle the pattern', () => {
    // Isolation work — guessing here would quietly misprogram plans.
    // Farmer's walk used to land here; it now resolves to carry, which is
    // covered by its own test above.
    expect(suggestMovementPattern('Turkish Get-Up')).toBe('');
    expect(suggestMovementPattern('Sled Drag')).toBe('');
    expect(suggestMovementPattern('')).toBe('');
  });

  it('reads shoulder raises and delt flyes as shoulder_abduction', () => {
    // Previously silent (no pattern fit push/pull), so exercises like this
    // could never be selected by the generator at all.
    expect(suggestMovementPattern('Lateral Raises')).toBe('shoulder_abduction');
    expect(suggestMovementPattern('Dumbbell Lateral Raise')).toBe('shoulder_abduction');
    expect(suggestMovementPattern('Front Raise')).toBe('shoulder_abduction');
    expect(suggestMovementPattern('Rear Delt Fly')).toBe('shoulder_abduction');
    expect(suggestMovementPattern('Cable Deltoid Fly')).toBe('shoulder_abduction');
  });

  it('does not confuse a shoulder press with a shoulder raise', () => {
    expect(suggestMovementPattern('Seated Dumbbell Shoulder Press')).toBe('vertical_push');
  });

  it('gives single-joint work its own pattern instead of a pressing slot', () => {
    // These were the exercises with no truthful option, so they got tagged
    // vertical_push and ended up selected as if they were overhead presses.
    expect(suggestMovementPattern('Seated Dumbbell Curl')).toBe('elbow_flexion');
    expect(suggestMovementPattern('Tricep Pushdown')).toBe('elbow_extension');
    expect(suggestMovementPattern('Dumbbell Tricep Extensions (Overhead)')).toBe('elbow_extension');
    expect(suggestMovementPattern('Standing Cable Chest Fly')).toBe('horizontal_adduction');
    expect(suggestMovementPattern('Seated Quadriceps Leg Extension')).toBe('knee_extension');
    expect(suggestMovementPattern('Standing Calf Raise')).toBe('calf_raise');
  });

  it('separates a glute kickback from a triceps kickback', () => {
    // Bare "kickback" matched the triceps rule, so glute work was being
    // classified as elbow extension and programmed into arm slots.
    expect(suggestMovementPattern('Glute Kickback')).toBe('hip_extension');
    expect(suggestMovementPattern('Triceps Kickback')).toBe('elbow_extension');
  });

  it('reads single-joint glute work as hip extension', () => {
    expect(suggestMovementPattern('Donkey Kick')).toBe('hip_extension');
    expect(suggestMovementPattern('Glute Bridge')).toBe('hip_extension');
    expect(suggestMovementPattern('Cable Pull-Through')).toBe('hip_extension');
  });

  it('keeps loaded hip hinges as hinge, not hip extension', () => {
    // A hip thrust and an RDL are compound hinges; the split is single-joint
    // glute work versus a loaded hinge, not "does the hip extend".
    expect(suggestMovementPattern('Hip Thrust')).toBe('hinge');
    expect(suggestMovementPattern('Romanian Deadlift')).toBe('hinge');
  });

  it('reads a hanging leg raise as core, not hip flexion', () => {
    // Programmed as core work, and the core slot is where it belongs.
    expect(suggestMovementPattern('Hanging Leg Raise')).toBe('core');
    expect(suggestMovementPattern('Hanging Knee Raise')).toBe('core');
  });

  it('gives hip adduction and abduction their own patterns', () => {
    // The adductor and abductor machines had no honest option before.
    expect(suggestMovementPattern('Hip Adduction Machine')).toBe('hip_adduction');
    expect(suggestMovementPattern('Seated Adductor')).toBe('hip_adduction');
    expect(suggestMovementPattern('Hip Abduction Machine')).toBe('hip_abduction');
    expect(suggestMovementPattern('Cable Abductor')).toBe('hip_abduction');
    expect(suggestMovementPattern('Banded Lateral Walk')).toBe('hip_abduction');
    expect(suggestMovementPattern('Clamshell')).toBe('hip_abduction');
    expect(suggestMovementPattern('Fire Hydrant')).toBe('hip_abduction');
  });

  it('reads a loaded carry as carry, not a banded walk', () => {
    // "Walk" alone must not mean hip abduction — the qualifier is what
    // distinguishes a banded lateral walk from a farmer's walk.
    expect(suggestMovementPattern('Farmers Walk')).toBe('carry');
    expect(suggestMovementPattern("Farmer's Carry")).toBe('carry');
    expect(suggestMovementPattern('Suitcase Carry')).toBe('carry');
    expect(suggestMovementPattern('Walking Lunge')).toBe('lunge');
  });

  it('does not confuse hip adduction with a chest fly', () => {
    // horizontal_adduction is the chest movement; the hip has its own.
    expect(suggestMovementPattern('Cable Chest Fly')).toBe('horizontal_adduction');
    expect(suggestMovementPattern('Hip Adduction')).toBe('hip_adduction');
  });

  it('reads a leg curl as a hamstring movement, not a biceps curl', () => {
    expect(suggestMovementPattern('Lying Leg Curl')).toBe('knee_flexion');
    expect(suggestMovementPattern('Seated Dumbbell Hammer Curl')).toBe('elbow_flexion');
  });

  it('still lets compound lifts win over the isolation rules', () => {
    expect(suggestMovementPattern('Goblet Squat')).toBe('squat');
    expect(suggestMovementPattern('Barbell Bench Press')).toBe('horizontal_push');
    expect(suggestMovementPattern('Dumbbell Row')).toBe('horizontal_pull');
  });

  it('covers most of the real library without guessing on the rest', () => {
    const library = [
      'Barbell Squat','Bench Press','Dumbbell Row','Overhead Press','Incline Dumbbell Bench Press',
      'Seated Dumbbell Hammer Curl','Conventional Barbell Deadlift','Wide-Grip Lat Pulldown',
      'Standing Cable Chest Fly','Cable Triceps Rope Pushdown','Machine Leg Press 45°',
      'Seated Quadriceps Leg Extension','Concept2 Rowing Conditioning','Treadmill Run','Pull-up',
      'Push-up','Plank','Kettlebell Russian Swing','Plyometric Box Jump',
    ];
    // Every one of these now resolves — isolation work included.
    const unresolved = library.filter(n => suggestMovementPattern(n) === '');
    expect(unresolved).toEqual([]);
  });
});
