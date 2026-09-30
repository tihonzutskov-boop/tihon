// Checks for what clients send to the server.
//
// The interface never produces most of the bad values these guard against, so
// it is easy to assume nothing will. But the API is open to anyone with a
// Google account, and the values are not harmless: `daysPerWeek` alone drives
// how many days the plan generator builds, and a value of 60000 makes a
// 185 MB plan that the server then tries to hold in memory and write to a
// database that has already run out of disk once. Every function here returns
// either a cleaned copy to store or an error to send back — never the input
// itself, so a field nobody asked for cannot ride along.

const ok = (value) => ({ ok: true, value });
const fail = (error) => ({ ok: false, error });

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isString = (v) => typeof v === 'string';

const inRange = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const isInt = (v, min, max) => inRange(v, min, max) && Number.isInteger(v);

// The engine's aims. A goal outside this list would silently fall back to the
// default aim, which looks like it worked and quietly builds the wrong plan.
export const AIMS = ['Muscle gain', 'Weight loss', 'General fitness', 'Endurance', 'Mobility'];
const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const SEXES = ['Male', 'Female', 'Prefer not to say'];

const optionalString = (raw, field, max) => {
  if (raw === undefined || raw === null || raw === '') return ok(undefined);
  if (!isString(raw)) return fail(`${field} must be text`);
  if (raw.length > max) return fail(`${field} is too long (at most ${max} characters)`);
  return ok(raw);
};

// --- questionnaire ----------------------------------------------------------

export const validateQuestionnaire = (raw) => {
  if (!isObject(raw)) return fail('The questionnaire answers are missing.');
  const a = raw;

  if (!isInt(a.age, 10, 100)) return fail('Age must be a whole number between 10 and 100.');
  if (!inRange(a.heightCm, 100, 250)) return fail('Height must be between 100 and 250 cm.');
  if (!inRange(a.weightKg, 25, 400)) return fail('Weight must be between 25 and 400 kg.');
  if (!SEXES.includes(a.sex)) return fail('Please choose one of the options for sex.');
  if (!LEVELS.includes(a.level)) return fail('Please choose your training experience.');

  if (!Array.isArray(a.goals) || a.goals.length < 1 || a.goals.length > AIMS.length) {
    return fail('Please choose between one and five goals.');
  }
  if (!a.goals.every(g => AIMS.includes(g))) return fail('One of the goals is not recognised.');
  const goals = [...new Set(a.goals)];

  let secondaryGoals;
  if (a.secondaryGoals !== undefined && a.secondaryGoals !== null) {
    if (!Array.isArray(a.secondaryGoals) || a.secondaryGoals.length > AIMS.length) {
      return fail('The secondary goals are not valid.');
    }
    if (!a.secondaryGoals.every(g => AIMS.includes(g))) return fail('One of the secondary goals is not recognised.');
    // An aim that is already a main goal is not supporting anything.
    const extras = [...new Set(a.secondaryGoals)].filter(g => !goals.includes(g));
    if (extras.length > 0) secondaryGoals = extras;
  }

  // Days per week is a string in the answers ('3'), and it is what sizes the
  // plan, so it is the value that matters most to bound.
  if (!isString(a.daysPerWeek) || !/^[1-7]$/.test(a.daysPerWeek)) {
    return fail('Days per week must be between 1 and 7.');
  }
  const minutes = isString(a.minutesPerSession) ? a.minutesPerSession.match(/^(\d{2,3}) min$/) : null;
  if (!minutes || Number(minutes[1]) < 10 || Number(minutes[1]) > 180) {
    return fail('Minutes per session must be between 10 and 180.');
  }

  const equipment = optionalString(a.equipment, 'Equipment comfort', 100);
  if (!equipment.ok) return equipment;
  if (!equipment.value) return fail('Please say how comfortable you are with equipment.');
  const gymId = optionalString(a.gymId, 'Gym', 100);
  if (!gymId.ok) return gymId;
  const avoid = optionalString(a.avoidExercises, 'Exercises to avoid', 500);
  if (!avoid.ok) return avoid;
  const injuryNotes = optionalString(a.injuryNotes, 'Injury notes', 1000);
  if (!injuryNotes.ok) return injuryNotes;
  const clearance = optionalString(a.medicalClearance, 'Medical clearance', 100);
  if (!clearance.ok) return clearance;

  const injuryAreas = a.injuryAreas ?? [];
  if (!Array.isArray(injuryAreas) || injuryAreas.length > 12
      || !injuryAreas.every(x => isString(x) && x.length > 0 && x.length <= 40)) {
    return fail('The injury areas are not valid.');
  }
  if (a.consent !== undefined && a.consent !== null && typeof a.consent !== 'boolean') {
    return fail('Consent must be yes or no.');
  }

  const value = {
    age: a.age, heightCm: a.heightCm, weightKg: a.weightKg, sex: a.sex,
    goals, level: a.level,
    daysPerWeek: a.daysPerWeek, minutesPerSession: a.minutesPerSession,
    equipment: equipment.value,
    injuryAreas: [...new Set(injuryAreas)],
  };
  if (secondaryGoals) value.secondaryGoals = secondaryGoals;
  if (gymId.value) value.gymId = gymId.value;
  if (avoid.value) value.avoidExercises = avoid.value;
  if (injuryNotes.value) value.injuryNotes = injuryNotes.value;
  if (clearance.value) value.medicalClearance = clearance.value;
  if (typeof a.consent === 'boolean') value.consent = a.consent;
  return ok(value);
};

// --- plans ------------------------------------------------------------------

