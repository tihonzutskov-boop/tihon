import type { MuscleGroup, ExerciseCategory } from '../types';

// The exercise form has long collected a free-text target muscle
// ("Arms/Biceps") and category ("Isolation (Hypertrophy)"). The generation
// tags added later ask for the same facts in structured form, which meant
// typing everything twice. These derive the structured values from what's
// already there, so the admin only supplies what's genuinely new.
//
// Derivation is a starting point, not an override: callers only apply it
// when the structured field is still empty, so a deliberate choice always
// wins.

// Longest phrases first — "Upper Chest" and "Posterior Chain" must be tried
// before the bare "Chest"/"Back" they contain, or they'd match the wrong
// group. Terms deliberately absent: "Arms", "Legs", "Full Body", "Cardio",
// "Explosive Power" — each is either ambiguous or not a muscle group, and a
// wrong guess is worse than leaving it for the admin.
const MUSCLE_TERMS: [string, MuscleGroup][] = [
  ['posterior chain', 'Hamstrings'],
  ['anterior deltoid', 'Shoulders'],
  ['upper chest', 'Chest'],
  ['hamstring', 'Hamstrings'],
  ['pectoral', 'Chest'],
  ['shoulder', 'Shoulders'],
  ['tricep', 'Triceps'],
  ['bicep', 'Biceps'],
  ['glute', 'Glutes'],
  ['calve', 'Calves'],
  ['calf', 'Calves'],
  ['quad', 'Quads'],
  ['delt', 'Shoulders'],
  ['chest', 'Chest'],
  ['core', 'Core'],
  ['lat', 'Back'],
  ['back', 'Back'],
];

export const deriveMuscleGroups = (targetMuscle: string | undefined): MuscleGroup[] => {
  const text = (targetMuscle || '').toLowerCase();
  if (!text.trim()) return [];

  const found: MuscleGroup[] = [];
  let remaining = text;
  for (const [term, group] of MUSCLE_TERMS) {
    if (remaining.includes(term)) {
      if (!found.includes(group)) found.push(group);
      // Consume the match so a longer phrase already handled ("upper chest")
      // isn't matched again by the shorter term inside it.
      remaining = remaining.split(term).join(' ');
    }
  }
  return found;
};

// Ordered so the more specific reading wins: "Cardio / Aerobic" is cardio,
// and "Core / Stability" is isolation work rather than anything else.
const CATEGORY_TERMS: [string, ExerciseCategory][] = [
  ['warm', 'warmup'],
  ['cool', 'cooldown'],
  ['mobility', 'mobility'],
  ['stretch', 'mobility'],
  ['cardio', 'cardio'],
  ['aerobic', 'cardio'],
  ['compound', 'compound'],
  ['isolation', 'isolation'],
  ['core', 'isolation'],
  ['stability', 'isolation'],
];

export const deriveExerciseCategory = (category: string | undefined): ExerciseCategory | '' => {
  const text = (category || '').toLowerCase();
  if (!text.trim()) return '';
  for (const [term, mapped] of CATEGORY_TERMS) {
    if (text.includes(term)) return mapped;
  }
  // Equipment-shaped categories ("Free Weights", "Machines") say nothing
  // about how an exercise trains, so there's nothing honest to infer.
  return '';
};

// Suggests equipment by matching the exercise's own text against the names
// in the gym's actual Equipment Library, rather than the hardcoded built-in
// ids used by getExerciseRequiredEquipmentIds — an admin's library may use
// custom items ("Dumbbell rack") whose ids never match the defaults, and
// suggesting equipment they don't own is worse than suggesting nothing.
//
// Unlike muscles and type, this is only ever offered as a suggestion the
// admin confirms: equipment decides both whether an exercise is eligible at
// a gym and where it sits on the map, so a silent wrong guess is costly.

// Words too generic to identify equipment on their own — "Bench Press"
// should not match an item merely because both contain "press".
const EQUIPMENT_STOPWORDS = new Set([
  'the', 'and', 'or', 'a', 'an', 'of', 'with', 'full', 'set', 'area', 'station',
  'machine', 'press', 'rack', 'bar', 'weights', 'weight', 'floor', 'open', 'dual',
  'adjustable', 'commercial', 'standard', 'olympic', 'plate', 'plates', 'loaded',
  // Body position, not equipment: "Seated Dumbbell Curl" should not match
  // "…Seated Cable Row" on the word they happen to share.
  'seated', 'standing', 'lying', 'flat',
]);

// Crude singular/stem form so "Dumbbells (Full Rack)" matches an exercise
// named "…Dumbbell…". Without this the correct suggestion was missed while
// weaker ones still matched.
const stem = (w: string): string => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);

const equipmentKeywords = (equipmentName: string): string[] => {
  const words = equipmentName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(w => w.length > 2 && !EQUIPMENT_STOPWORDS.has(w))
    .map(stem);
  // Deduped so a name repeating a word ("Leg Extension & Leg Curl") isn't
  // scored as if it had more distinct terms than it does.
  return Array.from(new Set(words));
};

// How much of an equipment name the exercise must account for before it's
// worth suggesting. One word out of four ("curl" in "Leg Extension & Leg
// Curl Machine") is coincidence; a clean full-name hit is not.
const MIN_COVERAGE = 0.35;

