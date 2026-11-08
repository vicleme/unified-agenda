import { formatPlainDate, parsePlainDate } from './plainDate';
import type { PlainDate } from './types';

/*
 * Time zone rules, built on the Intl support that browsers and Node already have.
 * Nothing in the core reads the device clock zone by itself: every function that needs a zone
 * receives it as a parameter. That keeps the rules pure and easy to test.
 */

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    // Throws a RangeError for an unknown zone, before anything is cached
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value === '') return false;
  try {
    formatterFor(value);
    return true;
  } catch {
    return false;
  }
}

export function deviceTimeZone(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isValidTimeZone(zone) ? zone : 'UTC';
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** The wall clock reading in a zone, for an absolute instant given in milliseconds. */
export function getZonedParts(ms: number, timeZone: string): ZonedParts {
  const parts = formatterFor(timeZone).formatToParts(new Date(ms));
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}

/** How far the zone is ahead of UTC at that instant, in milliseconds. */
function offsetMs(ms: number, timeZone: string): number {
  const whole = Math.floor(ms / 1000) * 1000;
  const p = getZonedParts(whole, timeZone);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asIfUtc - whole;
}

export function getTimeZoneOffsetMinutes(ms: number, timeZone: string): number {
  return offsetMs(ms, timeZone) / 60_000;
}

/** The calendar date it is in that zone at that instant. */
export function localDate(ms: number, timeZone: string): PlainDate {
  const { year, month, day } = getZonedParts(ms, timeZone);
  return formatPlainDate({ year, month, day });
}

/**
 * Turns a wall clock reading in a zone into an absolute instant, in milliseconds.
 * Two edge cases around daylight saving time:
 * - A reading that does not exist (the clock jumped forward) moves forward by the gap.
 * - A reading that happens twice (the clock went back) resolves to the first occurrence.
 */
export function zonedTimeToMs(
  date: PlainDate,
  hour: number,
  minute: number,
  timeZone: string,
): number {
  const parts = parsePlainDate(date);
  if (!parts) throw new RangeError(`Invalid date: ${date}`);
  const asIfUtc = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute);

  const firstOffset = offsetMs(asIfUtc, timeZone);
  const first = asIfUtc - firstOffset;
  const secondOffset = offsetMs(first, timeZone);
  if (secondOffset === firstOffset) return first;

  const second = asIfUtc - secondOffset;
  if (offsetMs(second, timeZone) === secondOffset) return second;

  // The reading falls in a gap
  return Math.max(first, second);
}

/** The instant a calendar day begins in a zone. */
export function startOfDayMs(date: PlainDate, timeZone: string): number {
  return zonedTimeToMs(date, 0, 0, timeZone);
}

/** Resolves the setting (a zone name or auto) into a real zone name. */
export function resolveTimeZone(setting: string, device: string = deviceTimeZone()): string {
  if (setting === 'auto') return device;
  return isValidTimeZone(setting) ? setting : device;
}
