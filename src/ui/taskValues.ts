import {
  createItem,
  isValidTimeZone,
  msToTimestamp,
  validateItem,
  zonedTimeToMs,
  type Due,
  type Id,
  type Item,
  type ItemIssue,
  type ItemLink,
  type PlainDate,
} from '../core';
import { buildLinks, parseTime, splitInstant, type LinkValues } from './eventValues';

/*
 * The task form works with plain text (what the inputs hold). This file turns that text into the
 * fields of a task, and back. It has no React, so it is easy to test. It mirrors eventValues.ts.
 */

export type DueMode = 'none' | 'allDay' | 'timed';

export interface TaskFormValues {
  title: string;
  /** Empty until a status is chosen. */
  statusId: string;
  /** The first day the task is pending. Empty means the day the task is created. */
  from: string;
  dueMode: DueMode;
  dueDate: string;
  dueTime: string;
  /** Empty means "use the display time zone". */
  timeZone: string;
  location: string;
  notes: string;
  links: LinkValues[];
  tagIds: Id[];
  inheritTags: boolean;
}

/** Problems found only by the form, before the core rules run. */
export type TaskIssue =
  ItemIssue | 'dueDateRequired' | 'dueTimeRequired' | 'linkInvalid' | 'saveFailed';

/** Where a message is shown. `form` is for problems that belong to no single field. */
export type TaskFieldKey = 'title' | 'status' | 'from' | 'due' | 'timeZone' | 'links' | 'form';

export type TaskFieldErrors = Partial<Record<TaskFieldKey, TaskIssue>>;

/** The part of an item that the task form edits. */
export interface TaskFields {
  title: string;
  notes: string;
  statusId: Id | null;
  from: PlainDate | null;
  due: Due | null;
  location: string;
  links: ItemLink[];
  tagIds: Id[];
  inheritTags: boolean;
}

export function emptyTaskValues(statusId: Id = ''): TaskFormValues {
  return {
    title: '',
    statusId,
    from: '',
    dueMode: 'none',
    dueDate: '',
    dueTime: '',
    timeZone: '',
    location: '',
    notes: '',
    links: [],
    tagIds: [],
    inheritTags: true,
  };
}

/**
 * The text of the inputs for an existing task. A timed delivery is shown on the clock of its own
 * time zone when it has one, and on the display time zone otherwise.
 */
export function valuesFromTask(item: Item, displayTimeZone: string): TaskFormValues {
  const values: TaskFormValues = {
    ...emptyTaskValues(item.statusId ?? ''),
    title: item.title,
    from: item.from ?? '',
    location: item.location,
    notes: item.notes,
    links: item.links.map((link) => ({ label: link.label, url: link.url })),
    tagIds: [...item.tagIds],
    inheritTags: item.inheritTags,
  };
  const due = item.due;
  if (!due) return values;
  if (due.allDay) return { ...values, dueMode: 'allDay', dueDate: due.date };

  const parts = splitInstant(due.at, due.timeZone ?? displayTimeZone);
  return {
    ...values,
    dueMode: 'timed',
    dueDate: parts.date,
    dueTime: parts.time,
    timeZone: due.timeZone ?? '',
  };
}

function buildDue(
  values: TaskFormValues,
  displayTimeZone: string,
): { due: Due | null; errors: TaskFieldErrors } {
  if (values.dueMode === 'none') return { due: null, errors: {} };

  if (values.dueMode === 'allDay') {
    if (values.dueDate === '') return { due: null, errors: { due: 'dueDateRequired' } };
    return { due: { allDay: true, date: values.dueDate }, errors: {} };
  }

  const errors: TaskFieldErrors = {};
  const zoneText = values.timeZone.trim();
  if (zoneText !== '' && !isValidTimeZone(zoneText)) errors.timeZone = 'invalidTimeZone';
  if (values.dueDate === '') errors.due = 'dueDateRequired';
  const time = parseTime(values.dueTime);
  if (!errors.due && !time) errors.due = 'dueTimeRequired';
  if (Object.keys(errors).length > 0 || !time) return { due: null, errors };

  const zone = zoneText === '' ? displayTimeZone : zoneText;
  const at = msToTimestamp(zonedTimeToMs(values.dueDate, time.hour, time.minute, zone));
  return { due: { allDay: false, at, ...(zoneText === '' ? {} : { timeZone: zoneText }) }, errors };
}

/** Which field shows the message for each rule of the core. */
function fieldOf(issue: ItemIssue): TaskFieldKey {
  switch (issue) {
    case 'titleRequired':
      return 'title';
    case 'taskNeedsStatus':
      return 'status';
    case 'fromNeedsDue':
    case 'invalidFromDate':
    case 'fromAfterDue':
      return 'from';
    case 'invalidDueDate':
    case 'invalidDueInstant':
      return 'due';
    case 'invalidDueTimeZone':
      return 'timeZone';
    default:
      return 'form';
  }
}

export interface TaskBuildResult {
  /** Filled only when there are no errors. */
  fields: TaskFields | null;
  errors: TaskFieldErrors;
}

/**
 * Checks the text of the form and builds the fields of the task. Our own checks (a missing date,
 * a bad link) run first, then the rules of the core run over the finished item, so the form and
 * the stored data never disagree. Each field keeps only its first message.
 */
export function buildTaskFields(
  values: TaskFormValues,
  displayTimeZone: string,
  base: { agendaId: Id; parentId?: Id | null; existing?: Item },
): TaskBuildResult {
  const built = buildDue(values, displayTimeZone);
  const errors: TaskFieldErrors = { ...built.errors };
  const links = buildLinks(values.links);
  if (!links.valid) errors.links = 'linkInvalid';

  const fields: TaskFields = {
    title: values.title.trim(),
    notes: values.notes,
    statusId: values.statusId === '' ? null : values.statusId,
    from: values.from === '' ? null : values.from,
    due: built.due,
    location: values.location.trim(),
    links: links.links,
    tagIds: [...new Set(values.tagIds)],
    inheritTags: values.inheritTags,
  };

  const fresh = createItem({
    kind: 'task',
    title: '',
    agendaId: base.agendaId,
    parentId: base.parentId ?? null,
  });
  const draft: Item = { ...(base.existing ?? fresh), ...fields };
  for (const issue of validateItem(draft, displayTimeZone)) {
    const key = fieldOf(issue);
    if (!errors[key]) errors[key] = issue;
  }

  return Object.keys(errors).length > 0 ? { fields: null, errors } : { fields, errors };
}
