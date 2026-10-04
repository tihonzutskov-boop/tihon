// The goals a client sees in the questionnaire, and the engine aims behind them.
//
// Three levels, each narrower than the one before:
//   1. a broad type of training (required, one),
//   2. the goals that type offers (required, one or both, ranked),
//   3. body areas to focus on (optional, up to three).
// The engine knows five aims (see AIM_PROFILES in planGeneration.ts). Answers
// store the aim keys in `goals`, so nothing downstream needs to know the
// friendly names exist; `trainingType` and `focusAreas` sit beside them.

import { ALL_FOCUS_AREAS } from '../types';
import type { FocusArea } from '../types';

export interface GoalOption {
  label: string;
  /** The engine aim this choice resolves to. */
  aim: string;
  hint: string;
}

export type TrainingTypeKey = 'Strength' | 'Cardio' | 'Health';

export interface TrainingType {
  key: TrainingTypeKey;
  label: string;
  hint: string;
  goals: GoalOption[];
}

// Every goal is something the engine does today. A choice no aim backs would
// be a button that changes nothing. "Tone up" and "Stay active" share the
// general-fitness aim, so they build the same style of plan.
export const TRAINING_TYPES: TrainingType[] = [
  {
    key: 'Strength', label: 'Strength', hint: 'Lift weights, get stronger',
    goals: [
      { label: 'Build muscle', aim: 'Muscle gain', hint: 'Get bigger and stronger' },
      { label: 'Tone up', aim: 'General fitness', hint: 'Firmer and fitter, without bulk' },
    ],
  },
  {
    key: 'Cardio', label: 'Cardio & fat burn', hint: 'Burn calories, build fitness',
    goals: [
      { label: 'Lose weight', aim: 'Weight loss', hint: 'Weights, then easy zone 2 cardio' },
    ],
  },
  {
    key: 'Health', label: 'Health & mobility', hint: 'Move well, feel good',
    goals: [
      { label: 'Mobility & flexibility', aim: 'Mobility', hint: 'Move better, stay loose' },
      { label: 'Stay active', aim: 'General fitness', hint: 'Keep moving and feel good' },
    ],
  },
];

export const FOCUS_AREAS: FocusArea[] = ALL_FOCUS_AREAS;
export const MAX_FOCUS_AREAS = 3;

export const trainingTypeFor = (key: string | null | undefined): TrainingType | undefined =>
  TRAINING_TYPES.find(t => t.key === key);

// Answers from before the training type was asked carry only aims. This is
// the type each aim was closest to then — general fitness was "Healthy
// lifestyle", so it reads as Health rather than Strength's "Tone up".
const LEGACY_TYPE_BY_AIM: Record<string, TrainingTypeKey> = {
  'Muscle gain': 'Strength',
  'Weight loss': 'Cardio',
  'Endurance': 'Cardio',
  'Mobility': 'Health',
  'General fitness': 'Health',
};

// Aims a client can no longer choose. Answers saved earlier still carry them,
// and the plans built from those answers still use them, so they keep a name.
const RETIRED_LABELS: Record<string, string> = { 'Endurance': 'Build stamina' };

/** The client's name for an aim, as the training type they chose words it. */
export const goalLabel = (aim: string, typeKey?: string | null): string => {
  const type = trainingTypeFor(typeKey) ?? trainingTypeFor(LEGACY_TYPE_BY_AIM[aim]);
  return type?.goals.find(g => g.aim === aim)?.label ?? RETIRED_LABELS[aim] ?? aim;
};

type StoredGoals = {
  trainingType?: string; goals?: string[]; focusAreas?: string[]; secondaryGoals?: string[];
} | null | undefined;

const validFocus = (areas: string[] | undefined): FocusArea[] =>
  (areas ?? []).filter((a, i, all): a is FocusArea =>
    (FOCUS_AREAS as string[]).includes(a) && all.indexOf(a) === i).slice(0, MAX_FOCUS_AREAS);

/**
 * Form state from stored answers. Answers from before the training type was
 * asked get the type of their top-ranked goal, keeping whichever of their
 * goals that type offers — editing them is how the rest drops away.
 */
export const goalsFromAnswers = (answers: StoredGoals): { trainingType: string; goals: string[]; focusAreas: FocusArea[] } => {
  const stored = answers?.goals ?? [];
  const type = trainingTypeFor(answers?.trainingType) ?? trainingTypeFor(LEGACY_TYPE_BY_AIM[stored[0]]);
  if (!type) return { trainingType: '', goals: [], focusAreas: validFocus(answers?.focusAreas) };
  const offered = new Set(type.goals.map(g => g.aim));
  return {
    trainingType: type.key,
    goals: stored.filter((a, i) => offered.has(a) && stored.indexOf(a) === i),
    focusAreas: validFocus(answers?.focusAreas),
  };
};

/**
 * Friendly names for display, level by level. `type` is null on answers saved
 * before it was asked; `extras` are the supporting goals those older answers
 * could carry, which their plans still use.
 */
export const describeGoals = (answers: StoredGoals): { type: string | null; goals: string[]; extras: string[]; focus: string[] } => ({
  type: trainingTypeFor(answers?.trainingType)?.label ?? null,
  goals: (answers?.goals ?? []).map(aim => goalLabel(aim, answers?.trainingType)),
  extras: (answers?.secondaryGoals ?? []).map(aim => goalLabel(aim)),
  focus: validFocus(answers?.focusAreas),
});
