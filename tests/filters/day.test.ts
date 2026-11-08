import { buildTimelineDay, type Item, type OverdueEntry } from '../../src/core';
import {
  EMPTY_FILTER,
  applyDayFilters,
  applyOverdueFilter,
  type ItemFilter,
} from '../../src/filters';
import { SP, event, task, titles } from './helpers';

const none = new Set<string>();
const filter = (changes: Partial<ItemFilter>): ItemFilter => ({ ...EMPTY_FILTER, ...changes });

// São Paulo is UTC-3, so 09:00 there is 12:00Z
const at = (hour: number, minute = 0) =>
  new Date(Date.UTC(2026, 10, 9, hour + 3, minute)).toISOString();

function dayOf(items: Item[], date = '2026-11-09') {
  return buildTimelineDay(items, date, SP, none);
}
const timedTitles = (day: ReturnType<typeof dayOf>) => day.timed.map((entry) => entry.item.title);

describe('applyDayFilters: periods', () => {
  const items = [
    event('Dawn run', { schedule: { allDay: false, start: at(5), end: at(5, 45) } }),
    event('Standup', { schedule: { allDay: false, start: at(9), end: at(9, 30) } }),
    event('Lunch', { schedule: { allDay: false, start: at(12), end: at(13) } }),
    event('Class', { schedule: { allDay: false, start: at(19), end: at(22) } }),
    event('Holiday', { schedule: { allDay: true, start: '2026-11-09' } }),
    task('Paper', { due: { allDay: true, date: '2026-11-09' } }),
  ];

  it('returns the same day when no period is chosen', () => {
    const day = dayOf(items);
    expect(applyDayFilters(day, EMPTY_FILTER, SP)).toBe(day);
  });

  it('keeps the timed events that touch a chosen period, and drops whole-day events', () => {
    const day = applyDayFilters(dayOf(items), filter({ periods: ['morning'] }), SP);
    expect(timedTitles(day)).toEqual(['Standup']);
    expect(day.allDay).toEqual([]);
  });

  it('several periods work as "any of them"', () => {
    const day = applyDayFilters(dayOf(items), filter({ periods: ['dawn', 'evening'] }), SP);
    expect(timedTitles(day)).toEqual(['Dawn run', 'Class']);
  });

  it('keeps an event that crosses periods in each one it touches', () => {
    const long = [event('Workshop', { schedule: { allDay: false, start: at(11), end: at(14) } })];
    const morning = applyDayFilters(dayOf(long), filter({ periods: ['morning'] }), SP);
    const afternoon = applyDayFilters(dayOf(long), filter({ periods: ['afternoon'] }), SP);
    const evening = applyDayFilters(dayOf(long), filter({ periods: ['evening'] }), SP);
    expect([morning, afternoon, evening].map((d) => d.timed.length)).toEqual([1, 1, 0]);
  });

  it('hides the open tasks when only day periods are chosen', () => {
    const day = applyDayFilters(dayOf(items), filter({ periods: ['dawn'] }), SP);
    expect(day.open).toEqual([]);
  });

  it('uses the period hours it is given', () => {
    const bounds = { morningStart: 10, afternoonStart: 14, eveningStart: 20 };
    const day = applyDayFilters(dayOf(items), filter({ periods: ['dawn'] }), SP, bounds);
    // With the morning starting at 10h, the 09:00 stand-up is dawn too
    expect(timedTitles(day)).toEqual(['Dawn run', 'Standup']);
  });

  it('marks a day that lost everything as empty, so it can fold', () => {
    const lonely = [event('Holiday', { schedule: { allDay: true, start: '2026-11-09' } })];
    const day = applyDayFilters(dayOf(lonely), filter({ periods: ['morning'] }), SP);
    expect(day.empty).toBe(true);
    expect(applyDayFilters(dayOf(items), filter({ periods: ['morning'] }), SP).empty).toBe(false);
  });
});

