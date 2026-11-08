import { msToTimestamp, type OpenTask, type TimelineEntry } from '../core';
import { formatDate, formatTime } from './format';
import type { Messages } from './i18n/messages/en';

/*
 * Texts of the Timeline rows, without React. Each function takes the language texts as a
 * parameter, so the screen and the tests use the same code.
 */

type TimelineTexts = Messages['timeline'];

/**
 * The time column of an entry. A whole-day item says so. A timed item shows its hours inside this
 * day: a range, only the start (a point in time), "From" when it goes on after midnight, "Until"
 * when it began the day before, or "Throughout the day" when it covers the whole day.
 * `rangeTemplate` has `{start}` and `{end}` (the `items.range` text), so each language writes
 * its own "to".
 */
export function entryTimeText(
  locale: string,
  entry: TimelineEntry,
  zone: string,
  texts: TimelineTexts,
  rangeTemplate: string,
): string {
  if (entry.type === 'allDay') return texts.allDay;

  const start = formatTime(locale, msToTimestamp(entry.startMs!), zone);
  const end = formatTime(locale, msToTimestamp(entry.endMs!), zone);

  if (entry.continuesFromPrevious && entry.continuesToNext) return texts.throughoutDay;
  if (entry.continuesFromPrevious) return texts.until.replace('{time}', end);
  if (entry.continuesToNext) return texts.fromTime.replace('{time}', start);
  if (entry.endMs === entry.startMs) return start;
  return rangeTemplate.replace('{start}', start).replace('{end}', end);
}

/**
 * The delivery of an open task. On its delivery day it says "this day" or the hour. On the other
 * days of its window it names the day of the delivery. The hour is read in the display zone.
 */
export function openTaskDueText(
  locale: string,
  open: OpenTask,
  zone: string,
  texts: TimelineTexts,
): string {
  if (!open.isDueDay) return texts.dueOn.replace('{date}', formatDate(locale, open.dueDate));
  const due = open.item.due!;
  return due.allDay
    ? texts.dueDay
    : texts.dueAt.replace('{time}', formatTime(locale, due.at, zone));
}
