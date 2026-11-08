import {
  createAgenda,
  createAgendaGroup,
  createItem,
  createSavedView,
  createTag,
  isActive,
} from '../../src/core';
import {
  countAgendaItems,
  countItemSubtree,
  countTagUsage,
  removeAgendaCascade,
  removeItemCascade,
  removeTagCascade,
} from '../../src/storage';
import { fill, openTestDb, sampleData } from './helpers';

async function withDeeperItem() {
  const db = openTestDb();
  const data = sampleData();
  await fill(db, data);
  const deeper = createItem({
    kind: 'event',
    title: 'Deeper',
    agendaId: data.agenda.id,
    parentId: data.block.id,
  });
  await db.items.put(deeper);
  return { db, data, deeper };
}

describe('removeItemCascade', () => {
  it('marks the item and every descendant as deleted, and nothing else', async () => {
    const { db, data } = await withDeeperItem();
    const sibling = createItem({ kind: 'task', title: 'Other', agendaId: data.agenda.id });
    await db.items.put(sibling);

    const result = await removeItemCascade(db, data.task.id);

    expect(result).toEqual({ removed: true, items: 3 });
    const items = await db.items.toArray();
    expect(
      items
        .filter((item) => !isActive(item))
        .map((item) => item.title)
        .sort(),
    ).toEqual(['Deeper', 'Paper', 'Work on paper']);
    expect(isActive((await db.items.get(sibling.id))!)).toBe(true);
    expect(isActive((await db.agendas.get(data.agenda.id))!)).toBe(true);
  });

  it('keeps the parent when only a child is removed', async () => {
    const { db, data } = await withDeeperItem();
    const result = await removeItemCascade(db, data.block.id);
    expect(result.items).toBe(2);
    expect(isActive((await db.items.get(data.task.id))!)).toBe(true);
  });

  it('does nothing for an unknown or already deleted item', async () => {
    const { db, data } = await withDeeperItem();
    expect(await removeItemCascade(db, 'nope')).toEqual({ removed: false, items: 0 });
    await removeItemCascade(db, data.task.id);
    expect(await removeItemCascade(db, data.task.id)).toEqual({ removed: false, items: 0 });
  });

  it('counts what a removal would affect before doing it', async () => {
    const { db, data } = await withDeeperItem();
    expect(await countItemSubtree(db, data.task.id)).toBe(3);
    expect(await countItemSubtree(db, 'nope')).toBe(0);
  });
});

describe('removeAgendaCascade', () => {
  it('deletes the agenda and every item in it, at any depth', async () => {
    const { db, data } = await withDeeperItem();
    const result = await removeAgendaCascade(db, data.agenda.id);

    expect(result).toEqual({ removed: true, items: 3 });
    expect(isActive((await db.agendas.get(data.agenda.id))!)).toBe(false);
    expect((await db.items.toArray()).every((item) => !isActive(item))).toBe(true);
  });

  it('leaves other agendas and their items alone', async () => {
    const { db, data } = await withDeeperItem();
    const other = createAgenda({ name: 'Home', color: '#2f9e44' });
    const chore = createItem({ kind: 'task', title: 'Chore', agendaId: other.id });
    await db.agendas.put(other);
    await db.items.put(chore);

    await removeAgendaCascade(db, data.agenda.id);

    expect(isActive((await db.agendas.get(other.id))!)).toBe(true);
    expect(isActive((await db.items.get(chore.id))!)).toBe(true);
  });

  it('takes the agenda out of the groups that list it', async () => {
    const { db, data } = await withDeeperItem();
    const other = createAgenda({ name: 'Home', color: '#2f9e44' });
    const group = createAgendaGroup({ name: 'All', agendaIds: [data.agenda.id, other.id] });
    await db.agendas.put(other);
    await db.agendaGroups.put(group);

    await removeAgendaCascade(db, data.agenda.id);

    expect((await db.agendaGroups.get(group.id))!.agendaIds).toEqual([other.id]);
  });

  it('keeps the tombstones, so the deletion can sync later', async () => {
    const { db, data } = await withDeeperItem();
    await removeAgendaCascade(db, data.agenda.id);
    expect(await db.items.count()).toBe(3);
    expect((await db.agendas.get(data.agenda.id))!.deletedAt).not.toBeNull();
  });

  it('does nothing for an unknown or already deleted agenda', async () => {
    const { db, data } = await withDeeperItem();
    expect(await removeAgendaCascade(db, 'nope')).toEqual({ removed: false, items: 0 });
    await removeAgendaCascade(db, data.agenda.id);
    expect(await removeAgendaCascade(db, data.agenda.id)).toEqual({ removed: false, items: 0 });
  });

  it('counts what a removal would affect before doing it', async () => {
    const { db, data } = await withDeeperItem();
    expect(await countAgendaItems(db, data.agenda.id)).toBe(3);
    expect(await countAgendaItems(db, 'nope')).toBe(0);
  });
});

