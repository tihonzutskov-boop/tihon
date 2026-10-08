// Gym chains: several locations of one brand.
//
// A client picks a chain when they make their plan, and a usual location in it;
// the plan is built from what that location has. Each session they pick which of
// the chain's locations they are at, and the plan is checked against that one
// (see gymSwap.ts). A location with no chain set is a chain of its own, so a gym
// that is not part of any brand works exactly as it always did.

export interface ChainedGym {
  id: string;
  name: string;
  chain?: string | null;
}

export const MAX_CHAIN_NAME = 120;

/** The chain a location belongs to, by name: its own name when it has no chain. */
export const chainOf = (gym: ChainedGym): string => (gym.chain || '').trim() || gym.name.trim();

// Two locations are one chain when their chain names match, ignoring case and spacing.
const keyOf = (name: string): string => name.trim().replace(/\s+/g, ' ').toLowerCase();

export const sameChain = (a: string | null | undefined, b: string | null | undefined): boolean =>
  !!a && !!b && keyOf(a) === keyOf(b);

export interface Chain<G extends ChainedGym> {
  name: string;
  locations: G[];
}

/** Every chain, in the order its first location appears, each with its locations in order. */
export const chainsOf = <G extends ChainedGym>(gyms: G[]): Chain<G>[] => {
  const byKey = new Map<string, Chain<G>>();
  for (const g of gyms) {
    const name = chainOf(g);
    const key = keyOf(name);
    const existing = byKey.get(key);
    if (existing) existing.locations.push(g);
    else byKey.set(key, { name, locations: [g] });
  }
  return [...byKey.values()];
};

export const locationsInChain = <G extends ChainedGym>(gyms: G[], chain: string | null | undefined): G[] =>
  chain ? gyms.filter(g => sameChain(chainOf(g), chain)) : [];

/** A chain name as an admin typed it, tidied: trimmed, single spaces, at most 120 characters. Empty means none. */
export const cleanChainName = (value: unknown): string =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, MAX_CHAIN_NAME) : '';

export interface ClientLocations<G extends ChainedGym> {
  /** The chain the client trains with, or null when nothing on file names one. */
  chain: string | null;
  /** The locations they can pick from for a session, their usual one first. */
  locations: G[];
  /** Their usual location, when it is still one of those. */
  usualId: string | null;
}

/**
 * Where a client can train, from their questionnaire answers. The chain they
 * picked, or the chain of their usual location for answers from before chains
 * were asked. With neither, every location is offered rather than none.
 */
export const clientLocations = <G extends ChainedGym>(
  gyms: G[],
  answers: { gymChain?: string | null; gymId?: string | null } | null | undefined,
): ClientLocations<G> => {
  const usual = gyms.find(g => g.id === answers?.gymId) || null;
  const chain = (answers?.gymChain && locationsInChain(gyms, answers.gymChain).length > 0 ? answers.gymChain : null)
    ?? (usual ? chainOf(usual) : null);
  const inChain = chain ? locationsInChain(gyms, chain) : [];
  const locations = inChain.length > 0 ? inChain : gyms;
  const usualHere = usual && locations.some(g => g.id === usual.id) ? usual : null;
  return {
    chain: inChain.length > 0 ? chainOf(inChain[0]) : null,
    locations: usualHere ? [usualHere, ...locations.filter(g => g.id !== usualHere.id)] : locations,
    usualId: usualHere?.id ?? null,
  };
};