export const PLAN_MAX_DAYS = 14;
export const PLAN_MAX_EXERCISES_PER_DAY = 80;
export const PLAN_MAX_BYTES = 768 * 1024;

// A client may edit its own plan (add or remove an exercise), so the shape is
// checked and the size bounded rather than the content second-guessed. Fields
// the app and the engine own are left exactly as sent.
export const validatePlanPayload = (raw) => {
  if (!isObject(raw)) return fail('The plan is missing.');
  const name = optionalString(raw.name, 'Plan name', 255);
  if (!name.ok) return name;

  if (!Array.isArray(raw.days) || raw.days.length > PLAN_MAX_DAYS) {
    return fail(`A plan has at most ${PLAN_MAX_DAYS} days.`);
  }
  for (const day of raw.days) {
    if (!isObject(day)) return fail('Each day of the plan must be an object.');
    if (!isString(day.id) || day.id.length < 1 || day.id.length > 100) return fail('Each day needs an id.');
    if (day.name !== undefined && (!isString(day.name) || day.name.length > 255)) return fail('A day name is not valid.');
    if (!Array.isArray(day.exercises) || day.exercises.length > PLAN_MAX_EXERCISES_PER_DAY) {
      return fail(`A day has at most ${PLAN_MAX_EXERCISES_PER_DAY} exercises.`);
    }
    for (const ex of day.exercises) {
      if (!isObject(ex)) return fail('Each exercise must be an object.');
      if (!isString(ex.id) || ex.id.length < 1 || ex.id.length > 100) return fail('Each exercise needs an id.');
      if (!isString(ex.name) || ex.name.length > 300) return fail('Each exercise needs a name.');
      if (ex.sets !== undefined && !isInt(ex.sets, 0, 30)) return fail('Sets must be between 0 and 30.');
      if (ex.libraryExerciseId !== undefined && (!isString(ex.libraryExerciseId) || ex.libraryExerciseId.length > 100)) {
        return fail('An exercise link is not valid.');
      }
    }
  }
  if (JSON.stringify(raw.days).length > PLAN_MAX_BYTES) return fail('The plan is too large to save.');
  return ok({ name: name.value || 'My Training Plan', days: raw.days });
};

// --- training logs ----------------------------------------------------------

export const LOG_MAX_ENTRIES = 60;
export const LOG_MAX_SETS = 20;

export const validateExerciseLogs = (raw) => {
  const entries = Array.isArray(raw) ? raw : [raw];
  if (entries.length === 0) return fail('Nothing to log');
  if (entries.length > LOG_MAX_ENTRIES) return fail(`A session logs at most ${LOG_MAX_ENTRIES} exercises.`);

  const cleaned = [];
  for (const e of entries) {
    if (!isObject(e) || !isString(e.exerciseId) || e.exerciseId.length < 1 || e.exerciseId.length > 100
        || !Array.isArray(e.sets)) {
      return fail('Each entry needs an exerciseId, a sets array, and effort 1-5 if given');
    }
    if (e.effort != null && !isInt(e.effort, 1, 5)) {
      return fail('Each entry needs an exerciseId, a sets array, and effort 1-5 if given');
    }
    if (e.sets.length > LOG_MAX_SETS) return fail(`An exercise logs at most ${LOG_MAX_SETS} sets.`);
    const sets = [];
    for (const s of e.sets) {
      if (!isObject(s) || !isInt(s.reps, 0, 1000) || (s.targetReps != null && !isInt(s.targetReps, 0, 1000))) {
        return fail('Each set needs whole-number reps.');
      }
      sets.push({ reps: s.reps, targetReps: s.targetReps ?? 0 });
    }
    if (e.weight != null && !inRange(e.weight, 0, 1000)) return fail('Weight must be between 0 and 1000.');
    if (e.weightUnit != null && !['kg', 'lb'].includes(e.weightUnit)) return fail('Weight unit must be kg or lb.');
    const planDayId = optionalString(e.planDayId, 'Plan day', 100);
    if (!planDayId.ok) return planDayId;
    const painArea = optionalString(e.painArea, 'Pain area', 40);
    if (!painArea.ok) return painArea;
    const painNote = optionalString(e.painNote, 'Pain note', 500);
    if (!painNote.ok) return painNote;

    cleaned.push({
      exerciseId: e.exerciseId,
      planDayId: planDayId.value,
      weight: e.weight ?? null,
      weightUnit: e.weightUnit || 'kg',
      sets,
      effort: e.effort ?? null,
      pain: e.pain === true,
      painArea: painArea.value,
      painNote: painNote.value,
    });
  }
  return ok(cleaned);
};

// --- smaller writes ---------------------------------------------------------

export const validateCompletedWorkout = (raw) => {
  const b = isObject(raw) ? raw : {};
  const dayName = optionalString(b.dayName, 'Day name', 255);
  if (!dayName.ok) return dayName;
  const planDayId = optionalString(b.planDayId, 'Plan day', 100);
  if (!planDayId.ok) return planDayId;
  if (b.exerciseCount != null && !isInt(b.exerciseCount, 0, 200)) return fail('Exercise count is not valid.');
  return ok({ dayName: dayName.value || 'Workout', exerciseCount: b.exerciseCount || 0, planDayId: planDayId.value || null });
};

export const validateCheckinText = (raw) => {
  const c = isObject(raw) ? raw : {};
  const planDayId = optionalString(c.planDayId, 'Plan day', 100);
  if (!planDayId.ok) return planDayId;
  const note = optionalString(c.note, 'Note', 1000);
  if (!note.ok) return note;
  return ok({ planDayId: planDayId.value || null, note: note.value || null });
};