describe('removeTagCascade', () => {
  async function setup() {
    const db = openTestDb();
    const parent = createTag({ name: 'Work', color: '#3b5bdb' });
    const child = createTag({ name: 'Reports', color: '#3b5bdb', parentId: parent.id });
    const other = createTag({ name: 'Home', color: '#3b5bdb' });
    await db.tags.bulkPut([parent, child, other]);
    const base = { kind: 'task', agendaId: 'a', statusId: 's' } as const;
    const a = createItem({ ...base, title: 'A', tagIds: [child.id, other.id] });
    const b = createItem({ ...base, title: 'B', tagIds: [parent.id] });
    const c = createItem({ ...base, title: 'C', tagIds: [other.id] });
    await db.items.bulkPut([a, b, c]);
    return { db, parent, child, other, a, b, c };
  }

  it('counts the sub-tags and the items that carry the tag or a sub-tag', async () => {
    const { db, parent, other } = await setup();
    expect(await countTagUsage(db, parent.id)).toEqual({ subTags: 1, items: 2 });
    expect(await countTagUsage(db, other.id)).toEqual({ subTags: 0, items: 2 });
    expect(await countTagUsage(db, 'nope')).toEqual({ subTags: 0, items: 0 });
  });

  it('deletes the tag and its sub-tags and takes them off the items, which stay', async () => {
    const { db, parent, child, other, a, b, c } = await setup();
    expect(await removeTagCascade(db, parent.id)).toEqual({ removed: true, subTags: 1, items: 2 });

    const tags = await db.tags.toArray();
    expect(tags.filter(isActive).map((tag) => tag.id)).toEqual([other.id]);
    expect(tags.find((tag) => tag.id === child.id)?.deletedAt).not.toBeNull();

    const items = new Map((await db.items.toArray()).map((item) => [item.id, item]));
    expect(items.get(a.id)?.tagIds).toEqual([other.id]);
    expect(items.get(b.id)?.tagIds).toEqual([]);
    expect(items.get(b.id)?.deletedAt).toBeNull();
    // An item that did not carry the tag is left exactly as it was
    expect(items.get(c.id)).toEqual(c);
  });

  it('does nothing for an unknown or already deleted tag', async () => {
    const { db, parent } = await setup();
    await removeTagCascade(db, parent.id);
    expect(await removeTagCascade(db, parent.id)).toEqual({ removed: false, subTags: 0, items: 0 });
    expect(await removeTagCascade(db, 'nope')).toEqual({ removed: false, subTags: 0, items: 0 });
  });
});

describe('saved views when something they mention is deleted', () => {
  async function withViews() {
    const db = openTestDb();
    const data = sampleData();
    await fill(db, data);
    const other = createAgenda({ name: 'Other', color: '#000000' });
    await db.agendas.put(other);
    const both = createSavedView({ name: 'Both', agendaIds: [data.agenda.id, other.id] });
    const only = createSavedView({ name: 'Only', agendaIds: [data.agenda.id] });
    const everything = createSavedView({ name: 'Everything', agendaIds: null });
    const nothing = createSavedView({ name: 'Nothing', agendaIds: [] });
    await db.savedViews.bulkPut([both, only, everything, nothing]);
    return { db, data, other, both, only, everything, nothing };
  }
  const byName = async (db: Awaited<ReturnType<typeof withViews>>['db'], name: string) =>
    (await db.savedViews.toArray()).find((view) => view.name === name)!;

  it('takes a deleted agenda out of the views that list it', async () => {
    const { db, data, other, both } = await withViews();
    await removeAgendaCascade(db, data.agenda.id);
    const after = await byName(db, 'Both');
    expect(after.agendaIds).toEqual([other.id]);
    expect(after.updatedAt >= both.updatedAt).toBe(true);
  });

  it('sends a view that listed only that agenda back to every agenda', async () => {
    const { db, data } = await withViews();
    await removeAgendaCascade(db, data.agenda.id);
    expect((await byName(db, 'Only')).agendaIds).toBeNull();
  });

  it('leaves alone the views that do not list it, including "all" and "nothing"', async () => {
    const { db, other, everything, nothing } = await withViews();
    await removeAgendaCascade(db, other.id);
    expect(await byName(db, 'Everything')).toEqual(everything);
    expect(await byName(db, 'Nothing')).toEqual(nothing);
    expect(await byName(db, 'Only')).toMatchObject({ agendaIds: expect.any(Array) });
  });

  it('does not touch a view that was already deleted', async () => {
    const { db, data, only } = await withViews();
    await db.savedViews.put({ ...only, deletedAt: '2026-11-01T00:00:00.000Z' });
    await removeAgendaCascade(db, data.agenda.id);
    expect((await byName(db, 'Only')).agendaIds).toEqual([data.agenda.id]);
  });

  it('is not affected by deleting an agenda group, which views never mention', async () => {
    const { db, data } = await withViews();
    const group = createAgendaGroup({ name: 'G', agendaIds: [data.agenda.id] });
    await db.agendaGroups.put(group);
    const before = await db.savedViews.toArray();
    await db.agendaGroups.put({ ...group, deletedAt: '2026-11-01T00:00:00.000Z' });
    expect(await db.savedViews.toArray()).toEqual(before);
  });

  it('takes deleted tags out of the filter of a view, keeping the rest of the filter', async () => {
    const { db, data } = await withViews();
    const keep = createTag({ name: 'Keep', color: '#000000' });
    await db.tags.put(keep);
    const view = createSavedView({
      name: 'Tagged',
      filter: {
        tagIds: [data.tag.id, keep.id],
        kinds: ['task'],
        periods: ['morning'],
        text: 'paper',
        dueWithinDays: 2,
      },
    });
    await db.savedViews.put(view);

    await removeTagCascade(db, data.tag.id);
    const after = await byName(db, 'Tagged');
    expect(after.filter).toEqual({ ...view.filter, tagIds: [keep.id] });

    await removeTagCascade(db, keep.id);
    expect((await byName(db, 'Tagged')).filter.tagIds).toEqual([]);
    expect(await byName(db, 'Everything')).toMatchObject({ filter: { tagIds: [] } });
  });
});
