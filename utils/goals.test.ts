import { describe, it, expect } from 'vitest';
import {
  TRAINING_TYPES, FOCUS_AREAS, MAX_FOCUS_AREAS, trainingTypeFor, goalLabel, goalsFromAnswers, describeGoals,
} from './goals';
import { aimProfile } from './planGeneration';
import { QUESTIONNAIRE_GOALS, SESSION_LENGTHS } from '../constants';
import {
  TRAINING_TYPES as SERVER_TYPES, FOCUS_AREAS as SERVER_FOCUS, MAX_FOCUS_AREAS as SERVER_MAX_FOCUS,
  SESSION_LENGTHS as SERVER_LENGTHS,
} from '../server/validate.js';

const ENGINE_AIMS = ['Muscle gain', 'Weight loss', 'General fitness', 'Endurance', 'Mobility'];
const allGoals = TRAINING_TYPES.flatMap(t => t.goals);

describe('the three levels of goals', () => {
  it('starts broad: three types of training', () => {
    expect(TRAINING_TYPES.map(t => t.label)).toEqual(['Strength', 'Cardio & fat burn', 'Health & mobility']);
  });

  it('offers each type its own goals', () => {
    const labels = (key: string) => trainingTypeFor(key)!.goals.map(g => g.label);
    expect(labels('Strength')).toEqual(['Build muscle', 'Tone up']);
    expect(labels('Cardio')).toEqual(['Lose weight']);
    expect(labels('Health')).toEqual(['Mobility & flexibility', 'Stay active']);
  });

  it('never offers the same aim twice within one type', () => {
    for (const t of TRAINING_TYPES) expect(new Set(t.goals.map(g => g.aim)).size).toBe(t.goals.length);
  });

  it('only resolves to aims the engine has a profile for', () => {
    // aimProfile silently falls back to the default aim's profile for an
    // unknown name, so an unbacked choice would look fine and change nothing.
    // The default itself ('General fitness') is the one aim that cannot be told
    // apart from the fallback this way, so it is checked by name.
    const unknown = aimProfile('Nonexistent');
    for (const g of allGoals) {
      expect(ENGINE_AIMS).toContain(g.aim);
      if (g.aim !== 'General fitness') expect(aimProfile(g.aim)).not.toBe(unknown);
    }
  });

  it('reaches every aim the engine has except endurance, which is no longer offered', () => {
    expect(new Set(allGoals.map(g => g.aim))).toEqual(new Set(ENGINE_AIMS.filter(a => a !== 'Endurance')));
    // Still an aim, so a client who chose it earlier keeps a working plan.
    expect(aimProfile('Endurance')).not.toBe(aimProfile('Nonexistent'));
  });

  it('keeps the admin roster able to group every client a goal can produce', () => {
    for (const g of allGoals) expect(QUESTIONNAIRE_GOALS).toContain(g.aim);
  });

  it('ends with optional body areas to focus on, at most three', () => {
    expect(FOCUS_AREAS).toEqual(['Glutes', 'Legs', 'Core', 'Back', 'Chest', 'Arms', 'Shoulders']);
    expect(MAX_FOCUS_AREAS).toBe(3);
  });

  it('agrees with what the server accepts', () => {
    expect(SERVER_TYPES).toEqual(TRAINING_TYPES.map(t => t.key));
    expect(SERVER_FOCUS).toEqual(FOCUS_AREAS);
    expect(SERVER_MAX_FOCUS).toBe(MAX_FOCUS_AREAS);
  });

  it('offers session lengths from 45 minutes, and the server accepts the same ones', () => {
    expect(SESSION_LENGTHS).toEqual(['45 min', '60 min', '90 min']);
    expect(SERVER_LENGTHS).toEqual(SESSION_LENGTHS);
  });
});

describe('naming a goal', () => {
  it('uses the wording of the type the client chose', () => {
    expect(goalLabel('General fitness', 'Strength')).toBe('Tone up');
    expect(goalLabel('General fitness', 'Health')).toBe('Stay active');
    expect(goalLabel('Weight loss', 'Cardio')).toBe('Lose weight');
  });

  it('names an aim from answers that carry no type the way it was meant then', () => {
    expect(goalLabel('Muscle gain')).toBe('Build muscle');
    // Was "Healthy lifestyle", which is Health's "Stay active", not "Tone up".
    expect(goalLabel('General fitness')).toBe('Stay active');
  });

  it('still names the stamina goal for clients who chose it before it was removed', () => {
    expect(goalLabel('Endurance')).toBe('Build stamina');
    expect(goalLabel('Endurance', 'Cardio')).toBe('Build stamina');
  });

  it('falls back to the raw value for an aim it has no name for', () => {
    expect(goalLabel('Something else')).toBe('Something else');
  });
});

describe('reading stored answers back into the form', () => {
  it('reads new answers as they were stored', () => {
    expect(goalsFromAnswers({ trainingType: 'Strength', goals: ['General fitness', 'Muscle gain'], focusAreas: ['Legs', 'Core'] })).toEqual({
      trainingType: 'Strength', goals: ['General fitness', 'Muscle gain'], focusAreas: ['Legs', 'Core'],
    });
  });

  it('gives answers from before the training type existed the type of their top goal', () => {
    expect(goalsFromAnswers({ goals: ['Weight loss'] })).toEqual({
      trainingType: 'Cardio', goals: ['Weight loss'], focusAreas: [],
    });
    expect(goalsFromAnswers({ goals: ['General fitness'] }).trainingType).toBe('Health');
  });

  it('lets a goal that is no longer offered go when the answers are edited', () => {
    expect(goalsFromAnswers({ goals: ['Endurance', 'Weight loss'] })).toEqual({
      trainingType: 'Cardio', goals: ['Weight loss'], focusAreas: [],
    });
    // Only stamina chosen: the type is kept, the goal has to be picked again.
    expect(goalsFromAnswers({ goals: ['Endurance'] })).toEqual({ trainingType: 'Cardio', goals: [], focusAreas: [] });
  });

  it('keeps only the goals that type offers', () => {
    expect(goalsFromAnswers({ goals: ['Muscle gain', 'Weight loss'], secondaryGoals: ['Mobility'] })).toEqual({
      trainingType: 'Strength', goals: ['Muscle gain'], focusAreas: [],
    });
  });

  it('ignores focus areas it does not know and keeps at most three', () => {
    expect(goalsFromAnswers({
      trainingType: 'Strength', goals: ['Muscle gain'], focusAreas: ['Arms', 'Toes', 'Arms', 'Back', 'Chest', 'Core'],
    }).focusAreas).toEqual(['Arms', 'Back', 'Chest']);
  });

  it('copes with no answers at all', () => {
    expect(goalsFromAnswers(null)).toEqual({ trainingType: '', goals: [], focusAreas: [] });
  });
});

describe('showing goals by their friendly names', () => {
  it('names each level', () => {
    expect(describeGoals({ trainingType: 'Strength', goals: ['General fitness', 'Muscle gain'], focusAreas: ['Glutes'] })).toEqual({
      type: 'Strength', goals: ['Tone up', 'Build muscle'], extras: [], focus: ['Glutes'],
    });
  });

  it('still shows what older answers chose', () => {
    expect(describeGoals({ goals: ['Muscle gain'], secondaryGoals: ['Mobility', 'Endurance'] })).toEqual({
      type: null, goals: ['Build muscle'], extras: ['Mobility & flexibility', 'Build stamina'], focus: [],
    });
  });
});
