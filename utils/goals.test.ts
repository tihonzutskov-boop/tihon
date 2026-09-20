import { describe, it, expect } from 'vitest';
import {
  PRIMARY_GOALS, SECONDARY_GOALS, secondaryOptionsFor, pruneSecondary, goalsFromAnswers,
  describeGoals, primaryGoalLabel, secondaryGoalLabel,
} from './goals';
import { aimProfile } from './planGeneration';
import { QUESTIONNAIRE_GOALS } from '../constants';

const ENGINE_AIMS = ['Muscle gain', 'Weight loss', 'General fitness', 'Endurance', 'Mobility'];

describe('the goals a client can choose', () => {
  it('offers the four general goals, each resolving to a different aim', () => {
    expect(PRIMARY_GOALS.map(g => g.label)).toEqual(
      ['Muscle growth', 'Fat loss', 'Better fitness', 'Healthy lifestyle']
    );
    expect(new Set(PRIMARY_GOALS.map(g => g.aim)).size).toBe(4);
  });

  it('only resolves to aims the engine has a profile for', () => {
    // aimProfile silently falls back to the default aim's profile for an
    // unknown name, so an unbacked choice would look fine and change nothing.
    // The default itself ('General fitness') is the one aim that cannot be told
    // apart from the fallback this way, so it is checked by name.
    const unknown = aimProfile('Nonexistent');
    for (const g of [...PRIMARY_GOALS, ...SECONDARY_GOALS]) {
      expect(ENGINE_AIMS).toContain(g.aim);
      if (g.aim !== 'General fitness') expect(aimProfile(g.aim)).not.toBe(unknown);
    }
  });

  it('keeps the admin roster able to group every client a main goal can produce', () => {
    for (const g of PRIMARY_GOALS) expect(QUESTIONNAIRE_GOALS).toContain(g.aim);
  });

  it('never suggests a secondary goal that is the same aim as the main goal it is suggested for', () => {
    for (const o of SECONDARY_GOALS) expect(o.suggestedFor).not.toContain(o.aim);
  });
});

describe('secondary goals follow the main goal', () => {
  const labels = (aims: string[]) => secondaryOptionsFor(aims).map(o => o.label);

  it('offers nothing before a main goal is chosen', () => {
    expect(secondaryOptionsFor([])).toEqual([]);
  });

  it('offers mobility and stamina alongside muscle growth', () => {
    expect(labels(['Muscle gain'])).toEqual(['Mobility & flexibility', 'Stamina']);
  });

  it('offers building muscle, not stamina, alongside fat loss', () => {
    expect(labels(['Weight loss'])).toEqual(['Mobility & flexibility', 'Build muscle']);
  });

  it('does not offer as a secondary goal what was already chosen as a main one', () => {
    expect(labels(['Endurance'])).not.toContain('Stamina');
    expect(labels(['Muscle gain'])).not.toContain('Build muscle');
    expect(labels(['Muscle gain', 'Endurance'])).toEqual(['Mobility & flexibility']);
  });

  it('is the union of what suits each main goal', () => {
    expect(labels(['Weight loss', 'General fitness'])).toEqual(['Mobility & flexibility', 'Stamina', 'Build muscle']);
    // Muscle growth is a main goal here, so building muscle is not "secondary".
    expect(labels(['Muscle gain', 'Weight loss'])).toEqual(['Mobility & flexibility', 'Stamina']);
  });

  it('drops a chosen secondary goal once the main goal change takes it off offer', () => {
    expect(pruneSecondary(['Muscle gain'], ['Endurance', 'Mobility'])).toEqual(['Endurance', 'Mobility']);
    expect(pruneSecondary(['Muscle gain', 'Endurance'], ['Endurance', 'Mobility'])).toEqual(['Mobility']);
    expect(pruneSecondary([], ['Mobility'])).toEqual([]);
  });
});

describe('reading stored answers back into the form', () => {
  it('reads new answers as they were stored', () => {
    expect(goalsFromAnswers({ goals: ['Weight loss', 'Muscle gain'], secondaryGoals: ['Mobility'] })).toEqual({
      primary: ['Weight loss', 'Muscle gain'], secondary: ['Mobility'],
    });
  });

  it('reads answers from before secondary goals existed', () => {
    expect(goalsFromAnswers({ goals: ['Muscle gain', 'Endurance'] })).toEqual({
      primary: ['Muscle gain', 'Endurance'], secondary: [],
    });
  });

  it('keeps a legacy Mobility main goal as a secondary one rather than losing it', () => {
    expect(goalsFromAnswers({ goals: ['Muscle gain', 'Mobility'] })).toEqual({
      primary: ['Muscle gain'], secondary: ['Mobility'],
    });
  });

  it('has no main goal for a client who only ever chose mobility, so they pick one on edit', () => {
    expect(goalsFromAnswers({ goals: ['Mobility'] })).toEqual({ primary: [], secondary: [] });
  });

  it('copes with no answers at all', () => {
    expect(goalsFromAnswers(null)).toEqual({ primary: [], secondary: [] });
  });
});

describe('showing goals by their friendly names', () => {
  it('names main and secondary goals', () => {
    expect(describeGoals({ goals: ['Muscle gain', 'Weight loss'], secondaryGoals: ['Mobility', 'Endurance'] })).toEqual({
      primary: ['Muscle growth', 'Fat loss'], secondary: ['Mobility & flexibility', 'Stamina'],
    });
  });

  it('reads the same aim by the name for the tier it is in', () => {
    expect(primaryGoalLabel('Endurance')).toBe('Better fitness');
    expect(secondaryGoalLabel('Endurance')).toBe('Stamina');
  });

  it('falls back to the raw value for an aim it has no name for', () => {
    expect(primaryGoalLabel('Mobility')).toBe('Mobility');
  });
});
