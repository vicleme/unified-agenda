import {
  defaultContext,
  descendantIds,
  isActive,
  softDelete,
  tagWithDescendantIds,
  updateEntity,
  type Context,
  type Id,
  type Item,
  type Tag,
} from '../core';
import type { AgendaDatabase } from './db';

/*
 * Deleting an agenda or an item also deletes what lives inside it. Everything is only marked
 * with `deletedAt` (a tombstone), in one transaction, so a failure never leaves half a tree.
 */

export interface RemovalResult {
  /** False when the id does not exist or was already deleted. Nothing changed then. */
  removed: boolean;
  /** How many items were marked as deleted, the item itself included. */
  items: number;
}

const NOTHING: RemovalResult = { removed: false, items: 0 };

async function activeItems(db: AgendaDatabase): Promise<Item[]> {
  return (await db.items.toArray()).filter(isActive);
}

/** The given roots plus everything below them, at any depth. */
function withDescendants(rootIds: Iterable<Id>, items: readonly Item[]): Set<Id> {
  const ids = new Set<Id>();
  for (const root of rootIds) {
    ids.add(root);
    for (const id of descendantIds(root, items)) ids.add(id);
  }
  return ids;
}

function agendaItemIds(agendaId: Id, items: readonly Item[]): Set<Id> {
  const roots = items.filter((item) => item.agendaId === agendaId).map((item) => item.id);
  return withDescendants(roots, items);
}

function subtreeIds(itemId: Id, items: readonly Item[]): Set<Id> {
  return items.some((item) => item.id === itemId) ? withDescendants([itemId], items) : new Set();
}

/** How many items deleting this agenda would delete. For the confirmation message. */
export async function countAgendaItems(db: AgendaDatabase, agendaId: Id): Promise<number> {
  return agendaItemIds(agendaId, await activeItems(db)).size;
}

/** How many items deleting this item would delete, itself included. */
export async function countItemSubtree(db: AgendaDatabase, itemId: Id): Promise<number> {
  return subtreeIds(itemId, await activeItems(db)).size;
}

/** Deletes an item and all its sub-items and work blocks. */
export function removeItemCascade(
  db: AgendaDatabase,
  itemId: Id,
  ctx: Context = defaultContext,
): Promise<RemovalResult> {
  return db.transaction('rw', db.items, async () => {
    const items = await activeItems(db);
    const ids = subtreeIds(itemId, items);
    if (ids.size === 0) return NOTHING;
    await db.items.bulkPut(items.filter((item) => ids.has(item.id)).map((i) => softDelete(i, ctx)));
    return { removed: true, items: ids.size };
  });
}

/**
 * Deletes an agenda, every item in it, and takes it out of the agenda groups and the saved views
 * that list it. A view that listed only this agenda goes back to showing every agenda, which is
 * what the selection already did when all its agendas were gone.
 */
export function removeAgendaCascade(
  db: AgendaDatabase,
  agendaId: Id,
  ctx: Context = defaultContext,
): Promise<RemovalResult> {
  return db.transaction('rw', db.agendas, db.agendaGroups, db.items, db.savedViews, async () => {
    const agenda = await db.agendas.get(agendaId);
    if (!agenda || !isActive(agenda)) return NOTHING;

    const items = await activeItems(db);
    const ids = agendaItemIds(agendaId, items);
    await db.items.bulkPut(items.filter((item) => ids.has(item.id)).map((i) => softDelete(i, ctx)));

    const groups = (await db.agendaGroups.toArray()).filter(
      (group) => isActive(group) && group.agendaIds.includes(agendaId),
    );
    await db.agendaGroups.bulkPut(
      groups.map((group) =>
        updateEntity(group, { agendaIds: group.agendaIds.filter((id) => id !== agendaId) }, ctx),
      ),
    );

    const views = (await db.savedViews.toArray()).filter(
      (view) => isActive(view) && view.agendaIds?.includes(agendaId),
    );
    await db.savedViews.bulkPut(
      views.map((view) => {
        const left = view.agendaIds!.filter((id) => id !== agendaId);
        return updateEntity(view, { agendaIds: left.length > 0 ? left : null }, ctx);
      }),
    );

    await db.agendas.put(softDelete(agenda, ctx));
    return { removed: true, items: ids.size };
  });
}

export interface TagUsage {
  /** Sub-tags (at any depth) that would be deleted with the tag. The tag itself is not counted. */
  subTags: number;
  /** Active items that carry the tag or any of its sub-tags. */
  items: number;
}

async function activeTags(db: AgendaDatabase): Promise<Tag[]> {
  return (await db.tags.toArray()).filter(isActive);
}

/** What deleting this tag would touch. For the confirmation message. */
export async function countTagUsage(db: AgendaDatabase, tagId: Id): Promise<TagUsage> {
  const tags = await activeTags(db);
  if (!tags.some((tag) => tag.id === tagId)) return { subTags: 0, items: 0 };
  const ids = tagWithDescendantIds(tagId, tags);
  const items = (await activeItems(db)).filter((item) => item.tagIds.some((id) => ids.has(id)));
  return { subTags: ids.size - 1, items: items.length };
}

/**
 * Deletes a tag and its sub-tags, and takes them off every item and saved view that carried them.
 * The items and views stay. Only the ones that changed get a new `updatedAt`. All in one
 * transaction.
 */
export function removeTagCascade(
  db: AgendaDatabase,
  tagId: Id,
  ctx: Context = defaultContext,
): Promise<{ removed: boolean; subTags: number; items: number }> {
  return db.transaction('rw', db.tags, db.items, db.savedViews, async () => {
    const tags = await activeTags(db);
    if (!tags.some((tag) => tag.id === tagId)) return { removed: false, subTags: 0, items: 0 };

    const ids = tagWithDescendantIds(tagId, tags);
    await db.tags.bulkPut(tags.filter((tag) => ids.has(tag.id)).map((tag) => softDelete(tag, ctx)));

    const touched = (await activeItems(db)).filter((item) => item.tagIds.some((id) => ids.has(id)));
    await db.items.bulkPut(
      touched.map((item) =>
        updateEntity(item, { tagIds: item.tagIds.filter((id) => !ids.has(id)) }, ctx),
      ),
    );

    const views = (await db.savedViews.toArray()).filter(
      (view) => isActive(view) && view.filter.tagIds.some((id) => ids.has(id)),
    );
    await db.savedViews.bulkPut(
      views.map((view) =>
        updateEntity(
          view,
          { filter: { ...view.filter, tagIds: view.filter.tagIds.filter((id) => !ids.has(id)) } },
          ctx,
        ),
      ),
    );
    return { removed: true, subTags: ids.size - 1, items: touched.length };
  });
}
