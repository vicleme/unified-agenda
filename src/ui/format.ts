import {
  localDate,
  resolveTimeZone,
  timestampToMs,
  type Due,
  type PlainDate,
  type Schedule,
  type Timestamp,
} from '../core';

/** Texts for a count. Zero has its own text because Portuguese treats 0 like 1 (singular). */
export interface CountForms {
  zero: string;
  one: string;
  /** Used for every other count. */
  other: string;
}

/** Picks the right form and fills `{count}`, for example "1 item", "3 itens" or "Nenhum item". */
export function formatCount(locale: string, count: number, forms: CountForms): string {
  const form =
    count === 0
      ? forms.zero
      : new Intl.PluralRules(locale).select(count) === 'one'
        ? forms.one
        : forms.other;
  return form.replace('{count}', count.toLocaleString(locale));
}

/** A calendar date (`YYYY-MM-DD`). It has no time zone, so it is read as UTC to never shift a day. */
export function formatDate(locale: string, date: PlainDate): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

/** An instant shown in the display time zone. `auto` follows the device. */
export function formatDateTime(
  locale: string,
  instant: Timestamp,
  timeZone: string = 'auto',
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timeZone === 'auto' ? undefined : timeZone,
  }).format(new Date(instant));
}

/** Only the hour and minute of an instant, in the display time zone. */
export function formatTime(locale: string, instant: Timestamp, timeZone: string = 'auto'): string {
  return new Intl.DateTimeFormat(locale, {
    timeStyle: 'short',
    timeZone: timeZone === 'auto' ? undefined : timeZone,
  }).format(new Date(instant));
}

/**
 * When something happens, as one line of text. A timed schedule is shown in the display time
 * zone. `rangeTemplate` has `{start}` and `{end}`, so each language writes its own "to".
 * An end on the same day as the start shows only the hour.
 */
export function formatSchedule(
  locale: string,
  schedule: Schedule,
  timeZone: string,
  rangeTemplate: string,
): string {
  const join = (start: string, end: string) =>
    rangeTemplate.replace('{start}', start).replace('{end}', end);

  if (schedule.allDay) {
    const start = formatDate(locale, schedule.start);
    if (schedule.end === undefined || schedule.end === schedule.start) return start;
    return join(start, formatDate(locale, schedule.end));
  }

  const start = formatDateTime(locale, schedule.start, timeZone);
  if (schedule.end === undefined) return start;
  const zone = resolveTimeZone(timeZone);
  const sameDay =
    localDate(timestampToMs(schedule.start), zone) === localDate(timestampToMs(schedule.end), zone);
  return join(
    start,
    sameDay
      ? formatTime(locale, schedule.end, timeZone)
      : formatDateTime(locale, schedule.end, timeZone),
  );
}

/** The delivery of a task: a day, or a day and time shown in the display time zone. */
export function formatDue(locale: string, due: Due, timeZone: string): string {
  return due.allDay ? formatDate(locale, due.date) : formatDateTime(locale, due.at, timeZone);
}

/** A ratio from 0 to 1 as a percentage for the language, for example 60% or 60 %. */
export function formatPercent(locale: string, ratio: number): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(
    ratio,
  );
}

/** The heading of a day, for example "Saturday, November 7". A calendar date has no time zone. */
export function formatDayHeading(locale: string, date: PlainDate): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}