describe('applyDayFilters: untimed chip', () => {
  const items = [
    event('Standup', { schedule: { allDay: false, start: at(9), end: at(9, 30) } }),
    event('Holiday', { schedule: { allDay: true, start: '2026-11-09' } }),
    task('Paper', { due: { allDay: true, date: '2026-11-09' } }),
    task('Report at six', { due: { allDay: false, at: at(18) } }),
  ];
  const open = (day: ReturnType<typeof dayOf>) => titles(day.open.map((entry) => entry.item));

  it('alone, keeps the whole-day events and the tasks, and drops the timed events', () => {
    const day = applyDayFilters(dayOf(items), filter({ periods: ['untimed'] }), SP);
    expect(timedTitles(day)).toEqual([]);
    expect(titles(day.allDay.map((entry) => entry.item))).toEqual(['Holiday']);
    expect(open(day).sort()).toEqual(['Paper', 'Report at six']);
  });

  it('with a period, shows that period plus what has no set time', () => {
    const day = applyDayFilters(dayOf(items), filter({ periods: ['morning', 'untimed'] }), SP);
    expect(timedTitles(day)).toEqual(['Standup']);
    expect(day.allDay).toHaveLength(1);
    expect(day.open).toHaveLength(2);
  });

  it('a task due at a time of day is still untimed', () => {
    const day = applyDayFilters(dayOf(items), filter({ periods: ['evening'] }), SP);
    expect(open(day)).toEqual([]);
  });

  it('is empty when nothing combines, so the day can fold', () => {
    const tasksOnly = [task('Paper', { due: { allDay: true, date: '2026-11-09' } })];
    const day = applyDayFilters(dayOf(tasksOnly), filter({ periods: ['morning'] }), SP);
    expect(day.empty).toBe(true);
  });

  it('still lets the due within limit cut the tasks', () => {
    const far = [task('Far', { due: { allDay: true, date: '2026-12-25' } })];
    const day = applyDayFilters(dayOf(far), filter({ periods: ['untimed'], dueWithinDays: 3 }), SP);
    expect(day.open).toEqual([]);
  });
});

describe('applyOverdueFilter', () => {
  const entries: OverdueEntry[] = [{ item: task('Late'), dueDate: '2026-11-05', daysLate: 4 }];

  it('keeps the strip when no chip is on or the untimed chip is on', () => {
    expect(applyOverdueFilter(entries, EMPTY_FILTER)).toBe(entries);
    expect(applyOverdueFilter(entries, filter({ periods: ['morning', 'untimed'] }))).toBe(entries);
  });

  it('hides the strip when only day periods are on', () => {
    expect(applyOverdueFilter(entries, filter({ periods: ['morning'] }))).toEqual([]);
  });

  it('is not cut by the due within limit', () => {
    expect(applyOverdueFilter(entries, filter({ dueWithinDays: 0 }))).toBe(entries);
  });
});

describe('applyDayFilters: due within', () => {
  const items = [
    task('Far', { from: '2026-10-01', due: { allDay: true, date: '2026-12-31' } }),
    task('Near', { from: '2026-10-01', due: { allDay: true, date: '2026-11-12' } }),
    task('Today', { from: '2026-10-01', due: { allDay: true, date: '2026-11-09' } }),
    event('Class', { schedule: { allDay: true, start: '2026-11-09' } }),
  ];
  const openTitles = (day: ReturnType<typeof dayOf>) => titles(day.open.map((o) => o.item));

  it('hides a task until its delivery is within the limit, counted from the day shown', () => {
    const nov9 = applyDayFilters(dayOf(items), filter({ dueWithinDays: 3 }), SP);
    expect(openTitles(nov9)).toEqual(['Today', 'Near']);
    const nov10 = applyDayFilters(dayOf(items, '2026-11-10'), filter({ dueWithinDays: 1 }), SP);
    // Near is 2 days away and Today is already overdue, so nothing is open
    expect(openTitles(nov10)).toEqual([]);
    const nov11 = applyDayFilters(dayOf(items, '2026-11-11'), filter({ dueWithinDays: 1 }), SP);
    expect(openTitles(nov11)).toEqual(['Near']);
  });

  it('zero means only on the delivery day', () => {
    const nov9 = applyDayFilters(dayOf(items), filter({ dueWithinDays: 0 }), SP);
    expect(openTitles(nov9)).toEqual(['Today']);
  });

  it('shows the far task when its time comes', () => {
    const day = applyDayFilters(dayOf(items, '2026-12-29'), filter({ dueWithinDays: 2 }), SP);
    expect(openTitles(day)).toEqual(['Far']);
  });

  it('does not touch events, and ignores a limit that is not valid', () => {
    const day = applyDayFilters(dayOf(items), filter({ dueWithinDays: 0 }), SP);
    expect(day.allDay).toHaveLength(1);
    const plain = dayOf(items);
    expect(applyDayFilters(plain, filter({ dueWithinDays: -2 }), SP)).toBe(plain);
  });

  it('marks the day empty when the limit hides the only task', () => {
    const lonely = [task('Far', { from: '2026-10-01', due: { allDay: true, date: '2026-12-31' } })];
    const day = applyDayFilters(dayOf(lonely), filter({ dueWithinDays: 7 }), SP);
    expect(day.empty).toBe(true);
  });
});
