import { createItem } from '../../src/core';
import {
  buildTaskFields,
  emptyTaskValues,
  valuesFromTask,
  type TaskFormValues,
} from '../../src/ui/taskValues';

const ZONE = 'America/Sao_Paulo';
const base = { agendaId: 'agenda-1' };

function values(changes: Partial<TaskFormValues> = {}): TaskFormValues {
  return { ...emptyTaskValues('status-1'), title: 'Paper', ...changes };
}

describe('buildTaskFields', () => {
  it('builds a task with no due date', () => {
    const result = buildTaskFields(values({ title: '  Paper  ' }), ZONE, base);
    expect(result.errors).toEqual({});
    expect(result.fields).toMatchObject({
      title: 'Paper',
      statusId: 'status-1',
      from: null,
      due: null,
      location: '',
      links: [],
    });
  });

  it('builds a whole-day delivery with a start day', () => {
    const result = buildTaskFields(
      values({ dueMode: 'allDay', dueDate: '2026-11-24', from: '2026-11-03' }),
      ZONE,
      base,
    );
    expect(result.fields).toMatchObject({
      from: '2026-11-03',
      due: { allDay: true, date: '2026-11-24' },
    });
  });

  it('reads a timed delivery on the display clock and stores it in UTC', () => {
    const result = buildTaskFields(
      values({ dueMode: 'timed', dueDate: '2026-11-24', dueTime: '23:59' }),
      ZONE,
      base,
    );
    expect(result.fields?.due).toEqual({ allDay: false, at: '2026-11-25T02:59:00.000Z' });
  });

  it('reads a timed delivery on the clock of its own time zone', () => {
    const result = buildTaskFields(
      values({ dueMode: 'timed', dueDate: '2026-11-24', dueTime: '12:00', timeZone: 'UTC' }),
      ZONE,
      base,
    );
    expect(result.fields?.due).toEqual({
      allDay: false,
      at: '2026-11-24T12:00:00.000Z',
      timeZone: 'UTC',
    });
  });

  it('asks for the missing parts of a delivery', () => {
    expect(buildTaskFields(values({ dueMode: 'allDay' }), ZONE, base).errors.due).toBe(
      'dueDateRequired',
    );
    expect(
      buildTaskFields(values({ dueMode: 'timed', dueDate: '2026-11-24' }), ZONE, base).errors.due,
    ).toBe('dueTimeRequired');
    expect(
      buildTaskFields(
        values({
          dueMode: 'timed',
          dueDate: '2026-11-24',
          dueTime: '10:00',
          timeZone: 'Mars/Base',
        }),
        ZONE,
        base,
      ).errors.timeZone,
    ).toBe('invalidTimeZone');
  });

  it('puts each rule of the core on its own field', () => {
    expect(buildTaskFields(values({ title: ' ' }), ZONE, base).errors.title).toBe('titleRequired');
    expect(buildTaskFields(values({ statusId: '' }), ZONE, base).errors.status).toBe(
      'taskNeedsStatus',
    );
    expect(buildTaskFields(values({ from: '2026-11-03' }), ZONE, base).errors.from).toBe(
      'fromNeedsDue',
    );
    expect(
      buildTaskFields(
        values({ dueMode: 'allDay', dueDate: '2026-11-03', from: '2026-11-10' }),
        ZONE,
        base,
      ).errors.from,
    ).toBe('fromAfterDue');
  });

  it('refuses a link without a full address and keeps the good ones', () => {
    const bad = buildTaskFields(
      values({ links: [{ label: 'Site', url: 'example.com' }] }),
      ZONE,
      base,
    );
    expect(bad.errors.links).toBe('linkInvalid');

    const good = buildTaskFields(
      values({
        links: [
          { label: '', url: '' },
          { label: '', url: 'https://example.com' },
        ],
      }),
      ZONE,
      base,
    );
    expect(good.fields?.links).toEqual([
      { label: 'https://example.com', url: 'https://example.com' },
    ]);
  });

  it('keeps the parent and the creation time of an existing task', () => {
    const existing = createItem({
      kind: 'task',
      title: 'Old',
      agendaId: 'agenda-1',
      parentId: 'parent-1',
      statusId: 'status-1',
    });
    const result = buildTaskFields(values({ title: 'New' }), ZONE, { ...base, existing });
    expect(result.fields?.title).toBe('New');
    expect(result.errors).toEqual({});
  });
});

describe('valuesFromTask', () => {
  it('turns a stored task back into the text of the form', () => {
    const item = createItem({
      kind: 'task',
      title: 'Paper',
      agendaId: 'agenda-1',
      statusId: 'status-1',
      from: '2026-11-03',
      due: { allDay: false, at: '2026-11-25T02:59:00.000Z' },
      location: 'Library',
      notes: 'Chapter 2',
    });
    expect(valuesFromTask(item, ZONE)).toMatchObject({
      title: 'Paper',
      statusId: 'status-1',
      from: '2026-11-03',
      dueMode: 'timed',
      dueDate: '2026-11-24',
      dueTime: '23:59',
      timeZone: '',
      location: 'Library',
      notes: 'Chapter 2',
    });
  });

  it('round trips a delivery that has its own time zone', () => {
    const due = { allDay: false as const, at: '2026-11-24T12:00:00.000Z', timeZone: 'UTC' };
    const item = createItem({
      kind: 'task',
      title: 'Report',
      agendaId: 'agenda-1',
      statusId: 'status-1',
      due,
    });
    const form = valuesFromTask(item, ZONE);
    expect(form).toMatchObject({ dueDate: '2026-11-24', dueTime: '12:00', timeZone: 'UTC' });
    expect(buildTaskFields(form, ZONE, { agendaId: 'agenda-1' }).fields?.due).toEqual(due);
  });

  it('shows a task with no delivery and a whole-day delivery', () => {
    const none = createItem({ kind: 'task', title: 'A', agendaId: 'a', statusId: 's' });
    expect(valuesFromTask(none, ZONE)).toMatchObject({ dueMode: 'none', dueDate: '' });
    const day = createItem({
      kind: 'task',
      title: 'B',
      agendaId: 'a',
      statusId: 's',
      due: { allDay: true, date: '2026-12-01' },
    });
    expect(valuesFromTask(day, ZONE)).toMatchObject({ dueMode: 'allDay', dueDate: '2026-12-01' });
  });
});

describe('tags in the task form', () => {
  it('starts with no tags and inheritance on', () => {
    expect(emptyTaskValues()).toMatchObject({ tagIds: [], inheritTags: true });
  });

  it('carries the tags and the switch to the fields, without repeats', () => {
    const result = buildTaskFields(
      values({ tagIds: ['a', 'b', 'a'], inheritTags: false }),
      ZONE,
      base,
    );
    expect(result.fields).toMatchObject({ tagIds: ['a', 'b'], inheritTags: false });
  });

  it('reads them back from an existing task', () => {
    const item = createItem({
      kind: 'task',
      title: 'Paper',
      agendaId: 'agenda-1',
      statusId: 's',
      tagIds: ['a'],
      inheritTags: false,
    });
    expect(valuesFromTask(item, ZONE)).toMatchObject({ tagIds: ['a'], inheritTags: false });
  });
});
