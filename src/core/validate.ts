import { isPlainDate } from './plainDate';
import { isTimestamp, validateSchedule, type ScheduleIssue } from './schedule';
import { dueDate } from './window';
import { isValidTimeZone } from './zone';
import type { Due, Item } from './types';

export type DueIssue = 'invalidDueDate' | 'invalidDueInstant' | 'invalidDueTimeZone';

export type ItemIssue =
  | 'titleRequired'
  | 'taskNeedsStatus'
  | 'parentIsSelf'
  | 'taskCannotHaveSchedule'
  | 'eventCannotHaveWindow'
  | 'fromNeedsDue'
  | 'invalidFromDate'
  | 'fromAfterDue'
  | DueIssue
  | ScheduleIssue;

export function validateDue(due: Due): DueIssue[] {
  if (due.allDay) return isPlainDate(due.date) ? [] : ['invalidDueDate'];
  if (!isTimestamp(due.at)) return ['invalidDueInstant'];
  if (due.timeZone !== undefined && !isValidTimeZone(due.timeZone)) return ['invalidDueTimeZone'];
  return [];
}

/**
 * Checks one item. The display time zone is optional: it is only needed to compare a start day
 * with a timed delivery, because the day of that delivery is the day in the display zone (the
 * same rule the window uses). Without a zone that one comparison is skipped.
 */
export function validateItem(item: Item, displayTimeZone?: string): ItemIssue[] {
  const issues: ItemIssue[] = [];
  if (item.title.trim() === '') issues.push('titleRequired');
  if (item.kind === 'task' && item.statusId === null) issues.push('taskNeedsStatus');
  if (item.parentId === item.id) issues.push('parentIsSelf');

  if (item.kind === 'task' && item.schedule !== null) issues.push('taskCannotHaveSchedule');
  if (item.kind === 'event' && (item.from !== null || item.due !== null)) {
    issues.push('eventCannotHaveWindow');
  }
  if (item.schedule) issues.push(...validateSchedule(item.schedule));

  if (item.due) issues.push(...validateDue(item.due));
  if (item.from !== null) {
    if (item.due === null) issues.push('fromNeedsDue');
    if (!isPlainDate(item.from)) issues.push('invalidFromDate');
  }

  if (
    item.from !== null &&
    item.due !== null &&
    isPlainDate(item.from) &&
    validateDue(item.due).length === 0
  ) {
    const zone = item.due.allDay ? 'UTC' : displayTimeZone;
    if (zone !== undefined && item.from > dueDate(item.due, zone)) issues.push('fromAfterDue');
  }
  return issues;
}
