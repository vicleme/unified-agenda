import { isActive } from './entities';
import { addDays, comparePlainDates, daysBetween } from './plainDate';
import { timestampToMs } from './schedule';
import { dueDate, overdueTasks, pendingOnDate } from './window';
import { startOfDayMs } from './zone';
import type { Id, Item, PlainDate, Timestamp } from './types';

/*
 * What the Timeline shows for one day. Analogy: each day is a page of a paper planner. The top of
 * the page has a strip for what is open on your desk (tasks inside their window), then the items
 * that happen that day: whole-day ones first, then the ones with a time, in time order. An item
 * that spans several days is written on every page it touches, with a "continues" mark on the
 * pages where it did not start or does not end.
 *
 * Days are cut in the display time zone, so a day can have 23 or 25 hours.
 */

export interface TimelineEntry {
  item: Item;
  /** Whole-day items have no hour. Timed ones are placed by hour. */
  type: 'allDay' | 'timed';
  /** The item started on an earlier day, so this page shows a "continues from" mark. */
  continuesFromPrevious: boolean;
  /** The item goes on after this day, so this page shows a "continues on" mark. */
  continuesToNext: boolean;
  /** Timed items only: the part of the item inside this day, as instants in milliseconds. */
  startMs: number | null;
  endMs: number | null;
}

export interface OpenTask {
  item: Item;
  /** The day of the delivery, to highlight it. */
  dueDate: PlainDate;
  isDueDay: boolean;
}

export interface TimelineDay {
  date: PlainDate;
  /** Whole-day events and work blocks. */
  allDay: TimelineEntry[];
  /** Timed events and work blocks, in time order. */
  timed: TimelineEntry[];
  /** Tasks pending on this day (inside their window, not done), the delivery day first. */
  open: OpenTask[];
  /** True when there is nothing at all, so the view can fold the day. */
  empty: boolean;
}

export interface OverdueEntry {
  item: Item;
  dueDate: PlainDate;
  /**
   * Whole days between the delivery day and the reference day. Zero means the delivery was today
   * and its time already passed (late today), so only timed deliveries can have a zero.
   */
  daysLate: number;
}

const byTitle = (a: Item, b: Item) =>
  a.title.localeCompare(b.title) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Events that can sit on a day: not deleted, with a schedule. Tasks never use `schedule`. */
function scheduledEvents(items: readonly Item[]): Item[] {
  return items.filter((item) => isActive(item) && item.kind === 'event' && item.schedule !== null);
}

function entryForDay(
  item: Item,
  date: PlainDate,
  dayStart: number,
  dayEnd: number,
): TimelineEntry | null {
  const schedule = item.schedule!;

  if (schedule.allDay) {
    const last = schedule.end ?? schedule.start;
    if (comparePlainDates(date, schedule.start) < 0 || comparePlainDates(date, last) > 0) {
      return null;
    }
    return {
      item,
      type: 'allDay',
      continuesFromPrevious: comparePlainDates(schedule.start, date) < 0,
      continuesToNext: comparePlainDates(last, date) > 0,
      startMs: null,
      endMs: null,
    };
  }

  const start = timestampToMs(schedule.start);
  const end = schedule.end === undefined ? start : timestampToMs(schedule.end);
  const isPoint = end <= start;

  // An item with no length belongs to the day of its start. One with a length touches the day
  // when it overlaps it. Ending exactly at midnight does not reach the next day.
  const touches = isPoint ? start >= dayStart && start < dayEnd : start < dayEnd && end > dayStart;
  if (!touches) return null;

  return {
    item,
    type: 'timed',
    continuesFromPrevious: start < dayStart,
    continuesToNext: !isPoint && end > dayEnd,
    startMs: Math.max(start, dayStart),
    endMs: isPoint ? start : Math.min(end, dayEnd),
  };
}

function buildDay(
  events: readonly Item[],
  allItems: readonly Item[],
  date: PlainDate,
  displayTimeZone: string,
  doneIds: ReadonlySet<Id>,
): TimelineDay {
  const dayStart = startOfDayMs(date, displayTimeZone);
  const dayEnd = startOfDayMs(addDays(date, 1), displayTimeZone);

  const entries = events
    .map((item) => entryForDay(item, date, dayStart, dayEnd))
    .filter((entry): entry is TimelineEntry => entry !== null);

  const allDay = entries
    .filter((entry) => entry.type === 'allDay')
    .sort(
      (a, b) =>
        comparePlainDates(
          (a.item.schedule as { start: PlainDate }).start,
          (b.item.schedule as { start: PlainDate }).start,
        ) || byTitle(a.item, b.item),
    );

  const timed = entries
    .filter((entry) => entry.type === 'timed')
    .sort((a, b) => a.startMs! - b.startMs! || a.endMs! - b.endMs! || byTitle(a.item, b.item));

  const open = pendingOnDate(allItems, date, displayTimeZone, doneIds)
    .map((item) => {
      const due = dueDate(item.due!, displayTimeZone);
      return { item, dueDate: due, isDueDay: due === date };
    })
    .sort(
      (a, b) =>
        Number(b.isDueDay) - Number(a.isDueDay) ||
        comparePlainDates(a.dueDate, b.dueDate) ||
        byTitle(a.item, b.item),
    );

  return { date, allDay, timed, open, empty: entries.length === 0 && open.length === 0 };
}

/** One day of the Timeline. */
export function buildTimelineDay(
  items: readonly Item[],
  date: PlainDate,
  displayTimeZone: string,
  doneIds: ReadonlySet<Id>,
): TimelineDay {
  return buildDay(scheduledEvents(items), items, date, displayTimeZone, doneIds);
}

/** Consecutive days from `from` to `to`, both included. Empty when `to` comes before `from`. */
export function buildTimelineRange(
  items: readonly Item[],
  from: PlainDate,
  to: PlainDate,
  displayTimeZone: string,
  doneIds: ReadonlySet<Id>,
): TimelineDay[] {
  const count = daysBetween(from, to) + 1;
  if (count <= 0) return [];
  const events = scheduledEvents(items);
  return Array.from({ length: count }, (_, index) =>
    buildDay(events, items, addDays(from, index), displayTimeZone, doneIds),
  );
}

/**
 * The overdue strip: tasks whose delivery has passed and that are not done, oldest delivery
 * first, each with how many days late it is on the reference day (normally today).
 */
export function buildOverdueStrip(
  items: readonly Item[],
  now: Timestamp,
  referenceDate: PlainDate,
  displayTimeZone: string,
  doneIds: ReadonlySet<Id>,
): OverdueEntry[] {
  return overdueTasks(items, now, displayTimeZone, doneIds).map((item) => {
    const due = dueDate(item.due!, displayTimeZone);
    return { item, dueDate: due, daysLate: Math.max(0, daysBetween(due, referenceDate)) };
  });
}
