import { isValidDueWithin, type ItemFilter, type PeriodFilter } from '../filters';

/** The order of the "when" chips: the four day periods, then what has no set time. */
export const PERIOD_CHIPS: readonly PeriodFilter[] = [
  'dawn',
  'morning',
  'afternoon',
  'evening',
  'untimed',
];

/** Adds the value to the list, or takes it off, keeping the rest of the list as it was. */
export function toggleValue<T>(list: readonly T[], value: T, on: boolean): T[] {
  const without = list.filter((existing) => existing !== value);
  return on ? [...without, value] : without;
}

/**
 * Reads the "due within" field. Only whole days written with digits count (zero is allowed, and
 * means only on the delivery day). Empty, negative, decimal or any other text turns the limit off.
 */
export function parseDueWithin(text: string): number | null {
  const trimmed = text.trim();
  return /^\d{1,4}$/.test(trimmed) ? Number(trimmed) : null;
}

/**
 * How many sieves are on (tags, type, when, text, due limit and the agenda selection each count
 * once). Pass `agendasOn` when some agenda is hidden.
 */
export function activeFilterCount(filter: ItemFilter, agendasOn = false): number {
  return [
    agendasOn,
    filter.tagIds.length > 0,
    filter.kinds.length > 0,
    filter.periods.length > 0,
    filter.text.trim() !== '',
    isValidDueWithin(filter.dueWithinDays),
  ].filter(Boolean).length;
}
