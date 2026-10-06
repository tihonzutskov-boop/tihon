import { describe, it, expect } from 'vitest';
import { missingBeforeNext } from './sessionGate';

const sets = (...done: boolean[]) => done.map(d => ({ done: d, weight: '' }));

describe('what has to be recorded before the next exercise', () => {
  it('is nothing once every set is ticked and the effort is rated, with no weight typed', () => {
    expect(missingBeforeNext(sets(true, true, true), true)).toEqual([]);
  });

  it('does not ask for a weight, whether or not one was entered', () => {
    const blank = missingBeforeNext([{ done: true, weight: '' }, { done: true, weight: '' }] as any, true);
    const typed = missingBeforeNext([{ done: true, weight: '20' }, { done: true, weight: '' }] as any, true);
    expect(blank).toEqual([]);
    expect(typed).toEqual([]);
    expect([...blank, ...typed].join(' ')).not.toMatch(/weight/i);
  });

  it('asks for the sets to be ticked while one is not', () => {
    expect(missingBeforeNext(sets(true, false, true), true)).toEqual(['tick every set you finished']);
    expect(missingBeforeNext(sets(false), true)).toEqual(['tick every set you finished']);
  });

  it('asks for the effort to be rated while it is not', () => {
    expect(missingBeforeNext(sets(true, true), false)).toEqual(['rate how hard it was']);
  });

  it('asks for both, sets first, when neither is done', () => {
    expect(missingBeforeNext(sets(false, false), false)).toEqual(['tick every set you finished', 'rate how hard it was']);
  });

  it('does not let an exercise with no sets at all pass as done', () => {
    expect(missingBeforeNext([], true)).toEqual(['tick every set you finished']);
  });
});
