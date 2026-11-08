import {
  effectiveTagIds,
  indexById,
  isActive,
  tagWithDescendantIds,
  type Id,
  type Item,
  type Tag,
} from '../core';
import { containsAllWords, searchWords } from './text';
import type { ItemFilter } from './types';

/**
 * The tags a filter really uses: the selected ones that still exist (deleted or unknown tags are
 * dropped, so deleting a tag never leaves a filter that matches nothing), each with its
 * descendants. Null means the tag sieve is off.
 */
export function expandedTagIds(filter: ItemFilter, tags: readonly Tag[]): Set<Id> | null {
  const active = tags.filter(isActive);
  const byId = indexById(active);
  const selected = filter.tagIds.filter((id) => byId.has(id));
  if (selected.length === 0) return null;
  const result = new Set<Id>();
  for (const id of selected) {
    for (const found of tagWithDescendantIds(id, active)) result.add(found);
  }
  return result;
}

/**
 * A function that says whether one item passes the tag, kind and text sieves. The periods and the
 * "due within" limit depend on the day, so they live in `applyDayFilters`.
 * Build it once and reuse it for every item.
 *
 * `items` is every item the parents can be found in, because an item also counts as having the
 * tags it inherits from its parent (`inheritTags`). Without it, only the item's own tags count.
 */
export function createItemMatcher(
  filter: ItemFilter,
  tags: readonly Tag[],
  items: readonly Item[] = [],
): (item: Item) => boolean {
  const tagIds = expandedTagIds(filter, tags);
  const byId = indexById(items.filter(isActive));
  const kinds = new Set(filter.kinds);
  const words = searchWords(filter.text);

  return (item) => {
    if (kinds.size > 0 && !kinds.has(item.kind)) return false;
    if (tagIds !== null && !effectiveTagIds(item, byId).some((id) => tagIds.has(id))) return false;
    if (words.length > 0) {
      return containsAllWords(`${item.title} ${item.notes} ${item.location}`, words);
    }
    return true;
  };
}

/**
 * The items that pass the tag, kind and text sieves, in the same order. Inherited tags are found
 * among `items`, so pass the whole list, not one already narrowed.
 */
export function filterItems(
  items: readonly Item[],
  filter: ItemFilter,
  tags: readonly Tag[],
): Item[] {
  const matches = createItemMatcher(filter, tags, items);
  return items.filter(matches);
}
