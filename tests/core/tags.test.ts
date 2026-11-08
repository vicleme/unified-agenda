import {
  createItem,
  createTag,
  effectiveScope,
  effectiveTagIds,
  indexById,
  inheritedTags,
  normalizeTagScopes,
  shouldOfferGlobal,
  softDelete,
  tagWithDescendantIds,
  tagsForAgenda,
  tagsForFilter,
  tagsLostByMoving,
} from '../../src/core';
import { testContext } from './helpers';

function setup() {
  const ctx = testContext();
  const mk = (name: string, parentId: string | null = null, agendaIds: string[] = []) =>
    createTag({ name, color: '#3b5bdb', parentId, agendaIds }, ctx);
  return { ctx, mk };
}

describe('tag scope', () => {
  it('treats an empty list as global', () => {
    const { mk } = setup();
    const t = mk('global');
    expect(effectiveScope(t.id, indexById([t]))).toBeNull();
  });

  it('inherits the parent scope when the child is global', () => {
    const { mk } = setup();
    const parent = mk('parent', null, ['a', 'b']);
    const child = mk('child', parent.id);
    expect(effectiveScope(child.id, indexById([parent, child]))).toEqual(['a', 'b']);
  });

  it('never lets a child be wider than the parent', () => {
    const { mk } = setup();
    const parent = mk('parent', null, ['a', 'b']);
    const child = mk('child', parent.id, ['b', 'c']);
    const grand = mk('grand', child.id, ['a', 'b']);
    const byId = indexById([parent, child, grand]);
    expect(effectiveScope(child.id, byId)).toEqual(['b']);
    expect(effectiveScope(grand.id, byId)).toEqual(['b']);
  });
});

describe('normalizeTagScopes', () => {
  it('changes nothing when every child already fits', () => {
    const { ctx, mk } = setup();
    const parent = mk('parent', null, ['a', 'b']);
    const child = mk('child', parent.id, ['a']);
    const { changed, changes } = normalizeTagScopes([parent, child], ctx);
    expect(changed).toEqual([]);
    expect(changes).toEqual([]);
  });

  it('narrows children after the parent is restricted and reports each change', () => {
    const { ctx, mk } = setup();
    const parent = mk('parent', null, ['a']);
    const globalChild = mk('global child', parent.id);
    const partial = mk('partial', parent.id, ['a', 'b']);
    const outside = mk('outside', parent.id, ['c']);
    const grand = mk('grand', globalChild.id);

    const { changed, changes } = normalizeTagScopes(
      [grand, outside, partial, globalChild, parent],
      ctx,
    );

    const after = Object.fromEntries(changes.map((c) => [c.tagId, c.after]));
    expect(after[globalChild.id]).toEqual(['a']);
    expect(after[partial.id]).toEqual(['a']);
    expect(after[outside.id]).toEqual(['a']);
    expect(after[grand.id]).toEqual(['a']);
    expect(changes.find((c) => c.tagId === partial.id)?.before).toEqual(['a', 'b']);
    expect(changed).toHaveLength(4);
    expect(changed.every((t) => t.agendaIds.length === 1)).toBe(true);
  });

  it('does not touch the input and ignores deleted tags', () => {
    const { ctx, mk } = setup();
    const parent = mk('parent', null, ['a']);
    const child = mk('child', parent.id);
    const gone = softDelete(mk('gone', parent.id), ctx);
    const { changed } = normalizeTagScopes([parent, child, gone], ctx);
    expect(child.agendaIds).toEqual([]);
    expect(changed.map((t) => t.id)).toEqual([child.id]);
  });
});

describe('tags for an agenda', () => {
  it('offers global tags plus the ones restricted to that agenda', () => {
    const { mk } = setup();
    const global = mk('global');
    const onlyA = mk('only a', null, ['a']);
    const onlyB = mk('only b', null, ['b']);
    const names = tagsForAgenda([global, onlyA, onlyB], 'a').map((t) => t.name);
    expect(names).toEqual(['global', 'only a']);
  });
});

describe('tags for a filter', () => {
  it('shows tags valid in at least one selected agenda and flags the partial ones', () => {
    const { mk } = setup();
    const global = mk('global');
    const onlyA = mk('only a', null, ['a']);
    const aAndB = mk('a and b', null, ['a', 'b']);
    const onlyC = mk('only c', null, ['c']);
    const result = tagsForFilter([global, onlyA, aAndB, onlyC], ['a', 'b']);
    const view = Object.fromEntries(result.map((r) => [r.tag.name, r.partial]));
    expect(view).toEqual({ global: false, 'only a': true, 'a and b': false });
  });
});

