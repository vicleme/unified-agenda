import { createSavedView, EMPTY_SAVED_FILTER, SAVED_VIEW_LAYOUTS } from '../../src/core';
import { AGENDA_LAYOUTS, EMPTY_FILTER, type ItemFilter } from '../../src/filters';
import { testContext } from './helpers';

describe('createSavedView', () => {
  it('starts as "everything, mixed": no sieve, every agenda, one list', () => {
    const view = createSavedView({ name: 'All' }, testContext());
    expect(view).toMatchObject({
      id: 'id-1',
      name: 'All',
      order: 0,
      agendaIds: null,
      layout: 'mixed',
      deletedAt: null,
    });
    expect(view.filter).toEqual(EMPTY_SAVED_FILTER);
  });

  it('keeps what it was given, and copies the lists', () => {
    const filter = {
      tagIds: ['t1'],
      kinds: ['task' as const],
      periods: ['morning' as const, 'untimed' as const],
      text: 'paper',
      dueWithinDays: 3,
    };
    const agendaIds = ['a1', 'a2'];
    const view = createSavedView(
      { name: 'Study', order: 2, filter, agendaIds, layout: 'grouped' },
      testContext(),
    );
    expect(view).toMatchObject({ order: 2, layout: 'grouped', filter, agendaIds });

    filter.tagIds.push('t2');
    agendaIds.push('a3');
    expect(view.filter.tagIds).toEqual(['t1']);
    expect(view.agendaIds).toEqual(['a1', 'a2']);
  });

  it('never shares lists with the empty filter', () => {
    const view = createSavedView({ name: 'A' }, testContext());
    view.filter.tagIds.push('x');
    expect(EMPTY_SAVED_FILTER.tagIds).toEqual([]);
    expect(createSavedView({ name: 'B' }, testContext()).filter.tagIds).toEqual([]);
  });

  it('keeps an empty list of agendas, which means "show nothing"', () => {
    expect(createSavedView({ name: 'None', agendaIds: [] }, testContext()).agendaIds).toEqual([]);
  });
});

describe('saved views and the filters layer', () => {
  it('store a filter in the same shape as ItemFilter', () => {
    // Each side must fit the other, or this file stops compiling
    const asItemFilter: ItemFilter = EMPTY_SAVED_FILTER;
    const asSavedFilter: typeof EMPTY_SAVED_FILTER = EMPTY_FILTER;
    expect(asItemFilter).toEqual(asSavedFilter);
  });

  it('offer the same layouts', () => {
    expect([...SAVED_VIEW_LAYOUTS]).toEqual([...AGENDA_LAYOUTS]);
  });
});
