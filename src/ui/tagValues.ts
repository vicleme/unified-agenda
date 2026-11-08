import { isActive, tagWithDescendantIds, type Id, type Tag } from '../core';

export interface TagRow {
  tag: Tag;
  /** 0 for a top-level tag. */
  depth: number;
}

/**
 * The tag tree as a flat list in reading order: each tag followed by its sub-tags, siblings sorted
 * by name. A tag whose parent is missing or deleted is shown at the top level, so nothing is lost.
 * Safe on data that has a loop.
 */
export function flattenTagTree(tags: readonly Tag[], locale: string): TagRow[] {
  const active = tags.filter(isActive);
  const ids = new Set(active.map((tag) => tag.id));
  const byParent = new Map<Id | null, Tag[]>();
  for (const tag of active) {
    const key = tag.parentId !== null && ids.has(tag.parentId) ? tag.parentId : null;
    const list = byParent.get(key);
    if (list) list.push(tag);
    else byParent.set(key, [tag]);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, locale) || (a.id < b.id ? -1 : 1));
  }

  const rows: TagRow[] = [];
  const seen = new Set<Id>();
  const visit = (parent: Id | null, depth: number) => {
    for (const tag of byParent.get(parent) ?? []) {
      if (seen.has(tag.id)) continue;
      seen.add(tag.id);
      rows.push({ tag, depth });
      visit(tag.id, depth + 1);
    }
  };
  visit(null, 0);
  return rows;
}

/** The tags a tag can be moved under: not itself and not anything inside it (that would be a loop). */
export function possibleParents(tag: Tag | null, tags: readonly Tag[]): Tag[] {
  const active = tags.filter(isActive);
  if (tag === null) return active;
  const blocked = tagWithDescendantIds(tag.id, active);
  return active.filter((candidate) => !blocked.has(candidate.id));
}
