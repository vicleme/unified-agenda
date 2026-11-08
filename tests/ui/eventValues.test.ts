import { createItem } from '../../src/core';
import {
  buildEventFields,
  emptyEventValues,
  isHttpUrl,
  valuesFromItem,
  type EventFormValues,
} from '../../src/ui/eventValues';

const SAO_PAULO = 'America/Sao_Paulo';
const base = { agendaId: 'agenda-1' };

function values(changes: Partial<EventFormValues>): EventFormValues {
  return { ...emptyEventValues(), title: 'Class', ...changes };
}

describe('buildEventFields', () => {
  it('builds an event with no date', () => {
    const result = buildEventFields(
      values({ title: '  Class  ', location: ' Room 2 ' }),
      SAO_PAULO,
      base,
    );
    expect(result.errors).toEqual({});
    expect(result.fields).toMatchObject({ title: 'Class', location: 'Room 2', schedule: null });
  });

  it('reads a timed event on the display time zone and stores it in UTC', () => {
    const result = buildEventFields(
      values({ mode: 'timed', startDate: '2026-11-10', startTime: '14:00', endTime: '16:30' }),
      SAO_PAULO,
      base,
    );
    expect(result.fields?.schedule).toEqual({
      allDay: false,
      start: '2026-11-10T17:00:00.000Z',
      end: '2026-11-10T19:30:00.000Z',
    });
  });

  it('reads the clock on the zone of the event when it has one', () => {
    const result = buildEventFields(
      values({
        mode: 'timed',
        startDate: '2026-11-10',
        startTime: '14:00',
        timeZone: ' Europe/Lisbon ',
      }),
      SAO_PAULO,
      base,
    );
    expect(result.fields?.schedule).toEqual({
      allDay: false,
      start: '2026-11-10T14:00:00.000Z',
      timeZone: 'Europe/Lisbon',
    });
  });

  it('lets a timed event end on another day', () => {
    const result = buildEventFields(
      values({
        mode: 'timed',
        startDate: '2026-11-10',
        startTime: '22:00',
        endDate: '2026-11-11',
        endTime: '02:00',
      }),
      'UTC',
      base,
    );
    expect(result.fields?.schedule).toMatchObject({
      start: '2026-11-10T22:00:00.000Z',
      end: '2026-11-11T02:00:00.000Z',
    });
  });

  it('builds a whole-day event with and without an end', () => {
    const one = buildEventFields(values({ mode: 'allDay', startDate: '2026-11-12' }), 'UTC', base);
    expect(one.fields?.schedule).toEqual({ allDay: true, start: '2026-11-12' });
    const many = buildEventFields(
      values({ mode: 'allDay', startDate: '2026-11-12', endDate: '2026-11-14' }),
      'UTC',
      base,
    );
    expect(many.fields?.schedule).toEqual({ allDay: true, start: '2026-11-12', end: '2026-11-14' });
  });

  it('asks for a title', () => {
    const result = buildEventFields(values({ title: '   ' }), 'UTC', base);
    expect(result.fields).toBeNull();
    expect(result.errors).toEqual({ title: 'titleRequired' });
  });

  it('asks for the start date and the start time', () => {
    expect(buildEventFields(values({ mode: 'allDay' }), 'UTC', base).errors).toEqual({
      start: 'startDateRequired',
    });
    expect(
      buildEventFields(values({ mode: 'timed', startDate: '2026-11-10' }), 'UTC', base).errors,
    ).toEqual({ start: 'startTimeRequired' });
  });

  it('asks for the end time when there is an end date', () => {
    const result = buildEventFields(
      values({ mode: 'timed', startDate: '2026-11-10', startTime: '10:00', endDate: '2026-11-11' }),
      'UTC',
      base,
    );
    expect(result.errors).toEqual({ end: 'endTimeRequired' });
  });

  it('rejects an end before the start, with the core rule', () => {
    const timed = buildEventFields(
      values({ mode: 'timed', startDate: '2026-11-10', startTime: '14:00', endTime: '13:00' }),
      'UTC',
      base,
    );
    expect(timed.errors).toEqual({ end: 'endBeforeStart' });
    const allDay = buildEventFields(
      values({ mode: 'allDay', startDate: '2026-11-12', endDate: '2026-11-10' }),
      'UTC',
      base,
    );
    expect(allDay.errors).toEqual({ end: 'endBeforeStart' });
  });

  it('rejects a time zone that does not exist', () => {
    const result = buildEventFields(
      values({ mode: 'timed', startDate: '2026-11-10', startTime: '10:00', timeZone: 'Mars/Base' }),
      'UTC',
      base,
    );
    expect(result.errors).toEqual({ timeZone: 'invalidTimeZone' });
  });

  it('ignores the time zone text when the event is not timed', () => {
    const result = buildEventFields(
      values({ mode: 'allDay', startDate: '2026-11-10', timeZone: 'Mars/Base' }),
      'UTC',
      base,
    );
    expect(result.errors).toEqual({});
  });

  it('keeps good links, skips empty rows and names a link by its address when it has no name', () => {
    const result = buildEventFields(
      values({
        links: [
          { label: ' Portal ', url: ' https://example.com/a ' },
          { label: '', url: 'http://example.org' },
          { label: '', url: '' },
        ],
      }),
      'UTC',
      base,
    );
    expect(result.fields?.links).toEqual([
      { label: 'Portal', url: 'https://example.com/a' },
      { label: 'http://example.org', url: 'http://example.org' },
    ]);
  });

  it('rejects a link without a full web address', () => {
    for (const url of ['example.com', 'javascript:alert(1)', '']) {
      const result = buildEventFields(values({ links: [{ label: 'Site', url }] }), 'UTC', base);
      expect(result.errors).toEqual({ links: 'linkInvalid' });
    }
  });

  it('shows one message per field and keeps the rest of the existing item', () => {
    const existing = createItem({ kind: 'event', title: 'Old', agendaId: 'agenda-1', order: 3 });
    const ok = buildEventFields(values({ title: 'New' }), 'UTC', { ...base, existing });
    expect(ok.fields?.title).toBe('New');
    const bad = buildEventFields(values({ title: '', mode: 'allDay', startDate: '' }), 'UTC', {
      ...base,
      existing,
    });
    expect(bad.errors).toEqual({ title: 'titleRequired', start: 'startDateRequired' });
  });
});

