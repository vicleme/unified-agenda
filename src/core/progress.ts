import { isActive } from './entities';
import { childrenIndex } from './tree';
import type { Id, Item, Status, StatusGroup } from './types';

export interface Progress {
  completed: number;
  total: number;
  /** completed divided by total, from 0 to 1. */
  ratio: number;
}

/** The ids of every status that belongs to a group whose role is done. */
export function doneStatusIds(
  statuses: readonly Status[],
  groups: readonly StatusGroup[],
): Set<Id> {
  const doneGroups = new Set(
    groups.filter((g) => isActive(g) && g.role === 'done').map((g) => g.id),
  );
  return new Set(statuses.filter((s) => isActive(s) && doneGroups.has(s.groupId)).map((s) => s.id));
}

/**
 * The status a task gets when it is marked as done: the first active status (by group order, then
 * status order) of the first active group whose role is done. Null when there is none, for
 * example when the person deleted every done status.
 */
export function defaultDoneStatusId(
  statuses: readonly Status[],
  groups: readonly StatusGroup[],
): Id | null {
  const doneGroups = groups.filter((g) => isActive(g) && g.role === 'done');
  doneGroups.sort((a, b) => a.order - b.order);
  for (const group of doneGroups) {
    const inGroup = statuses.filter((s) => isActive(s) && s.groupId === group.id);
    inGroup.sort((a, b) => a.order - b.order);
    if (inGroup[0]) return inGroup[0].id;
  }
  return null;
}

/**
 * Progress for every item that has any, in one pass.
 *
 * Rules:
 * - Only tasks count. An event never adds to progress, but it can hold tasks that do.
 * - A task with counted descendants takes its progress from them and ignores its own status.
 * - A task with none is a leaf: 1 of 1 when its status is in a done group, otherwise 0 of 1.
 * - Deleted items are ignored. The result counts leaves, so 3 of 5 is 60% at any depth.
 * - Items with no task below them have no entry in the result.
 */
export function computeProgress(
  items: readonly Item[],
  doneIds: ReadonlySet<Id>,
): Map<Id, Progress> {
  const active = items.filter(isActive);
  const children = childrenIndex(active);
  const counts = new Map<Id, { completed: number; total: number }>();
  const visited = new Set<Id>();
  const result = new Map<Id, Progress>();

  // Depth first without recursion, so very deep trees cannot overflow the call stack
  for (const start of active) {
    if (visited.has(start.id)) continue;
    visited.add(start.id);
    const stack: { item: Item; next: number }[] = [{ item: start, next: 0 }];

    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      const kids = children.get(frame.item.id) ?? [];

      if (frame.next < kids.length) {
        const kid = kids[frame.next++]!;
        if (!visited.has(kid.id)) {
          visited.add(kid.id);
          stack.push({ item: kid, next: 0 });
        }
        continue;
      }

      stack.pop();
      let completed = 0;
      let total = 0;
      for (const kid of kids) {
        const kidCount = counts.get(kid.id);
        if (kidCount) {
          completed += kidCount.completed;
          total += kidCount.total;
        }
      }
      if (total === 0 && frame.item.kind === 'task') {
        total = 1;
        completed = frame.item.statusId !== null && doneIds.has(frame.item.statusId) ? 1 : 0;
      }
      counts.set(frame.item.id, { completed, total });
      if (total > 0) result.set(frame.item.id, { completed, total, ratio: completed / total });
    }
  }

  return result;
}
