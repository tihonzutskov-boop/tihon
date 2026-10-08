import { describe, it, expect } from 'vitest';
import { chainOf, sameChain, chainsOf, locationsInChain, cleanChainName, clientLocations } from './gymChains';

const gym = (id: string, name: string, chain?: string | null) => ({ id, name, chain });
const gyms = [
  gym('mf-1', 'MyFitness Kesklinn', 'MyFitness'),
  gym('ind', 'Independent Gym'),
  gym('mf-2', 'MyFitness Ülemiste', ' myfitness '),
  gym('ss-1', 'Sparta Lasnamäe', 'Sparta'),
  gym('mf-3', 'MyFitness Mustamäe', 'MyFitness'),
];

describe('which chain a location is in', () => {
  it('is its chain name, or its own name when it has none', () => {
    expect(chainOf(gyms[0])).toBe('MyFitness');
    expect(chainOf(gyms[1])).toBe('Independent Gym');
    expect(chainOf(gym('x', 'X', '   '))).toBe('X');
  });

  it('matches chain names whatever their case and spacing', () => {
    expect(sameChain('MyFitness', ' myfitness ')).toBe(true);
    expect(sameChain('My  Fitness', 'my fitness')).toBe(true);
    expect(sameChain('MyFitness', 'Sparta')).toBe(false);
    expect(sameChain('', '')).toBe(false);
    expect(sameChain(null, 'MyFitness')).toBe(false);
  });
});

describe('the chains there are', () => {
  it('groups locations into chains in the order they first appear', () => {
    const chains = chainsOf(gyms);
    expect(chains.map(c => c.name)).toEqual(['MyFitness', 'Independent Gym', 'Sparta']);
    expect(chains[0].locations.map(g => g.id)).toEqual(['mf-1', 'mf-2', 'mf-3']);
    expect(chains[1].locations.map(g => g.id)).toEqual(['ind']);
  });

  it('lists the locations of one chain', () => {
    expect(locationsInChain(gyms, 'myfitness').map(g => g.id)).toEqual(['mf-1', 'mf-2', 'mf-3']);
    expect(locationsInChain(gyms, 'Independent Gym').map(g => g.id)).toEqual(['ind']);
    expect(locationsInChain(gyms, 'Nowhere')).toEqual([]);
    expect(locationsInChain(gyms, null)).toEqual([]);
  });

  it('is a chain per location when no chain names are set', () => {
    const plain = [gym('a', 'A'), gym('b', 'B')];
    expect(chainsOf(plain).map(c => c.locations.length)).toEqual([1, 1]);
  });
});

describe('tidying a chain name', () => {
  it('trims, folds spaces and caps the length', () => {
    expect(cleanChainName('  My   Fitness ')).toBe('My Fitness');
    expect(cleanChainName('x'.repeat(200))).toHaveLength(120);
    expect(cleanChainName(42)).toBe('');
    expect(cleanChainName(null)).toBe('');
  });
});

describe('where a client can train', () => {
  it('offers the locations of their chain, their usual one first', () => {
    const r = clientLocations(gyms, { gymChain: 'MyFitness', gymId: 'mf-2' });
    expect(r.chain).toBe('MyFitness');
    expect(r.locations.map(g => g.id)).toEqual(['mf-2', 'mf-1', 'mf-3']);
    expect(r.usualId).toBe('mf-2');
  });

  it('never offers another chain\'s locations', () => {
    const r = clientLocations(gyms, { gymChain: 'Sparta', gymId: 'ss-1' });
    expect(r.locations.map(g => g.id)).toEqual(['ss-1']);
  });

  it('works out the chain from the usual location for answers from before chains were asked', () => {
    const r = clientLocations(gyms, { gymId: 'mf-3' });
    expect(r.chain).toBe('MyFitness');
    expect(r.locations.map(g => g.id)).toEqual(['mf-3', 'mf-1', 'mf-2']);
  });

  it('falls back to the usual location\'s chain when the chosen chain no longer exists', () => {
    const r = clientLocations(gyms, { gymChain: 'Closed Brand', gymId: 'ss-1' });
    expect(r.chain).toBe('Sparta');
  });

  it('has no usual location when it is not in the chain any more', () => {
    const r = clientLocations(gyms, { gymChain: 'MyFitness', gymId: 'ss-1' });
    expect(r.locations.map(g => g.id)).toEqual(['mf-1', 'mf-2', 'mf-3']);
    expect(r.usualId).toBeNull();
  });

  it('offers every location rather than none when nothing names a chain', () => {
    for (const answers of [null, undefined, {}, { gymId: 'gone' }, { gymChain: 'Closed Brand' }]) {
      const r = clientLocations(gyms, answers as any);
      expect(r.chain).toBeNull();
      expect(r.locations).toHaveLength(gyms.length);
      expect(r.usualId).toBeNull();
    }
  });
});
