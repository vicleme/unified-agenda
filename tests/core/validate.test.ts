import { createItem, validateDue, validateItem, validateSchedule } from '../../src/core';
import { testContext } from './helpers';

const make = (over: Parameters<typeof createItem>[0]) => createItem(over, testContext());

describe('item validation', () => {
  it('accepts a good task', () => {
    const item = make({ kind: 'task', title: 'Read', agendaId: 'a', statusId: 's' });
    expect(validateItem(item)).toEqual([]);
  });

  it('requires a title and, for tasks, a status', () => {
    expect(validateItem(make({ kind: 'task', title: '  ', agendaId: 'a' }))).toEqual([
      'titleRequired',
      'taskNeedsStatus',
    ]);
    expect(validateItem(make({ kind: 'event', title: 'Class', agendaId: 'a' }))).toEqual([]);
  });

  it('rejects a parent that is the item itself', () => {
    const item = make({ kind: 'event', title: 'x', agendaId: 'a' });
    expect(validateItem({ ...item, parentId: item.id })).toEqual(['parentIsSelf']);
  });
});

describe('schedule validation', () => {
  it('checks whole-day schedules', () => {
    expect(validateSchedule({ allDay: true, start: '2026-11-07' })).toEqual([]);
    expect(validateSchedule({ allDay: true, start: '2026-11-07', end: '2026-11-09' })).toEqual([]);
    expect(validateSchedule({ allDay: true, start: '2026-02-30' })).toEqual(['invalidDate']);
    expect(validateSchedule({ allDay: true, start: '2026-11-09', end: '2026-11-07' })).toEqual([
      'endBeforeStart',
    ]);
  });

  it('checks timed schedules', () => {
    const start = '2026-11-07T12:00:00.000Z';
    expect(validateSchedule({ allDay: false, start })).toEqual([]);
    expect(validateSchedule({ allDay: false, start, end: '2026-11-07T11:00:00.000Z' })).toEqual([
      'endBeforeStart',
    ]);
    expect(validateSchedule({ allDay: false, start: '2026-11-07 12:00' })).toEqual([
      'invalidInstant',
    ]);
    expect(validateSchedule({ allDay: false, start, timeZone: 'Nowhere/Land' })).toEqual([
      'invalidTimeZone',
    ]);
    expect(validateSchedule({ allDay: false, start, timeZone: 'Europe/Lisbon' })).toEqual([]);
  });
});

describe('task window validation', () => {
  const task = (over: Partial<Parameters<typeof createItem>[0]>) =>
    make({ kind: 'task', title: 'Paper', agendaId: 'a', statusId: 's', ...over });
  const due = { allDay: true as const, date: '2026-11-24' };

  it('accepts a start with a due date, and a due date alone', () => {
    expect(validateItem(task({ from: '2026-11-03', due }))).toEqual([]);
    expect(validateItem(task({ due }))).toEqual([]);
    expect(validateItem(task({ from: '2026-11-24', due }))).toEqual([]);
  });

  it('rejects a start after the due day', () => {
    expect(validateItem(task({ from: '2026-11-25', due }))).toEqual(['fromAfterDue']);
  });

  it('rejects a start with no due date', () => {
    expect(validateItem(task({ from: '2026-11-03' }))).toEqual(['fromNeedsDue']);
  });

  it('rejects impossible dates', () => {
    expect(validateItem(task({ from: '2026-02-30', due }))).toEqual(['invalidFromDate']);
    expect(validateItem(task({ due: { allDay: true, date: '2026-13-01' } }))).toEqual([
      'invalidDueDate',
    ]);
  });

  it('compares a start with a timed delivery in the display zone', () => {
    const timed = { allDay: false as const, at: '2026-11-25T02:59:00.000Z' };
    const item = task({ from: '2026-11-25', due: timed });
    expect(validateItem(item, 'America/Sao_Paulo')).toEqual(['fromAfterDue']);
    expect(validateItem(item, 'Europe/Lisbon')).toEqual([]);
    expect(validateItem(item)).toEqual([]);
  });

  it('checks a timed delivery', () => {
    expect(validateDue({ allDay: false, at: '2026-11-25 23:59' })).toEqual(['invalidDueInstant']);
    expect(
      validateDue({ allDay: false, at: '2026-11-25T02:59:00.000Z', timeZone: 'Nowhere/Land' }),
    ).toEqual(['invalidDueTimeZone']);
    expect(
      validateDue({ allDay: false, at: '2026-11-25T02:59:00.000Z', timeZone: 'America/Sao_Paulo' }),
    ).toEqual([]);
  });

  it('keeps schedule for events and the window for tasks', () => {
    const schedule = { allDay: true as const, start: '2026-11-10' };
    expect(validateItem(task({ schedule, due }))).toEqual(['taskCannotHaveSchedule']);
    expect(validateItem(make({ kind: 'event', title: 'Class', agendaId: 'a', due }))).toEqual([
      'eventCannotHaveWindow',
    ]);
    expect(
      validateItem(make({ kind: 'event', title: 'Class', agendaId: 'a', from: '2026-11-03' })),
    ).toEqual(['eventCannotHaveWindow', 'fromNeedsDue']);
  });
});
