import type { Id } from './types';

export interface OrderChange {
  id: Id;
  order: number;
}

/**
 * Moves one entry a step up (-1) or down (1) in a list that is already in display order, and
 * returns the new `order` of every entry that has to change. Analogy: two people in a queue swap
 * places, then everybody is numbered 0, 1, 2 again. Renumbering all of them also repairs lists
 * where several entries share the same `order`. Returns an empty list at either end, or for an
 * unknown id.
 */
export function moveStep<T extends { id: Id; order: number }>(
  sorted: readonly T[],
  id: Id,
  step: -1 | 1,
): OrderChange[] {
  const from = sorted.findIndex((entry) => entry.id === id);
  const to = from + step;
  if (from < 0 || to < 0 || to >= sorted.length) return [];
  const next = [...sorted];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next.flatMap((entry, index) =>
    entry.order === index ? [] : [{ id: entry.id, order: index }],
  );
}
