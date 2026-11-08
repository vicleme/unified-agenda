import { isActive } from './entities';
import { comparePlainDates } from './plainDate';
import { timestampToMs } from './schedule';
import { localDate } from './zone';
import type { Due, Id, Item, PlainDate, Timestamp } from './types';

/*
 * The window of a task: the days when it counts as pending.
 * Analogy: a teacher hands out an assignment on the 3rd and it is due on the 24th. From the 3rd
 * to the 24th it sits on your desk, so you should see it on every one of those days, and not
 * only on the day you hand it in.
 */

export interface TaskWindow {
  /** First day the task is pending. */
  from: PlainDate;
  /** Last day, which is the delivery day. */
  due: PlainDate;
}

/**
 * The calendar day of a delivery. A whole-day delivery is that date. A timed delivery is the
 * day it falls on in the display zone, so it sits on the same day as everything else on screen.
 */
export function dueDate(due: Due, displayTimeZone: string): PlainDate {
  return due.allDay ? due.date : localDate(timestampToMs(due.at), displayTimeZone);
}

/**
 * The window of a task, or null for an item with no delivery (events and tasks in the inbox).
 * Without a start, the window begins on the day the task was created. A task created after its
 * own delivery day gets a window of just that one day, so it is not hidden.
 */
export function taskWindow(item: Item, displayTimeZone: string): TaskWindow | null {
  if (item.kind !== 'task' || item.due === null) return null;
  const due = dueDate(item.due, displayTimeZone);
  if (item.from !== null) return { from: item.from, due };

  const created = localDate(timestampToMs(item.createdAt), displayTimeZone);
  return { from: comparePlainDates(created, due) < 0 ? created : due, due };
}

/** Whether a calendar day falls inside the window of the task, both ends included. */
export function isInWindow(item: Item, date: PlainDate, displayTimeZone: string): boolean {
  const window = taskWindow(item, displayTimeZone);
  if (!window) return false;
  return comparePlainDates(date, window.from) >= 0 && comparePlainDates(date, window.due) <= 0;
}

/** Whether the delivery time has passed. A whole-day delivery passes when its day is over. */
export function isPastDue(due: Due, now: Timestamp, displayTimeZone: string): boolean {
  const nowMs = timestampToMs(now);
  if (!due.allDay) return nowMs > timestampToMs(due.at);
  return comparePlainDates(localDate(nowMs, displayTimeZone), due.date) > 0;
}

/**
 * The tasks that are pending on one day: inside their window and not done. Deleted items are
 * ignored. A task whose delivery day has passed is not here, it belongs to the overdue strip.
 */
export function pendingOnDate(
  items: readonly Item[],
  date: PlainDate,
  displayTimeZone: string,
  doneIds: ReadonlySet<Id>,
): Item[] {
  return items.filter(
    (item) =>
      isActive(item) &&
      !(item.statusId !== null && doneIds.has(item.statusId)) &&
      isInWindow(item, date, displayTimeZone),
  );
}

/** The tasks whose delivery has passed and that are not done, oldest delivery first. */
export function overdueTasks(
  items: readonly Item[],
  now: Timestamp,
  displayTimeZone: string,
  doneIds: ReadonlySet<Id>,
): Item[] {
  const late = items.filter(
    (item) =>
      isActive(item) &&
      item.kind === 'task' &&
      item.due !== null &&
      !(item.statusId !== null && doneIds.has(item.statusId)) &&
      isPastDue(item.due, now, displayTimeZone),
  );
  const key = (item: Item) => dueDate(item.due!, displayTimeZone);
  return late.sort((a, b) => comparePlainDates(key(a), key(b)) || (a.id < b.id ? -1 : 1));
}

/**
 * The work blocks of a task: timed events placed directly under it, in time order. A work block
 * is time reserved to take care of the task. It is an ordinary event, so it shows in the calendar
 * and the timeline at its own hour, and it never changes the progress of the task.
 */
export function workBlocks(task: Item, items: readonly Item[]): Item[] {
  return items
    .filter(
      (item) =>
        isActive(item) &&
        item.parentId === task.id &&
        item.kind === 'event' &&
        item.schedule !== null &&
        !item.schedule.allDay,
    )
    .sort((a, b) => {
      const aMs = timestampToMs((a.schedule as { start: Timestamp }).start);
      const bMs = timestampToMs((b.schedule as { start: Timestamp }).start);
      return aMs - bMs || (a.id < b.id ? -1 : 1);
    });
}
