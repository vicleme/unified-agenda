import { moveStep } from '../../src/core';

const entry = (id: string, order: number) => ({ id, order });

describe('moveStep', () => {
  const list = [entry('a', 0), entry('b', 1), entry('c', 2)];

  it('swaps an entry with the one above and renumbers only what changed', () => {
    expect(moveStep(list, 'b', -1)).toEqual([
      { id: 'b', order: 0 },
      { id: 'a', order: 1 },
    ]);
  });

  it('swaps an entry with the one below', () => {
    expect(moveStep(list, 'b', 1)).toEqual([
      { id: 'c', order: 1 },
      { id: 'b', order: 2 },
    ]);
  });

  it('does nothing at either end or for an unknown id', () => {
    expect(moveStep(list, 'a', -1)).toEqual([]);
    expect(moveStep(list, 'c', 1)).toEqual([]);
    expect(moveStep(list, 'zzz', 1)).toEqual([]);
  });

  it('repairs entries that share the same order', () => {
    const tied = [entry('a', 0), entry('b', 0), entry('c', 0)];
    expect(moveStep(tied, 'b', 1)).toEqual([
      { id: 'c', order: 1 },
      { id: 'b', order: 2 },
    ]);
  });

  it('numbers from zero even when the orders have gaps', () => {
    const gaps = [entry('a', 4), entry('b', 9)];
    expect(moveStep(gaps, 'b', -1)).toEqual([
      { id: 'b', order: 0 },
      { id: 'a', order: 1 },
    ]);
  });
});
