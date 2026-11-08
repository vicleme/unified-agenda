import {
  buildOverdueStrip,
  buildTimelineDay,
  buildTimelineRange,
  createItem,
  type Item,
} from '../../src/core';
import { testContext } from './helpers';

const SP = 'America/Sao_Paulo'; // UTC-3 all year since 2019
const NY = 'America/New_York'; // the clock goes back on 2026-11-01, a day with 25 hours
const none = new Set<string>();

const ctx = testContext(); // items are created on 2026-11-07
function event(title: string, schedule: Item['schedule'], extra: Partial<Item> = {}): Item {
  return { ...createItem({ kind: 'event', title, agendaId: 'a', schedule }, ctx), ...extra };
}
type TaskInput = Omit<Parameters<typeof createItem>[0], 'kind' | 'title' | 'agendaId'>;
function task(title: string, extra: Partial<TaskInput> = {}): Item {
  return createItem({ kind: 'task', title, agendaId: 'a', statusId: 's-planned', ...extra }, ctx);
}
const titles = (list: { item: Item }[]) => list.map((entry) => entry.item.title);

describe('buildTimelineDay: events', () => {
  it('puts whole-day items before timed ones, and timed ones in time order', () => {
    const items = [
      event('Lunch', { allDay: false, start: '2026-11-10T15:00:00.000Z' }), // 12h in SP
      event('Holiday', { allDay: true, start: '2026-11-10' }),
      event('Class', { allDay: false, start: '2026-11-10T11:00:00.000Z' }), // 08h
    ];
    const day = buildTimelineDay(items, '2026-11-10', SP, none);
    expect(titles(day.allDay)).toEqual(['Holiday']);
    expect(titles(day.timed)).toEqual(['Class', 'Lunch']);
    expect(day.empty).toBe(false);
  });

  it('uses the display zone to decide the day', () => {
    // 01:30 UTC on the 11th is 22:30 on the 10th in Sao Paulo
    const item = event('Late', { allDay: false, start: '2026-11-11T01:30:00.000Z' });
    expect(titles(buildTimelineDay([item], '2026-11-10', SP, none).timed)).toEqual(['Late']);
    expect(titles(buildTimelineDay([item], '2026-11-11', SP, none).timed)).toEqual([]);
    expect(titles(buildTimelineDay([item], '2026-11-11', 'UTC', none).timed)).toEqual(['Late']);
  });

  it('writes a multi-day whole-day item on every day, with continues marks', () => {
    const trip = event('Trip', { allDay: true, start: '2026-11-10', end: '2026-11-12' });
    const marks = (date: string) => {
      const entry = buildTimelineDay([trip], date, SP, none).allDay[0];
      return entry ? [entry.continuesFromPrevious, entry.continuesToNext] : null;
    };
    expect(marks('2026-11-09')).toBeNull();
    expect(marks('2026-11-10')).toEqual([false, true]);
    expect(marks('2026-11-11')).toEqual([true, true]);
    expect(marks('2026-11-12')).toEqual([true, false]);
    expect(marks('2026-11-13')).toBeNull();
  });

  it('splits a timed item that crosses midnight and clips each part to its day', () => {
    // 22:00 on the 10th to 02:00 on the 11th in Sao Paulo
    const party = event('Party', {
      allDay: false,
      start: '2026-11-11T01:00:00.000Z',
      end: '2026-11-11T05:00:00.000Z',
    });
    const first = buildTimelineDay([party], '2026-11-10', SP, none).timed[0]!;
    const second = buildTimelineDay([party], '2026-11-11', SP, none).timed[0]!;
    expect([first.continuesFromPrevious, first.continuesToNext]).toEqual([false, true]);
    expect([second.continuesFromPrevious, second.continuesToNext]).toEqual([true, false]);
    expect(first.endMs).toBe(Date.parse('2026-11-11T03:00:00.000Z')); // midnight in SP
    expect(second.startMs).toBe(Date.parse('2026-11-11T03:00:00.000Z'));
    expect(second.endMs).toBe(Date.parse('2026-11-11T05:00:00.000Z'));
  });

  it('does not reach the next day when it ends exactly at midnight', () => {
    const item = event('Until midnight', {
      allDay: false,
      start: '2026-11-11T01:00:00.000Z',
      end: '2026-11-11T03:00:00.000Z',
    });
    expect(titles(buildTimelineDay([item], '2026-11-10', SP, none).timed)).toEqual([
      'Until midnight',
    ]);
    expect(buildTimelineDay([item], '2026-11-11', SP, none).timed).toEqual([]);
    expect(buildTimelineDay([item], '2026-11-10', SP, none).timed[0]!.continuesToNext).toBe(false);
  });

  it('treats an item with no end as a point on the day of its start', () => {
    const item = event('Call', { allDay: false, start: '2026-11-10T14:00:00.000Z' });
    const entry = buildTimelineDay([item], '2026-11-10', SP, none).timed[0]!;
    expect(entry.startMs).toBe(entry.endMs);
    expect(entry.continuesToNext).toBe(false);
  });

  it('follows the clock on a day with 25 hours', () => {
    // 04:30 UTC on Nov 2 is 23:30 on Nov 1 in New York (after the clock went back)
    const item = event('Late night', { allDay: false, start: '2026-11-02T04:30:00.000Z' });
    expect(titles(buildTimelineDay([item], '2026-11-01', NY, none).timed)).toEqual(['Late night']);
    expect(buildTimelineDay([item], '2026-11-02', NY, none).timed).toEqual([]);
  });

  it('ignores deleted items and events without a schedule', () => {
    const deleted = event(
      'Gone',
      { allDay: true, start: '2026-11-10' },
      { deletedAt: '2026-11-08T00:00:00.000Z' },
    );
    const inbox = event('Inbox', null);
    const day = buildTimelineDay([deleted, inbox], '2026-11-10', SP, none);
    expect(day.allDay).toEqual([]);
    expect(day.empty).toBe(true);
  });

  it('shows a work block at its own hour, inside the day', () => {
    const parent = task('Paper', { from: '2026-11-03', due: { allDay: true, date: '2026-11-25' } });
    const block = {
      ...event('Work on paper', {
        allDay: false,
        start: '2026-11-10T17:00:00.000Z',
        end: '2026-11-10T19:00:00.000Z',
      }),
      parentId: parent.id,
    };
    const day = buildTimelineDay([parent, block], '2026-11-10', SP, none);
    expect(titles(day.timed)).toEqual(['Work on paper']);
    expect(titles(day.open)).toEqual(['Paper']);
  });
});

