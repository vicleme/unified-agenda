import { addDays, comparePlainDates } from './plainDate';
import { timestampToMs } from './schedule';
import { localDate, startOfDayMs, zonedTimeToMs } from './zone';
import type { DayPeriod, PeriodBounds, PlainDate, Schedule } from './types';

export const DAY_PERIODS: readonly DayPeriod[] = ['dawn', 'morning', 'afternoon', 'evening'];

export const DEFAULT_PERIOD_BOUNDS: PeriodBounds = {
  morningStart: 6,
  afternoonStart: 12,
  eveningStart: 18,
};

export function isValidPeriodBounds(bounds: PeriodBounds): boolean {
  const { morningStart, afternoonStart, eveningStart } = bounds;
  return (
    [morningStart, afternoonStart, eveningStart].every(Number.isInteger) &&
    morningStart > 0 &&
    morningStart < afternoonStart &&
    afternoonStart < eveningStart &&
    eveningStart < 24
  );
}

/** The instants where each period starts on a given day, and the instant the day ends. */
function periodEdges(date: PlainDate, timeZone: string, bounds: PeriodBounds): number[] {
  return [
    startOfDayMs(date, timeZone),
    zonedTimeToMs(date, bounds.morningStart, 0, timeZone),
    zonedTimeToMs(date, bounds.afternoonStart, 0, timeZone),
    zonedTimeToMs(date, bounds.eveningStart, 0, timeZone),
    startOfDayMs(addDays(date, 1), timeZone),
  ];
}

/**
 * The periods a schedule touches on one calendar day of a zone.
 * An item that crosses periods (11h to 14h) appears in each of them. An item that ends exactly
 * where a period starts (11h to 12h) does not enter that period. Whole-day and unscheduled items
 * have no period.
 */
export function periodsOnDate(
  schedule: Schedule | null,
  date: PlainDate,
  timeZone: string,
  bounds: PeriodBounds = DEFAULT_PERIOD_BOUNDS,
): DayPeriod[] {
  if (!schedule || schedule.allDay) return [];

  const startMs = timestampToMs(schedule.start);
  const endMs = Math.max(startMs, schedule.end ? timestampToMs(schedule.end) : startMs);
  const edges = periodEdges(date, timeZone, bounds);

  return DAY_PERIODS.filter((_, index) => {
    const from = edges[index]!;
    const to = edges[index + 1]!;
    return startMs === endMs ? startMs >= from && startMs < to : startMs < to && endMs > from;
  });
}

const MAX_DAYS_SCANNED = 400;

/** Every period a schedule touches across all the days it spans, in the zone shown. */
export function periodsOfSchedule(
  schedule: Schedule | null,
  timeZone: string,
  bounds: PeriodBounds = DEFAULT_PERIOD_BOUNDS,
): DayPeriod[] {
  if (!schedule || schedule.allDay) return [];

  const startMs = timestampToMs(schedule.start);
  const endMs = Math.max(startMs, schedule.end ? timestampToMs(schedule.end) : startMs);
  const lastDate = localDate(endMs, timeZone);

  const found = new Set<DayPeriod>();
  let date = localDate(startMs, timeZone);
  for (let scanned = 0; scanned < MAX_DAYS_SCANNED; scanned++) {
    for (const period of periodsOnDate(schedule, date, timeZone, bounds)) found.add(period);
    if (found.size === DAY_PERIODS.length || comparePlainDates(date, lastDate) >= 0) break;
    date = addDays(date, 1);
  }
  return DAY_PERIODS.filter((period) => found.has(period));
}
