import {
  createItem,
  dueDate,
  isInWindow,
  isPastDue,
  overdueTasks,
  pendingOnDate,
  taskWindow,
  workBlocks,
  type Context,
  type Item,
} from '../../src/core';
import { testContext } from './helpers';

const SP = 'America/Sao_Paulo';
const LISBON = 'Europe/Lisbon';

/** The test clock starts on 2026-11-07 12:00 UTC, which is 09:00 on the same day in Sao Paulo. */
function task(over: Partial<Parameters<typeof createItem>[0]> = {}, ctx: Context = testContext()) {
  return createItem({ kind: 'task', title: 'Paper', agendaId: 'a', statusId: 's', ...over }, ctx);
}

describe('task window', () => {
  it('runs from the start day to the due day', () => {
    const item = task({ from: '2026-11-03', due: { allDay: true, date: '2026-11-24' } });
    expect(taskWindow(item, SP)).toEqual({ from: '2026-11-03', due: '2026-11-24' });
  });

  it('starts on the creation day when there is no start', () => {
    const item = task({ due: { allDay: true, date: '2026-11-24' } });
    expect(taskWindow(item, SP)).toEqual({ from: '2026-11-07', due: '2026-11-24' });
  });

  it('follows the display zone for the creation day', () => {
    // 2026-11-07 12:00 UTC is still the 7th in Sao Paulo, but 02:00 on the 8th in Kiritimati (UTC+14)
    const item = task({ due: { allDay: true, date: '2026-11-24' } });
    expect(taskWindow(item, 'Pacific/Kiritimati')?.from).toBe('2026-11-08');
  });

  it('is only the due day for a task created after its delivery', () => {
    const item = task({ due: { allDay: true, date: '2026-11-02' } });
    expect(taskWindow(item, SP)).toEqual({ from: '2026-11-02', due: '2026-11-02' });
  });

  it('is empty for events and for tasks with no delivery', () => {
    expect(taskWindow(task(), SP)).toBeNull();
    const event = task({ kind: 'event' });
    expect(taskWindow(event, SP)).toBeNull();
  });

  it('puts a timed delivery on its day in the display zone', () => {
    // 23:59 in Sao Paulo on the 24th is 02:59 UTC on the 25th
    const due = { allDay: false as const, at: '2026-11-25T02:59:00.000Z' };
    expect(dueDate(due, SP)).toBe('2026-11-24');
    expect(dueDate(due, LISBON)).toBe('2026-11-25');
    expect(dueDate({ allDay: true, date: '2026-11-24' }, 'Asia/Tokyo')).toBe('2026-11-24');
  });

  it('includes both ends and nothing outside', () => {
    const item = task({ from: '2026-11-03', due: { allDay: true, date: '2026-11-24' } });
    expect(isInWindow(item, '2026-11-02', SP)).toBe(false);
    expect(isInWindow(item, '2026-11-03', SP)).toBe(true);
    expect(isInWindow(item, '2026-11-15', SP)).toBe(true);
    expect(isInWindow(item, '2026-11-24', SP)).toBe(true);
    expect(isInWindow(item, '2026-11-25', SP)).toBe(false);
    expect(isInWindow(task(), '2026-11-15', SP)).toBe(false);
  });
});

describe('past due', () => {
  it('treats a whole-day delivery as late only after its day is over', () => {
    const due = { allDay: true as const, date: '2026-11-24' };
    expect(isPastDue(due, '2026-11-24T20:00:00.000Z', SP)).toBe(false);
    // 03:00 UTC on the 25th is midnight on the 25th in Sao Paulo
    expect(isPastDue(due, '2026-11-25T03:00:00.000Z', SP)).toBe(true);
    expect(isPastDue(due, '2026-11-25T02:59:00.000Z', SP)).toBe(false);
  });

  it('treats a timed delivery as late right after its time', () => {
    const due = { allDay: false as const, at: '2026-11-25T02:59:00.000Z' };
    expect(isPastDue(due, '2026-11-25T02:59:00.000Z', SP)).toBe(false);
    expect(isPastDue(due, '2026-11-25T03:00:00.000Z', SP)).toBe(true);
  });
});

describe('pending and overdue lists', () => {
  const ctx = testContext();
  const open = task(
    {
      title: 'Open',
      from: '2026-11-03',
      due: { allDay: true, date: '2026-11-24' },
      statusId: 'todo',
    },
    ctx,
  );
  const finished = task(
    {
      title: 'Done',
      from: '2026-11-03',
      due: { allDay: true, date: '2026-11-24' },
      statusId: 'ok',
    },
    ctx,
  );
  const late = task(
    { title: 'Late', due: { allDay: true, date: '2026-11-05' }, statusId: 'todo' },
    ctx,
  );
  const later = task(
    { title: 'Later', due: { allDay: true, date: '2026-11-04' }, statusId: 'todo' },
    ctx,
  );
  const event = createItem(
    {
      kind: 'event',
      title: 'Class',
      agendaId: 'a',
      schedule: { allDay: true, start: '2026-11-10' },
    },
    ctx,
  );
  const removed: Item = {
    ...task({ due: { allDay: true, date: '2026-11-24' } }, ctx),
    deletedAt: 'x',
  };
  const items = [open, finished, late, later, event, removed];
  const doneIds = new Set(['ok']);

  it('lists the open tasks of a day and skips done, deleted and events', () => {
    expect(pendingOnDate(items, '2026-11-10', SP, doneIds).map((i) => i.title)).toEqual(['Open']);
  });

  it('shows a task on every day of its window and on no other day', () => {
    expect(pendingOnDate(items, '2026-11-03', SP, doneIds)).toEqual([open]);
    expect(pendingOnDate(items, '2026-11-25', SP, doneIds)).toEqual([]);
  });

  it('keeps a late task out of the pending days after its delivery', () => {
    expect(pendingOnDate(items, '2026-11-06', SP, doneIds).map((i) => i.title)).toEqual(['Open']);
  });

  it('lists overdue tasks with the oldest delivery first', () => {
    const now = '2026-11-25T12:00:00.000Z';
    expect(overdueTasks(items, now, SP, doneIds).map((i) => i.title)).toEqual([
      'Later',
      'Late',
      'Open',
    ]);
    expect(overdueTasks(items, '2026-11-04T12:00:00.000Z', SP, doneIds)).toEqual([]);
  });
});

describe('work blocks', () => {
  const ctx = testContext();
  const parent = task({ due: { allDay: true, date: '2026-11-24' } }, ctx);
  const block = (start: string, over: Partial<Parameters<typeof createItem>[0]> = {}) =>
    createItem(
      {
        kind: 'event',
        title: 'Work',
        agendaId: 'a',
        parentId: parent.id,
        schedule: { allDay: false, start, end: start.replace('14', '16') },
        ...over,
      },
      ctx,
    );

  it('returns the timed events directly under the task in time order', () => {
    const second = block('2026-11-17T14:00:00.000Z');
    const first = block('2026-11-10T14:00:00.000Z');
    const wholeDay = block('x', { schedule: { allDay: true, start: '2026-11-12' } });
    const checklistTask = block('2026-11-11T14:00:00.000Z', { kind: 'task' });
    const elsewhere = block('2026-11-09T14:00:00.000Z', { parentId: 'other' });
    const removed: Item = { ...block('2026-11-08T14:00:00.000Z'), deletedAt: 'x' };
    const all = [parent, second, first, wholeDay, checklistTask, elsewhere, removed];
    expect(workBlocks(parent, all)).toEqual([first, second]);
  });
});
