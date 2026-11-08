import { addDays, comparePlainDates, daysBetween, isPlainDate } from '../../src/core';

describe('plain dates', () => {
  it('accepts real dates and rejects impossible ones', () => {
    expect(isPlainDate('2026-11-07')).toBe(true);
    expect(isPlainDate('2028-02-29')).toBe(true);
    expect(isPlainDate('2026-02-29')).toBe(false);
    expect(isPlainDate('2026-13-01')).toBe(false);
    expect(isPlainDate('2026-1-1')).toBe(false);
    expect(isPlainDate(20261107)).toBe(false);
  });

  it('adds days across month, year and leap day', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts days between and compares', () => {
    expect(daysBetween('2026-11-07', '2026-11-10')).toBe(3);
    expect(daysBetween('2026-11-10', '2026-11-07')).toBe(-3);
    expect(comparePlainDates('2026-11-07', '2026-11-08')).toBe(-1);
    expect(comparePlainDates('2026-11-07', '2026-11-07')).toBe(0);
  });
});