export const suggestEquipmentIds = (
  exerciseName: string,
  equipmentRequiredText: string | undefined,
  equipment: { id: string; name: string }[],
): string[] => {
  const text = `${exerciseName || ''} ${equipmentRequiredText || ''}`.toLowerCase();
  if (!text.trim()) return [];

  // Ranked by how much of the equipment's name the exercise actually
  // accounts for. "Dumbbell Row" matches "Dumbbell rack" completely but
  // "Lat Pulldown & Seated Cable Row" only via one word of five — both are
  // offered, strongest first, because name matching can't fully resolve
  // that ambiguity. The UI adds each suggestion individually rather than
  // applying them as a set: required equipment is AND-ed, so an extra item
  // accepted by mistake would make the exercise ineligible at gyms that can
  // genuinely do it.
  // Whole words only. Substring matching let "pull" (from "Pull-Up Bar")
  // match inside "pulldown", suggesting a pull-up bar for a lat pulldown.
  const textWords = new Set(text.split(/[^a-z0-9]+/).filter(Boolean).map(stem));

  const scored = equipment
    .map(eq => {
      const words = equipmentKeywords(eq.name);
      if (words.length === 0) return null;
      const hits = words.filter(w => textWords.has(w)).length;
      const coverage = hits / words.length;
      return coverage >= MIN_COVERAGE ? { id: eq.id, coverage } : null;
    })
    .filter((x): x is { id: string; coverage: number } => x !== null);

  return scored
    .sort((a, b) => b.coverage - a.coverage)
    .map(x => x.id);
};

// Suggests a movement pattern from the exercise name. Deliberately silent
// where the name doesn't settle it — guessing would quietly misprogram
// plans. Isolation work now has patterns of its own, so a curl or pushdown
// resolves honestly instead of being forced into a pressing slot.
// Order matters: "Bulgarian Split Squat" is a lunge, so lunge is tested
// before the bare "squat" it also contains.
const PATTERN_RULES: [RegExp, MovementPatternName][] = [
  // Plurals and spaced spellings are matched explicitly: real libraries hold
  // "Goblet Squats", "Pull Up" and "Dumbbell Rows", none of which match a
  // bare \bsquat\b / pull-?up / \brow\b.
  [/\b(bulgarian|split squats?|lunges?|step[- ]?ups?)\b/, 'lunge'],
  [/\b(deadlifts?|rdls?|hip thrusts?|good mornings?|swings?)\b/, 'hinge'],
  [/\b(squats?|leg press(es)?)\b/, 'squat'],
  [/\b(pulldowns?|pull[- ]?ups?|chin[- ]?ups?)\b/, 'vertical_pull'],
  [/\brows?\b/, 'horizontal_pull'],
  [/\b(lateral raises?|front raises?|rear delt|delt flye?s?|deltoid flye?s?)\b/, 'shoulder_abduction'],
  [/\b(overhead press(es)?|shoulder press(es)?|military press(es)?)\b/, 'vertical_push'],
  [/\b(bench press(es)?|push[- ]?ups?|chest press(es)?|dips?)\b/, 'horizontal_push'],
  // Single-joint work, tested after the compounds so a press or row always
  // wins. Knee flexion precedes elbow flexion because a "leg curl" is a
  // curl by name but a hamstring movement in fact.
  [/\b(leg curls?|hamstring curls?|lying leg curls?)\b/, 'knee_flexion'],
  [/\b(leg extensions?|knee extensions?|quad extensions?)\b/, 'knee_extension'],
  [/\b(calf raises?|calf press(es)?|calve raises?)\b/, 'calf_raise'],
  [/\b(triceps?|push[- ]?downs?|skull ?crushers?|kickbacks?)\b/, 'elbow_extension'],
  [/\b(biceps?|curls?)\b/, 'elbow_flexion'],
  [/\b(chest flye?s?|pec decks?|cable flye?s?|dumbbell flye?s?|flye?s?)\b/, 'horizontal_adduction'],
  [/\b(planks?|crunch(es)?|sit[- ]?ups?|dead bugs?|hollow)\b/, 'core'],
  [/\b(treadmills?|rowing|ergs?|bikes?|runs?|conditioning|sprints?)\b/, 'conditioning'],
  [/\b(box jumps?|plyo)\b/, 'squat'],
  [/\b(stretch(es)?|mobility|foam roll(ing)?)\b/, 'mobility'],
];

type MovementPatternName =
  | 'horizontal_push' | 'horizontal_pull' | 'vertical_push' | 'vertical_pull'
  | 'squat' | 'hinge' | 'lunge' | 'carry'
  | 'shoulder_abduction' | 'horizontal_adduction'
  | 'elbow_flexion' | 'elbow_extension'
  | 'knee_extension' | 'knee_flexion' | 'calf_raise'
  | 'core' | 'conditioning' | 'mobility';

export const suggestMovementPattern = (exerciseName: string): MovementPatternName | '' => {
  const name = (exerciseName || '').toLowerCase();
  if (!name.trim()) return '';
  for (const [re, pattern] of PATTERN_RULES) {
    if (re.test(name)) return pattern;
  }
  return '';
};
