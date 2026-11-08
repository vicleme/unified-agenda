import {
  getTimeZoneOffsetMinutes,
  isValidTimeZone,
  localDate,
  resolveTimeZone,
  startOfDayMs,
  zonedTimeToMs,
} from '../../src/core';

const iso = (ms: number) => new Date(ms).toISOString();
const SP = 'America/Sao_Paulo';
const NY = 'America/New_York';

describe('time zones', () => {
  it('validates zone names', () => {
    expect(isValidTimeZone(SP)).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
  });

  it('reads offsets', () => {
    const summer = Date.UTC(2026, 6, 4, 12);
    expect(getTimeZoneOffsetMinutes(summer, SP)).toBe(-180);
    expect(getTimeZoneOffsetMinutes(summer, NY)).toBe(-240);
    expect(getTimeZoneOffsetMinutes(summer, 'Asia/Tokyo')).toBe(540);
    expect(getTimeZoneOffsetMinutes(Date.UTC(2026, 0, 4, 12), NY)).toBe(-300);
  });

  it('gives a different calendar date for the same instant', () => {
    const instant = Date.parse('2026-11-08T02:30:00Z');
    expect(localDate(instant, SP)).toBe('2026-11-07');
    expect(localDate(instant, 'Asia/Tokyo')).toBe('2026-11-08');
    expect(localDate(instant, 'UTC')).toBe('2026-11-08');
  });

  it('converts a wall clock reading to an instant', () => {
    expect(iso(zonedTimeToMs('2026-11-07', 14, 0, SP))).toBe('2026-11-07T17:00:00.000Z');
    expect(iso(zonedTimeToMs('2026-07-04', 12, 0, NY))).toBe('2026-07-04T16:00:00.000Z');
    expect(iso(zonedTimeToMs('2026-01-04', 12, 0, NY))).toBe('2026-01-04T17:00:00.000Z');
    expect(iso(startOfDayMs('2026-11-07', 'Asia/Tokyo'))).toBe('2026-11-06T15:00:00.000Z');
  });

  it('moves a reading that does not exist forward (clock jumps ahead)', () => {
    // New York, 2026-03-08: 02:00 became 03:00, so 02:30 does not exist
    expect(iso(zonedTimeToMs('2026-03-08', 2, 30, NY))).toBe('2026-03-08T07:30:00.000Z');
  });

  it('picks the first occurrence of a repeated reading (clock goes back)', () => {
    // New York, 2026-11-01: 01:30 happens twice. The first is still daylight time.
    expect(iso(zonedTimeToMs('2026-11-01', 1, 30, NY))).toBe('2026-11-01T05:30:00.000Z');
  });

  it('handles the right hour on both sides of a change', () => {
    expect(iso(zonedTimeToMs('2026-03-08', 4, 0, NY))).toBe('2026-03-08T08:00:00.000Z');
    expect(iso(zonedTimeToMs('2026-03-08', 1, 0, NY))).toBe('2026-03-08T06:00:00.000Z');
  });

  it('has days of 23 and 25 hours when the clock changes', () => {
    const hours = (a: string, b: string) => (startOfDayMs(b, NY) - startOfDayMs(a, NY)) / 3_600_000;
    expect(hours('2026-03-08', '2026-03-09')).toBe(23);
    expect(hours('2026-11-01', '2026-11-02')).toBe(25);
    expect(hours('2026-06-01', '2026-06-02')).toBe(24);
  });

  it('resolves auto to the device zone and ignores unknown names', () => {
    expect(resolveTimeZone('auto', SP)).toBe(SP);
    expect(resolveTimeZone('Europe/Lisbon', SP)).toBe('Europe/Lisbon');
    expect(resolveTimeZone('Nowhere/Land', SP)).toBe(SP);
  });
});
