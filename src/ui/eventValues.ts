import {
  createItem,
  formatPlainDate,
  getZonedParts,
  isPlainDate,
  isTimestamp,
  isValidTimeZone,
  msToTimestamp,
  timestampToMs,
  validateItem,
  zonedTimeToMs,
  type Id,
  type Item,
  type ItemIssue,
  type ItemLink,
  type Schedule,
} from '../core';

/*
 * The event form works with plain text (what the inputs hold). This file turns that text into
 * the fields of an item, and back. It has no React, so it is easy to test.
 */

export type ScheduleMode = 'none' | 'allDay' | 'timed';

export interface LinkValues {
  label: string;
  url: string;
}

export interface EventFormValues {
  title: string;
  mode: ScheduleMode;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  /** Empty means "use the display time zone". */
  timeZone: string;
  location: string;
  notes: string;
  links: LinkValues[];
  tagIds: Id[];
  inheritTags: boolean;
}

/** Problems found only by the form, before the core rules run. */
export type FormIssue =
  | ItemIssue
  | 'startDateRequired'
  | 'startTimeRequired'
  | 'endTimeRequired'
  | 'linkInvalid'
  | 'saveFailed';

/** Where a message is shown. `form` is for problems that belong to no single field. */
export type FieldKey = 'title' | 'start' | 'end' | 'timeZone' | 'links' | 'form';

export type FieldErrors = Partial<Record<FieldKey, FormIssue>>;

/** The part of an item that the event form edits. */
export interface EventFields {
  title: string;
  notes: string;
  schedule: Schedule | null;
  location: string;
  links: ItemLink[];
  tagIds: Id[];
  inheritTags: boolean;
}

/** Every time zone name the browser knows, for the suggestions list. Empty if it cannot tell. */
export function knownTimeZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  try {
    return intl.supportedValuesOf?.('timeZone') ?? [];
  } catch {
    return [];
  }
}

