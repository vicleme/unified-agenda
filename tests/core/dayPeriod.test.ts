import {
  isValidPeriodBounds,
  periodsOfSchedule,
  periodsOnDate,
  zonedTimeToMs,
  type PlainDate,
  type Schedule,
} from '../../src/core';

const SP = 'America/Sao_Paulo';

function timed(
  date: PlainDate,
  from: [number, number],
  endDate: PlainDate,
  to: [number, number] | null,
  zone = SP,
): Schedule {
  const start = new Date(zonedTimeToMs(date, from[0], from[1], zone)).toISOString();
  const end = to ? new Date(zonedTimeToMs(endDate, to[0], to[1], zone)).toISOString() : undefined;
  return { allDay: false, start, ...(end ? { end } : {}) };
}

describe('day periods', () => {
  it('puts a point in time in one period, boundaries starting a period', () => {
    const at = (h: number, m = 0) => periodsOfSchedule(timed('2026-11-07', [h, m], '', null), SP);
    expect(at(0)).toEqual(['dawn']);
    expect(at(5, 59)).toEqual(['dawn']);
    expect(at(6)).toEqual(['morning']);
    expect(at(12)).toEqual(['afternoon']);
    expect(at(18)).toEqual(['evening']);
    expect(at(23, 59)).toEqual(['evening']);
  });

  it('puts an item in every period it overlaps', () => {
    const item = timed('2026-11-07', [11, 0], '2026-11-07', [14, 0]);
    expect(periodsOfSchedule(item, SP)).toEqual(['morning', 'afternoon']);
  });

  it('does not enter a period the item ends exactly at', () => {
    const item = timed('2026-11-07', [11, 0], '2026-11-07', [12, 0]);
    expect(periodsOfSchedule(item, SP)).toEqual(['morning']);
  });

  it('covers a long item', () => {
    const item = timed('2026-11-07', [0, 0], '2026-11-07', [23, 59]);
    expect(periodsOfSchedule(item, SP)).toEqual(['dawn', 'morning', 'afternoon', 'evening']);
  });

  it('splits an overnight item across the two days', () => {
    const item = timed('2026-11-07', [22, 0], '2026-11-08', [7, 0]);
    expect(periodsOnDate(item, '2026-11-07', SP)).toEqual(['evening']);
    expect(periodsOnDate(item, '2026-11-08', SP)).toEqual(['dawn', 'morning']);
    expect(periodsOnDate(item, '2026-11-09', SP)).toEqual([]);
    expect(periodsOfSchedule(item, SP)).toEqual(['dawn', 'morning', 'evening']);
  });

  it('depends on the zone shown, not on the zone it was made in', () => {
    const item = timed('2026-11-07', [14, 0], '', null, SP); // 17:00 UTC
    expect(periodsOfSchedule(item, SP)).toEqual(['afternoon']);
    expect(periodsOfSchedule(item, 'Asia/Tokyo')).toEqual(['dawn']); // 02:00 next day
    expect(periodsOfSchedule(item, 'America/New_York')).toEqual(['afternoon']); // 12:00
  });

  it('has no period for whole-day or unscheduled items', () => {
    expect(periodsOfSchedule({ allDay: true, start: '2026-11-07' }, SP)).toEqual([]);
    expect(periodsOfSchedule(null, SP)).toEqual([]);
  });

  it('uses custom bounds', () => {
    const bounds = { morningStart: 5, afternoonStart: 13, eveningStart: 19 };
    const item = timed('2026-11-07', [12, 30], '', null);
    expect(periodsOfSchedule(item, SP)).toEqual(['afternoon']);
    expect(periodsOfSchedule(item, SP, bounds)).toEqual(['morning']);
  });

  it('keeps the periods right on a 23 hour day', () => {
    const item = timed('2026-03-08', [12, 0], '', null, 'America/New_York');
    expect(periodsOfSchedule(item, 'America/New_York')).toEqual(['afternoon']);
  });

  it('validates bounds', () => {
    expect(isValidPeriodBounds({ morningStart: 6, afternoonStart: 12, eveningStart: 18 })).toBe(
      true,
    );
    expect(isValidPeriodBounds({ morningStart: 12, afternoonStart: 6, eveningStart: 18 })).toBe(
      false,
    );
    expect(isValidPeriodBounds({ morningStart: 0, afternoonStart: 12, eveningStart: 18 })).toBe(
      false,
    );
    expect(isValidPeriodBounds({ morningStart: 6, afternoonStart: 12, eveningStart: 24 })).toBe(
      false,
    );
    expect(isValidPeriodBounds({ morningStart: 6.5, afternoonStart: 12, eveningStart: 18 })).toBe(
      false,
    );
  });
});
