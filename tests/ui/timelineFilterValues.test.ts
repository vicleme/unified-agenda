import { EMPTY_FILTER } from '../../src/filters';
import {
  PERIOD_CHIPS,
  activeFilterCount,
  parseDueWithin,
  toggleValue,
} from '../../src/ui/timelineFilterValues';

describe('toggleValue', () => {
  it('adds a value once and takes it off, keeping the others', () => {
    expect(toggleValue(['a'], 'b', true)).toEqual(['a', 'b']);
    expect(toggleValue(['a', 'b'], 'b', true)).toEqual(['a', 'b']);
    expect(toggleValue(['a', 'b'], 'a', false)).toEqual(['b']);
    expect(toggleValue(['a'], 'z', false)).toEqual(['a']);
  });

  it('does not change the list it was given', () => {
    const list = ['a'];
    toggleValue(list, 'b', true);
    expect(list).toEqual(['a']);
  });
});

describe('parseDueWithin', () => {
  it('reads whole days, zero included, ignoring spaces around', () => {
    expect(parseDueWithin('0')).toBe(0);
    expect(parseDueWithin(' 14 ')).toBe(14);
  });

  it('turns the limit off for empty, negative, decimal or other text', () => {
    for (const text of ['', '  ', '-1', '1.5', '1e3', 'abc', '12345']) {
      expect(parseDueWithin(text)).toBeNull();
    }
  });
});

describe('activeFilterCount', () => {
  it('is zero for an empty filter and for blank text or an invalid limit', () => {
    expect(activeFilterCount(EMPTY_FILTER)).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTER, text: '   ', dueWithinDays: -2 })).toBe(0);
  });

  it('counts each sieve once, however many values it holds', () => {
    expect(
      activeFilterCount({
        tagIds: ['a', 'b'],
        kinds: ['task'],
        periods: ['morning', 'untimed'],
        text: 'x',
        dueWithinDays: 0,
      }),
    ).toBe(5);
  });
});

describe('PERIOD_CHIPS', () => {
  it('lists the four periods in day order, then "no set time"', () => {
    expect(PERIOD_CHIPS).toEqual(['dawn', 'morning', 'afternoon', 'evening', 'untimed']);
  });
});

describe('activeFilterCount with the agenda selection', () => {
  it('counts a hidden agenda as one more sieve', () => {
    expect(activeFilterCount(EMPTY_FILTER, true)).toBe(1);
    expect(activeFilterCount({ ...EMPTY_FILTER, text: 'a' }, true)).toBe(2);
    expect(activeFilterCount(EMPTY_FILTER)).toBe(0);
  });
});
