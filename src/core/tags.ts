import { isActive, updateEntity, defaultContext, type Context } from './entities';
import { childrenIndex, indexById, pathFromRoot } from './tree';
import type { Id, Item, Tag } from './types';

/*
 * Tag scope. A tag with no agendas is global. A tag with agendas is restricted to them.
 * A child can only be equal or narrower than its parent, never wider.
 * In the functions below, a scope of null means global.
 */

type Scope = Id[] | null;

function intersect(a: readonly Id[], b: readonly Id[]): Id[] {
  const allowed = new Set(b);
  return a.filter((id) => allowed.has(id));
}

/** The agendas where a tag is valid, taking the whole chain of parents into account. */
export function effectiveScope(tagId: Id, byId: ReadonlyMap<Id, Tag>): Scope {
  let scope: Scope = null;
  for (const tag of pathFromRoot(tagId, byId)) {
    if (tag.agendaIds.length === 0) continue;
    if (scope === null) {
      scope = [...tag.agendaIds];
    } else {
      const narrowed = intersect(scope, tag.agendaIds);
      // A scope that shares nothing with the parent's falls back to the parent's
      scope = narrowed.length > 0 ? narrowed : scope;
    }
  }
  return scope;
}

export function isTagValidInAgenda(tagId: Id, agendaId: Id, byId: ReadonlyMap<Id, Tag>): boolean {
  const scope = effectiveScope(tagId, byId);
  return scope === null || scope.includes(agendaId);
}

export interface ScopeChange {
  tagId: Id;
  before: Id[];
  after: Id[];
}

/**
 * Makes every child fit inside its parent's scope. Call it after restricting a tag.
 * Returns the corrected tags (only the ones that changed) and what changed, so the interface
 * can show a notice. A child that is global under a restricted parent takes the parent's scope.
 */
export function normalizeTagScopes(
  tags: readonly Tag[],
  ctx: Context = defaultContext,
): { changed: Tag[]; changes: ScopeChange[] } {
  const active = tags.filter(isActive);
  const byId = indexById(active);
  const depth = (tag: Tag) => pathFromRoot(tag.id, byId).length;
  const ordered = [...active].sort((a, b) => depth(a) - depth(b));

  const effective = new Map<Id, Scope>();
  const changed: Tag[] = [];
  const changes: ScopeChange[] = [];

  for (const tag of ordered) {
    const parentScope: Scope = tag.parentId === null ? null : (effective.get(tag.parentId) ?? null);
    let own = tag.agendaIds;

    if (parentScope !== null) {
      const narrowed = intersect(tag.agendaIds, parentScope);
      own = tag.agendaIds.length > 0 && narrowed.length > 0 ? narrowed : [...parentScope];
    }

    effective.set(tag.id, own.length > 0 ? own : null);
    const same =
      own.length === tag.agendaIds.length && own.every((id, i) => id === tag.agendaIds[i]);
    if (!same) {
      changed.push(updateEntity(tag, { agendaIds: own }, ctx));
      changes.push({ tagId: tag.id, before: tag.agendaIds, after: own });
    }
  }

  return { changed, changes };
}

/** Tags offered when editing an item of that agenda: global ones plus the ones restricted to it. */
export function tagsForAgenda(tags: readonly Tag[], agendaId: Id): Tag[] {
  const active = tags.filter(isActive);
  const byId = indexById(active);
  return active.filter((tag) => isTagValidInAgenda(tag.id, agendaId, byId));
}

export interface FilterTag {
  tag: Tag;
  /** True when the tag exists in only part of the selected agendas. */
  partial: boolean;
}

/** Tags offered in a filter: valid in at least one selected agenda, flagging the partial ones. */
export function tagsForFilter(tags: readonly Tag[], agendaIds: readonly Id[]): FilterTag[] {
  const active = tags.filter(isActive);
  const byId = indexById(active);
  const result: FilterTag[] = [];

  for (const tag of active) {
    const valid = agendaIds.filter((agendaId) => isTagValidInAgenda(tag.id, agendaId, byId));
    if (valid.length === 0) continue;
    result.push({ tag, partial: valid.length < agendaIds.length });
  }
  return result;
}

/** Filtering by a parent includes all its descendants. Filtering by a leaf includes only itself. */
export function tagWithDescendantIds(tagId: Id, tags: readonly Tag[]): Set<Id> {
  const children = childrenIndex(tags);
  const found = new Set<Id>([tagId]);
  const stack = [tagId];
  while (stack.length > 0) {
    for (const child of children.get(stack.pop()!) ?? []) {
      if (found.has(child.id)) continue;
      found.add(child.id);
      stack.push(child.id);
    }
  }
  return found;
}

/** The tags of an item that are not valid in the agenda it is about to move to. */
export function tagsLostByMoving(
  tagIds: readonly Id[],
  targetAgendaId: Id,
  tags: readonly Tag[],
): Tag[] {
  const byId = indexById(tags.filter(isActive));
  return tagIds
    .map((id) => byId.get(id))
    .filter(
      (tag): tag is Tag => tag !== undefined && !isTagValidInAgenda(tag.id, targetAgendaId, byId),
    );
}

/** A restricted tag that covers every agenda could be global, so the interface can offer it. */
export function shouldOfferGlobal(
  tag: Tag,
  tags: readonly Tag[],
  allAgendaIds: readonly Id[],
): boolean {
  if (allAgendaIds.length === 0 || tag.agendaIds.length === 0) return false;
  const covers = allAgendaIds.every((id) => tag.agendaIds.includes(id));
  if (!covers) return false;
  const parent =
    tag.parentId === null ? undefined : indexById(tags.filter(isActive)).get(tag.parentId);
  // Under a restricted parent, the tag cannot become wider than the parent
  return (
    parent === undefined || effectiveScope(parent.id, indexById(tags.filter(isActive))) === null
  );
}

/** A tag an item gets from an ancestor, and which ancestor it comes from. */
export interface InheritedTag {
  tagId: Id;
  fromItemId: Id;
}

/**
 * The tags an item gets from its ancestors. Analogy: a child folder that follows the label of the
 * folder it sits in. The item looks at its parent only while its own `inheritTags` is on, then the
 * parent looks at the grandparent only while the parent's `inheritTags` is on, and so on. A parent
 * that is missing or deleted ends the climb. Tags the item already has itself are not repeated.
 * `byId` indexes the items that exist (see `indexById`).
 */
export function inheritedTags(item: Item, byId: ReadonlyMap<Id, Item>): InheritedTag[] {
  const own = new Set(item.tagIds);
  const seenTags = new Set<Id>();
  const seenItems = new Set<Id>([item.id]);
  const result: InheritedTag[] = [];
  let current = item;

  while (current.inheritTags && current.parentId !== null) {
    const parent = byId.get(current.parentId);
    // The visited set also protects against a loop in corrupted data
    if (parent === undefined || !isActive(parent) || seenItems.has(parent.id)) break;
    seenItems.add(parent.id);
    for (const tagId of parent.tagIds) {
      if (own.has(tagId) || seenTags.has(tagId)) continue;
      seenTags.add(tagId);
      result.push({ tagId, fromItemId: parent.id });
    }
    current = parent;
  }
  return result;
}

/** The item's own tags plus the inherited ones, own first, without repeats. */
export function effectiveTagIds(item: Item, byId: ReadonlyMap<Id, Item>): Id[] {
  return [...new Set(item.tagIds), ...inheritedTags(item, byId).map((entry) => entry.tagId)];
}