describe('valuesFromItem', () => {
  it('shows a timed event on the display zone, and an end on the same day without an end date', () => {
    const item = createItem({
      kind: 'event',
      title: 'Class',
      agendaId: 'a',
      schedule: {
        allDay: false,
        start: '2026-11-10T17:00:00.000Z',
        end: '2026-11-10T19:30:00.000Z',
      },
    });
    expect(valuesFromItem(item, SAO_PAULO)).toMatchObject({
      mode: 'timed',
      startDate: '2026-11-10',
      startTime: '14:00',
      endDate: '',
      endTime: '16:30',
      timeZone: '',
    });
  });

  it('shows a timed event on its own zone', () => {
    const item = createItem({
      kind: 'event',
      title: 'Flight',
      agendaId: 'a',
      schedule: { allDay: false, start: '2026-11-10T14:00:00.000Z', timeZone: 'Europe/Lisbon' },
    });
    expect(valuesFromItem(item, SAO_PAULO)).toMatchObject({
      startDate: '2026-11-10',
      startTime: '14:00',
      timeZone: 'Europe/Lisbon',
    });
  });

  it('round trips every kind of schedule', () => {
    const schedules = [
      null,
      { allDay: true as const, start: '2026-11-12', end: '2026-11-14' },
      {
        allDay: false as const,
        start: '2026-11-10T22:00:00.000Z',
        end: '2026-11-11T02:00:00.000Z',
        timeZone: 'Europe/Lisbon',
      },
    ];
    for (const schedule of schedules) {
      const item = createItem({
        kind: 'event',
        title: 'X',
        agendaId: 'a',
        schedule,
        notes: 'n',
        links: [{ label: 'L', url: 'https://example.com' }],
      });
      const result = buildEventFields(valuesFromItem(item, SAO_PAULO), SAO_PAULO, {
        agendaId: 'a',
        existing: item,
      });
      expect(result.errors).toEqual({});
      expect(result.fields).toMatchObject({
        title: 'X',
        schedule,
        notes: 'n',
        links: item.links,
      });
    }
  });
});

describe('isHttpUrl', () => {
  it('accepts only http and https', () => {
    expect(isHttpUrl('https://example.com')).toBe(true);
    expect(isHttpUrl('http://example.com/x?y=1')).toBe(true);
    expect(isHttpUrl('ftp://example.com')).toBe(false);
    expect(isHttpUrl('mailto:a@b.c')).toBe(false);
    expect(isHttpUrl('not a url')).toBe(false);
  });
});

describe('tags in the event form', () => {
  it('starts with no tags and inheritance on, and reads them back from an item', () => {
    expect(emptyEventValues()).toMatchObject({ tagIds: [], inheritTags: true });
    const item = createItem({
      kind: 'event',
      title: 'Block',
      agendaId: 'a',
      tagIds: ['t1'],
      inheritTags: false,
    });
    expect(valuesFromItem(item, 'America/Sao_Paulo')).toMatchObject({
      tagIds: ['t1'],
      inheritTags: false,
    });
  });

  it('carries the tags and the switch to the fields, without repeats', () => {
    const result = buildEventFields(
      { ...emptyEventValues(), title: 'Class', tagIds: ['t1', 't1', 't2'], inheritTags: false },
      'America/Sao_Paulo',
      { agendaId: 'a' },
    );
    expect(result.fields).toMatchObject({ tagIds: ['t1', 't2'], inheritTags: false });
  });
});
