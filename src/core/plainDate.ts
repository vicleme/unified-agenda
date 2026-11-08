import type { PlainDate } from './types';

const PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

export function parsePlainDate(value: string): DateParts | null {
  const match = PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // Rebuild the date to reject impossible days such as 2026-02-30
  const check = new Date(Date.UTC(year, month - 1, day));
  const real =
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day;
  return real ? { year, month, day } : null;
}

export function isPlainDate(value: unknown): value is PlainDate {
  return typeof value === 'string' && parsePlainDate(value) !== null;
}

export function formatPlainDate({ year, month, day }: DateParts): PlainDate {
  const pad = (n: number, size: number) => String(n).padStart(size, '0');
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

function toUtcDay(date: PlainDate): number {
  const parts = parsePlainDate(date);
  if (!parts) throw new RangeError(`Invalid date: ${date}`);
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

export function addDays(date: PlainDate, days: number): PlainDate {
  const moved = new Date(toUtcDay(date) + days * 86_400_000);
  return formatPlainDate({
    year: moved.getUTCFullYear(),
    month: moved.getUTCMonth() + 1,
    day: moved.getUTCDate(),
  });
}

/** Whole days from a to b. Negative when b comes first. */
export function daysBetween(a: PlainDate, b: PlainDate): number {
  return Math.round((toUtcDay(b) - toUtcDay(a)) / 86_400_000);
}

export function comparePlainDates(a: PlainDate, b: PlainDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
