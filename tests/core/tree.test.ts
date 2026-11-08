import { createItem, descendantIds, softDelete, wouldCreateCycle, type Item } from '../../src/core';
import { testContext } from './helpers';

function tree() {
  const ctx = testContext();
  const mk = (title: string, parentId: string | null = null, order = 0) =>
    createItem({ kind: 'task', title, agendaId: 'a', parentId, order }, ctx);
  const root = mk('root');
  const a = mk('a', root.id, 1);
  const b = mk('b', root.id, 0);
  const a1 = mk('a1', a.id);
  const a11 = mk('a11', a1.id);
  return { ctx, root, a, b, a1, a11, all: [root, a, b, a1, a11] };
}

describe('tree helpers', () => {
  it('finds descendants at any depth', () => {
    const { root, a, b, a1, a11, all } = tree();
    expect(descendantIds(root.id, all)).toEqual(new Set([a.id, b.id, a1.id, a11.id]));
    expect(descendantIds(a.id, all)).toEqual(new Set([a1.id, a11.id]));
    expect(descendantIds(b.id, all)).toEqual(new Set());
  });

  it('skips deleted items', () => {
    const { ctx, root, a, all } = tree();
    const withDeleted = all.map((item) => (item.id === a.id ? softDelete(item, ctx) : item));
    expect(descendantIds(root.id, withDeleted).has(a.id)).toBe(false);
  });

  it('detects a move that would create a cycle', () => {
    const { root, a, a11, b, all } = tree();
    expect(wouldCreateCycle(a.id, a.id, all)).toBe(true);
    expect(wouldCreateCycle(a.id, a11.id, all)).toBe(true);
    expect(wouldCreateCycle(root.id, null, all)).toBe(false);
    expect(wouldCreateCycle(a.id, b.id, all)).toBe(false);
  });

  it('does not hang on data that already has a cycle', () => {
    const { a, a11, all } = tree();
    const broken: Item[] = all.map((item) =>
      item.id === a.id ? { ...item, parentId: a11.id } : item,
    );
    expect(descendantIds(a.id, broken).size).toBeGreaterThan(0);
  });
});
