import { isActive } from './entities';
import type { Id, Item, SyncFields } from './types';

type Node = SyncFields & { parentId: Id | null };

/** The ids from the top of the tree down to the entity itself. Stops if the data has a cycle. */
export function pathFromRoot<T extends Node>(id: Id, byId: ReadonlyMap<Id, T>): T[] {
  const path: T[] = [];
  const seen = new Set<Id>();
  let current = byId.get(id);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.push(current);
    current = current.parentId === null ? undefined : byId.get(current.parentId);
  }
  return path.reverse();
}

export function indexById<T extends SyncFields>(list: readonly T[]): Map<Id, T> {
  return new Map(list.map((entity) => [entity.id, entity]));
}

/** Active children grouped by parent, each list sorted by `order` and then by id. */
export function childrenIndex<T extends Node & { order?: number }>(
  list: readonly T[],
): Map<Id, T[]> {
  const map = new Map<Id, T[]>();
  for (const entity of list) {
    if (!isActive(entity) || entity.parentId === null) continue;
    const siblings = map.get(entity.parentId);
    if (siblings) siblings.push(entity);
    else map.set(entity.parentId, [entity]);
  }
  for (const siblings of map.values()) {
    siblings.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.id < b.id ? -1 : 1));
  }
  return map;
}

/** Every active descendant of an entity, at any depth. Safe on data that has a cycle. */
export function descendantIds<T extends Node & { order?: number }>(
  rootId: Id,
  list: readonly T[],
): Set<Id> {
  const children = childrenIndex(list);
  const found = new Set<Id>();
  const stack = [rootId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const child of children.get(current) ?? []) {
      if (child.id === rootId || found.has(child.id)) continue;
      found.add(child.id);
      stack.push(child.id);
    }
  }
  return found;
}

/** Whether giving an item that parent would put the item inside its own subtree. */
export function wouldCreateCycle(
  itemId: Id,
  newParentId: Id | null,
  items: readonly Item[],
): boolean {
  if (newParentId === null) return false;
  if (newParentId === itemId) return true;
  return descendantIds(itemId, items).has(newParentId);
}