describe('buildTimelineDay: open tasks', () => {
  it('lists a task on every day of its window, with the delivery day marked', () => {
    const paper = task('Paper', { from: '2026-11-03', due: { allDay: true, date: '2026-11-05' } });
    const flags = (date: string) =>
      buildTimelineDay([paper], date, SP, none).open.map((entry) => entry.isDueDay);
    expect(flags('2026-11-02')).toEqual([]);
    expect(flags('2026-11-03')).toEqual([false]);
    expect(flags('2026-11-04')).toEqual([false]);
    expect(flags('2026-11-05')).toEqual([true]);
    expect(flags('2026-11-06')).toEqual([]);
  });

  it('hides done tasks and puts deliveries of the day first', () => {
    const later = task('Later', { from: '2026-11-03', due: { allDay: true, date: '2026-11-20' } });
    const today = task('Today', { from: '2026-11-03', due: { allDay: true, date: '2026-11-10' } });
    const finished = {
      ...task('Finished', { from: '2026-11-03', due: { allDay: true, date: '2026-11-10' } }),
      statusId: 's-done',
    };
    const day = buildTimelineDay([later, today, finished], '2026-11-10', SP, new Set(['s-done']));
    expect(titles(day.open)).toEqual(['Today', 'Later']);
  });

  it('uses the display zone for the day of a timed delivery', () => {
    // 02:00 UTC on the 11th is 23:00 on the 10th in Sao Paulo
    const portal = task('Portal', {
      from: '2026-11-09',
      due: { allDay: false, at: '2026-11-11T02:00:00.000Z' },
    });
    const day = buildTimelineDay([portal], '2026-11-10', SP, none);
    expect(day.open[0]!.isDueDay).toBe(true);
  });

  it('does not show tasks with no delivery', () => {
    const inbox = task('Someday');
    expect(buildTimelineDay([inbox], '2026-11-10', SP, none).open).toEqual([]);
  });
});

describe('buildTimelineRange', () => {
  it('returns consecutive days and marks the empty ones', () => {
    const item = event('Class', { allDay: true, start: '2026-11-11' });
    const days = buildTimelineRange([item], '2026-11-10', '2026-11-12', SP, none);
    expect(days.map((day) => day.date)).toEqual(['2026-11-10', '2026-11-11', '2026-11-12']);
    expect(days.map((day) => day.empty)).toEqual([true, false, true]);
  });

  it('crosses a month end and returns nothing for a backwards range', () => {
    const days = buildTimelineRange([], '2026-11-29', '2026-12-02', SP, none);
    expect(days.map((day) => day.date)).toEqual([
      '2026-11-29',
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
    ]);
    expect(buildTimelineRange([], '2026-11-12', '2026-11-10', SP, none)).toEqual([]);
  });
});

describe('buildOverdueStrip', () => {
  const now = '2026-11-10T15:00:00.000Z'; // the 10th, 12h in Sao Paulo

  it('lists late tasks, oldest delivery first, with how many days late', () => {
    const a = task('A', { from: '2026-11-01', due: { allDay: true, date: '2026-11-08' } });
    const b = task('B', { from: '2026-11-01', due: { allDay: true, date: '2026-11-04' } });
    const notYet = task('Not yet', {
      from: '2026-11-01',
      due: { allDay: true, date: '2026-11-10' },
    });
    const strip = buildOverdueStrip([a, b, notYet], now, '2026-11-10', SP, none);
    expect(strip.map((entry) => [entry.item.title, entry.daysLate])).toEqual([
      ['B', 6],
      ['A', 2],
    ]);
  });

  it('leaves out done tasks', () => {
    const done = {
      ...task('Done', { from: '2026-11-01', due: { allDay: true, date: '2026-11-04' } }),
      statusId: 's-done',
    };
    expect(buildOverdueStrip([done], now, '2026-11-10', SP, new Set(['s-done']))).toEqual([]);
  });

  it('counts a timed delivery that passed today as zero days late (late today)', () => {
    const portal = task('Portal', {
      from: '2026-11-09',
      due: { allDay: false, at: '2026-11-10T13:00:00.000Z' },
    });
    const strip = buildOverdueStrip([portal], now, '2026-11-10', SP, none);
    expect(strip.map((entry) => entry.daysLate)).toEqual([0]);
  });
});
