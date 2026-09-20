import { describe, it, expect } from 'vitest';
import { moveItem, dragTargetIndex, projectedIndex } from './reorder';

describe('moving an item in a list', () => {
  it('moves an item down and up', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('does not mutate the list it was given', () => {
    const list = ['a', 'b', 'c'];
    moveItem(list, 0, 2);
    expect(list).toEqual(['a', 'b', 'c']);
  });

  it('returns the same list when nothing moves, so state does not change', () => {
    const list = ['a', 'b', 'c'];
    expect(moveItem(list, 1, 1)).toBe(list);
    expect(moveItem(list, 5, 0)).toBe(list);
    expect(moveItem(list, 2, 9)).toBe(list);
  });

  it('holds a move past either end at the end', () => {
    expect(moveItem(['a', 'b', 'c'], 1, -4)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 0, 99)).toEqual(['b', 'c', 'a']);
  });
});

describe('which slot a drag lands in', () => {
  const step = 50;

  it('stays put until the row is dragged past the halfway point to its neighbour', () => {
    expect(dragTargetIndex(1, 0, step, 4)).toBe(1);
    expect(dragTargetIndex(1, 24, step, 4)).toBe(1);
    expect(dragTargetIndex(1, 26, step, 4)).toBe(2);
    expect(dragTargetIndex(1, -26, step, 4)).toBe(0);
  });

  it('can jump several slots in one drag', () => {
    expect(dragTargetIndex(0, 155, step, 4)).toBe(3);
  });

  it('never leaves the list', () => {
    expect(dragTargetIndex(0, -500, step, 4)).toBe(0);
    expect(dragTargetIndex(3, 500, step, 4)).toBe(3);
  });

  it('does not divide by a zero step', () => {
    expect(dragTargetIndex(2, 100, 0, 4)).toBe(2);
  });
});

describe('where every row sits while one is dragged', () => {
  const positions = (from: number, over: number, count = 4) =>
    Array.from({ length: count }, (_, i) => projectedIndex(i, from, over));

  it('leaves everything alone before the dragged row has moved slot', () => {
    expect(positions(1, 1)).toEqual([0, 1, 2, 3]);
  });

  it('closes up behind a row dragged down', () => {
    expect(positions(0, 2)).toEqual([2, 0, 1, 3]);
  });

  it('makes room ahead of a row dragged up', () => {
    expect(positions(3, 1)).toEqual([0, 2, 3, 1]);
  });

  it('always yields a permutation, and matches what moveItem will do on drop', () => {
    for (let from = 0; from < 4; from++) {
      for (let over = 0; over < 4; over++) {
        const projected = positions(from, over);
        expect([...projected].sort()).toEqual([0, 1, 2, 3]);
        const dropped = moveItem(['a', 'b', 'c', 'd'], from, over);
        // Row i is shown at projected[i]; after the drop that same item is at that index.
        ['a', 'b', 'c', 'd'].forEach((item, i) => expect(dropped[projected[i]]).toBe(item));
      }
    }
  });
});