describe('tag filtering and moving', () => {
  it('includes descendants of a parent and only itself for a leaf', () => {
    const { mk } = setup();
    const root = mk('root');
    const mid = mk('mid', root.id);
    const leaf = mk('leaf', mid.id);
    const other = mk('other');
    const all = [root, mid, leaf, other];
    expect(tagWithDescendantIds(root.id, all)).toEqual(new Set([root.id, mid.id, leaf.id]));
    expect(tagWithDescendantIds(leaf.id, all)).toEqual(new Set([leaf.id]));
  });

  it('lists the tags an item would lose by moving to another agenda', () => {
    const { mk } = setup();
    const global = mk('global');
    const onlyA = mk('only a', null, ['a']);
    const lost = tagsLostByMoving([global.id, onlyA.id], 'b', [global, onlyA]);
    expect(lost.map((t) => t.name)).toEqual(['only a']);
    expect(tagsLostByMoving([global.id, onlyA.id], 'a', [global, onlyA])).toEqual([]);
  });

  it('offers to make a tag global when it covers every agenda', () => {
    const { mk } = setup();
    const covers = mk('covers', null, ['a', 'b']);
    const partial = mk('partial', null, ['a']);
    const global = mk('global');
    const all = [covers, partial, global];
    expect(shouldOfferGlobal(covers, all, ['a', 'b'])).toBe(true);
    expect(shouldOfferGlobal(partial, all, ['a', 'b'])).toBe(false);
    expect(shouldOfferGlobal(global, all, ['a', 'b'])).toBe(false);
    expect(shouldOfferGlobal(covers, all, [])).toBe(false);
  });

  it('does not offer global under a restricted parent', () => {
    const { mk } = setup();
    const parent = mk('parent', null, ['a']);
    const child = mk('child', parent.id, ['a']);
    expect(shouldOfferGlobal(child, [parent, child], ['a'])).toBe(false);
  });
});

describe('inherited tags', () => {
  const ctx = testContext();
  const make = (title: string, extra: Partial<Parameters<typeof createItem>[0]> = {}) =>
    createItem({ kind: 'task', title, agendaId: 'a', ...extra }, ctx);

  it('an item gets the tags of its parent and grandparent, with the source', () => {
    const top = make('Top', { tagIds: ['work'] });
    const middle = make('Middle', { parentId: top.id, tagIds: ['urgent'] });
    const leaf = make('Leaf', { parentId: middle.id });
    const byId = indexById([top, middle, leaf]);
    expect(inheritedTags(leaf, byId)).toEqual([
      { tagId: 'urgent', fromItemId: middle.id },
      { tagId: 'work', fromItemId: top.id },
    ]);
    expect(effectiveTagIds(leaf, byId)).toEqual(['urgent', 'work']);
  });

  it('keeps the own tags first and does not repeat a tag', () => {
    const top = make('Top', { tagIds: ['work', 'urgent'] });
    const child = make('Child', { parentId: top.id, tagIds: ['urgent', 'home'] });
    const byId = indexById([top, child]);
    expect(effectiveTagIds(child, byId)).toEqual(['urgent', 'home', 'work']);
    expect(inheritedTags(child, byId)).toEqual([{ tagId: 'work', fromItemId: top.id }]);
  });

  it('stops at an item whose switch is off', () => {
    const top = make('Top', { tagIds: ['work'] });
    const off = make('Off', { parentId: top.id, inheritTags: false, tagIds: ['home'] });
    const leaf = make('Leaf', { parentId: off.id });
    const byId = indexById([top, off, leaf]);
    expect(effectiveTagIds(off, byId)).toEqual(['home']);
    expect(effectiveTagIds(leaf, byId)).toEqual(['home']);
  });

  it('a top item, a missing parent and a deleted parent inherit nothing', () => {
    const top = make('Top', { tagIds: ['work'] });
    const orphan = make('Orphan', { parentId: 'gone' });
    const child = make('Child', { parentId: top.id });
    expect(effectiveTagIds(top, indexById([top]))).toEqual(['work']);
    expect(inheritedTags(orphan, indexById([orphan]))).toEqual([]);
    expect(inheritedTags(child, indexById([softDelete(top, ctx), child]))).toEqual([]);
  });

  it('does not loop on corrupted data', () => {
    const a = make('A', { tagIds: ['x'] });
    const b = make('B', { parentId: a.id });
    const looped = { ...a, parentId: b.id };
    expect(effectiveTagIds(b, indexById([looped, b]))).toEqual(['x']);
  });
});
