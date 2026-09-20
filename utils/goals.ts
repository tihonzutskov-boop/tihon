// The goals a client sees in the questionnaire, and the engine aims behind them.
//
// The engine knows five aims (see AIM_PROFILES in planGeneration.ts). Clients
// pick from friendlier names, in two tiers: a main goal that owns training
// days, and secondary goals that ride along as supporting work inside those
// days. Answers store engine aim keys — `goals` for the main ones, ranked, and
// `secondaryGoals` for the supporting ones — so old answers stay valid and
// nothing downstream needs to know the friendly names exist.

export interface GoalOption {
  label: string;
  /** The engine aim this choice resolves to. */
  aim: string;
  hint: string;
}

export interface SecondaryGoalOption extends GoalOption {
  /** Main-goal aims this is offered alongside. */
  suggestedFor: string[];
}

export const PRIMARY_GOALS: GoalOption[] = [
  { label: 'Muscle growth', aim: 'Muscle gain', hint: 'Get bigger and stronger' },
  { label: 'Fat loss', aim: 'Weight loss', hint: 'Burn more and lean out' },
  { label: 'Better fitness', aim: 'Endurance', hint: 'More stamina and energy' },
  { label: 'Healthy lifestyle', aim: 'General fitness', hint: 'Stay active and feel good' },
];

// Each is something the engine can do as supporting work today. Adding a
// choice here that no aim backs would be a button that changes nothing.
export const SECONDARY_GOALS: SecondaryGoalOption[] = [
  {
    label: 'Mobility & flexibility', aim: 'Mobility',
    hint: 'Move better, stay loose',
    suggestedFor: ['Muscle gain', 'Weight loss', 'Endurance', 'General fitness'],
  },
  {
    label: 'Stamina', aim: 'Endurance',
    hint: 'Keep going for longer',
    suggestedFor: ['Muscle gain', 'General fitness'],
  },
  {
    label: 'Build muscle', aim: 'Muscle gain',
    hint: 'Add tone and strength',
    suggestedFor: ['Weight loss', 'Endurance', 'General fitness'],
  },
];

export const primaryGoalLabel = (aim: string): string =>
  PRIMARY_GOALS.find(g => g.aim === aim)?.label ?? aim;

export const secondaryGoalLabel = (aim: string): string =>
  SECONDARY_GOALS.find(g => g.aim === aim)?.label ?? aim;

/**
 * The secondary goals worth offering for the chosen main goals: whatever suits
 * any of them, minus anything already chosen as a main goal.
 */
export const secondaryOptionsFor = (primaryAims: string[]): SecondaryGoalOption[] =>
  SECONDARY_GOALS.filter(o =>
    !primaryAims.includes(o.aim) && o.suggestedFor.some(a => primaryAims.includes(a))
  );

/** Drops secondary goals that are no longer on offer after the main goals changed. */
export const pruneSecondary = (primaryAims: string[], secondaryAims: string[]): string[] => {
  const offered = new Set(secondaryOptionsFor(primaryAims).map(o => o.aim));
  return secondaryAims.filter(a => offered.has(a));
};

/**
 * Form state from stored answers. Anything stored as a main goal that is no
 * longer offered as one (a legacy 'Mobility') is kept as a secondary goal
 * instead, so editing old answers does not silently lose it.
 */
export const goalsFromAnswers = (
  answers: { goals?: string[]; secondaryGoals?: string[] } | null | undefined
): { primary: string[]; secondary: string[] } => {
  const stored = answers?.goals ?? [];
  const isPrimary = (aim: string) => PRIMARY_GOALS.some(g => g.aim === aim);
  const primary = stored.filter(isPrimary);
  const demoted = stored.filter(a => !isPrimary(a));
  const secondary = [...(answers?.secondaryGoals ?? []), ...demoted];
  return {
    primary,
    secondary: pruneSecondary(primary, secondary.filter((a, i) => secondary.indexOf(a) === i)),
  };
};

/** Friendly names for display: main goals first, then secondary ones. */
export const describeGoals = (
  answers: { goals?: string[]; secondaryGoals?: string[] } | null | undefined
): { primary: string[]; secondary: string[] } => ({
  primary: (answers?.goals ?? []).map(primaryGoalLabel),
  secondary: (answers?.secondaryGoals ?? []).map(secondaryGoalLabel),
});
