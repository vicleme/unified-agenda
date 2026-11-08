import type { DayPeriod, Id, ItemKind } from '../core';

/**
 * A chip of the "when" filter: one of the four day periods, or `untimed`, which stands for what has
 * no set time of day: whole-day events and the task strips (open and overdue). A task due at 18:00
 * is still untimed, because the hour is a limit, not time the person has booked.
 */
export type PeriodFilter = DayPeriod | 'untimed';

/*
 * What the person asked to see. Analogy: a set of sieves over the same pile of cards. Each sieve
 * that is on keeps only some cards, and a card has to pass every sieve that is on. A sieve that is
 * off (an empty list, an empty text, null) lets everything through.
 *
 * It is plain data (no functions, no dates), so a saved view can store it as JSON later.
 */
export interface ItemFilter {
  /** Tags to show. A card passes with any of them, or any of their descendants. Empty means all. */
  tagIds: Id[];
  /** Kinds to show. A work block is an event. Empty means both. */
  kinds: ItemKind[];
  /**
   * Chips of the "when" filter, "any of these". A day period keeps the timed events that touch it.
   * `untimed` keeps whole-day events and the task strips. Only what is not covered by a chosen chip
   * leaves, so "morning" alone shows just the morning events and "morning" plus "untimed" adds the
   * whole-day events and the tasks. Empty means all.
   */
  periods: PeriodFilter[];
  /** Words to find in the title, notes or location, all of them, ignoring case and accents. */
  text: string;
  /**
   * Open tasks only show on a day when their delivery is at most this many days away from that
   * day (0 means only on the delivery day). Overdue tasks always show. Null means no limit.
   */
  dueWithinDays: number | null;
}

export const EMPTY_FILTER: ItemFilter = {
  tagIds: [],
  kinds: [],
  periods: [],
  text: '',
  dueWithinDays: null,
};

/** True when at least one sieve is on, so the interface can say that something is filtered. */
export function isFilterActive(filter: ItemFilter): boolean {
  return (
    filter.tagIds.length > 0 ||
    filter.kinds.length > 0 ||
    filter.periods.length > 0 ||
    filter.text.trim() !== '' ||
    isValidDueWithin(filter.dueWithinDays)
  );
}

/** A usable "due within" limit: a whole number of days, zero or more. Anything else is off. */
export function isValidDueWithin(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value >= 0;
}