export function emptyEventValues(): EventFormValues {
  return {
    title: '',
    mode: 'none',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    timeZone: '',
    location: '',
    notes: '',
    links: [],
    tagIds: [],
    inheritTags: true,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function parseTime(value: string): { hour: number; minute: number } | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
}

/** Splits an instant into the date and the time it shows on the wall clock of a zone. */
export function splitInstant(instant: string, zone: string): { date: string; time: string } {
  if (!isTimestamp(instant)) return { date: '', time: '' };
  const parts = getZonedParts(timestampToMs(instant), zone);
  return { date: formatPlainDate(parts), time: `${pad(parts.hour)}:${pad(parts.minute)}` };
}

/**
 * The text of the inputs for an existing event. A timed event is shown on the clock of its own
 * time zone when it has one, and on the display time zone otherwise.
 */
export function valuesFromItem(item: Item, displayTimeZone: string): EventFormValues {
  const values: EventFormValues = {
    ...emptyEventValues(),
    title: item.title,
    location: item.location,
    notes: item.notes,
    links: item.links.map((link) => ({ label: link.label, url: link.url })),
    tagIds: [...item.tagIds],
    inheritTags: item.inheritTags,
  };
  const schedule = item.schedule;
  if (!schedule) return values;

  if (schedule.allDay) {
    return { ...values, mode: 'allDay', startDate: schedule.start, endDate: schedule.end ?? '' };
  }
  const zone = schedule.timeZone ?? displayTimeZone;
  const start = splitInstant(schedule.start, zone);
  const end =
    schedule.end === undefined ? { date: '', time: '' } : splitInstant(schedule.end, zone);
  return {
    ...values,
    mode: 'timed',
    startDate: start.date,
    startTime: start.time,
    // An end on the same day as the start leaves the end date empty, to keep the form short
    endDate: end.date === start.date ? '' : end.date,
    endTime: end.time,
    timeZone: schedule.timeZone ?? '',
  };
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function buildSchedule(
  values: EventFormValues,
  displayTimeZone: string,
): { schedule: Schedule | null; errors: FieldErrors } {
  if (values.mode === 'none') return { schedule: null, errors: {} };

  if (values.mode === 'allDay') {
    if (values.startDate === '') return { schedule: null, errors: { start: 'startDateRequired' } };
    const end = values.endDate === '' ? {} : { end: values.endDate };
    return { schedule: { allDay: true, start: values.startDate, ...end }, errors: {} };
  }

  const errors: FieldErrors = {};
  const zoneText = values.timeZone.trim();
  if (zoneText !== '' && !isValidTimeZone(zoneText)) errors.timeZone = 'invalidTimeZone';
  if (values.startDate === '') errors.start = 'startDateRequired';
  const start = parseTime(values.startTime);
  if (!errors.start && !start) errors.start = 'startTimeRequired';
  const end = parseTime(values.endTime);
  if (values.endDate !== '' && !end) errors.end = 'endTimeRequired';
  if (values.endTime !== '' && !end) errors.end = 'endTimeRequired';
  if (Object.keys(errors).length > 0 || !start) return { schedule: null, errors };
  if (!isPlainDate(values.startDate) || (values.endDate !== '' && !isPlainDate(values.endDate))) {
    return { schedule: null, errors: { start: 'startDateRequired' } };
  }

  const zone = zoneText === '' ? displayTimeZone : zoneText;
  const startMs = zonedTimeToMs(values.startDate, start.hour, start.minute, zone);
  const schedule: Schedule = {
    allDay: false,
    start: msToTimestamp(startMs),
    ...(zoneText === '' ? {} : { timeZone: zoneText }),
  };
  if (end) {
    const endDate = values.endDate === '' ? values.startDate : values.endDate;
    schedule.end = msToTimestamp(zonedTimeToMs(endDate, end.hour, end.minute, zone));
  }
  return { schedule, errors: {} };
}

export function buildLinks(rows: LinkValues[]): { links: ItemLink[]; valid: boolean } {
  const links: ItemLink[] = [];
  let valid = true;
  for (const row of rows) {
    const label = row.label.trim();
    const url = row.url.trim();
    if (label === '' && url === '') continue;
    if (!isHttpUrl(url)) {
      valid = false;
      continue;
    }
    links.push({ label: label === '' ? url : label, url });
  }
  return { links, valid };
}

/** Which field shows the message for each rule of the core. */
function fieldOf(issue: ItemIssue, mode: ScheduleMode): FieldKey {
  switch (issue) {
    case 'titleRequired':
      return 'title';
    case 'invalidDate':
    case 'invalidInstant':
      return 'start';
    case 'endBeforeStart':
      return mode === 'none' ? 'form' : 'end';
    case 'invalidTimeZone':
      return 'timeZone';
    default:
      return 'form';
  }
}

export interface BuildResult {
  /** Filled only when there are no errors. */
  fields: EventFields | null;
  errors: FieldErrors;
}

/**
 * Checks the text of the form and builds the fields of the event. Our own checks (a missing
 * date, a bad link) run first, then the rules of the core run over the finished item, so the
 * form and the stored data never disagree. Each field keeps only its first message.
 */
export function buildEventFields(
  values: EventFormValues,
  displayTimeZone: string,
  base: { agendaId: Id; existing?: Item },
): BuildResult {
  const built = buildSchedule(values, displayTimeZone);
  const errors: FieldErrors = { ...built.errors };
  const links = buildLinks(values.links);
  if (!links.valid) errors.links = 'linkInvalid';

  const fields: EventFields = {
    title: values.title.trim(),
    notes: values.notes,
    schedule: built.schedule,
    location: values.location.trim(),
    links: links.links,
    tagIds: [...new Set(values.tagIds)],
    inheritTags: values.inheritTags,
  };

  const draft: Item = {
    ...(base.existing ?? createItem({ kind: 'event', title: '', agendaId: base.agendaId })),
    ...fields,
  };
  for (const issue of validateItem(draft, displayTimeZone)) {
    const key = fieldOf(issue, values.mode);
    if (!errors[key]) errors[key] = issue;
  }

  return Object.keys(errors).length > 0 ? { fields: null, errors } : { fields, errors };
}
