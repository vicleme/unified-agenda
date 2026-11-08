import {
  DEFAULT_PERIOD_BOUNDS,
  daysBetween,
  periodsOnDate,
  type DayPeriod,
  type OverdueEntry,
  type PeriodBounds,
  type TimelineDay,
} from '../core';
import { isValidDueWithin, type ItemFilter } from './types';

/** The chosen day periods, and whether the "untimed" chip is on. Null means the sieve is off. */
function chosenPeriods(filter: ItemFilter): { periods: Set<DayPeriod>; untimed: boolean } | null {
  if (filter.periods.length === 0) return null;
  const periods = new Set<DayPeriod>();
  let untimed = false;
  for (const chip of filter.periods) {
    if (chip === 'untimed') untimed = true;
    else periods.add(chip);
  }
  return { periods, untimed };
}

/**
 * The sieves that depend on the day, applied to one Timeline day that was already built from the
 * items that passed `filterItems`:
 * - periods ("any of these" chips): a timed event stays only if it touches a chosen day period on
 *   that day. Whole-day events and open tasks have no set time, so they stay only when the
 *   `untimed` chip is on.
 * - due within: an open task stays only when its delivery is at most that many days after the day
 *   being shown, so a task given months ahead does not fill every day until it gets close.
 * The `empty` flag is recomputed, so a day that lost everything can fold. Returns the same day
 * object when nothing changes.
 */
export function applyDayFilters(
  day: TimelineDay,
  filter: ItemFilter,
  timeZone: string,
  bounds: PeriodBounds = DEFAULT_PERIOD_BOUNDS,
): TimelineDay {
  const chosen = chosenPeriods(filter);
  const limit = filter.dueWithinDays;
  const useLimit = isValidDueWithin(limit);
  if (chosen === null && !useLimit) return day;

  const keepUntimed = chosen === null || chosen.untimed;
  const allDay = keepUntimed ? day.allDay : [];
  const timed =
    chosen === null
      ? day.timed
      : day.timed.filter((entry) =>
          periodsOnDate(entry.item.schedule, day.date, timeZone, bounds).some((period) =>
            chosen.periods.has(period),
          ),
        );
  let open = keepUntimed ? day.open : [];
  if (useLimit) open = open.filter((task) => daysBetween(day.date, task.dueDate) <= limit);

  return { ...day, allDay, timed, open, empty: allDay.length + timed.length + open.length === 0 };
}

/**
 * The overdue strip under the period chips: it has no time of day, so it stays only when no chip is
 * on or the `untimed` chip is on. The "due within" limit never cuts it. Returns the same list when
 * nothing changes.
 */
export function applyOverdueFilter(entries: OverdueEntry[], filter: ItemFilter): OverdueEntry[] {
  const chosen = chosenPeriods(filter);
  return chosen === null || chosen.untimed ? entries : [];
}
