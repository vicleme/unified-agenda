import {
  createAgenda,
  createAgendaGroup,
  softDelete,
  type Agenda,
  type AgendaGroup,
} from '../../src/core';
import {
  ALL_AGENDAS,
  EMPTY_FILTER,
  dropUnavailableTags,
  tagsForSelection,
  filterByAgendas,
  groupState,
  isAgendaSelectionActive,
  selectAgendas,
  toggleAgenda,
  toggleGroup,
  visibleAgendaIds,
} from '../../src/filters';
import { createTag } from '../../src/core';
import { testContext } from '../core/helpers';
import { event, titles } from './helpers';

const ctx = testContext();

function agenda(name: string, order: number): Agenda {
  return createAgenda({ name, color: '#3b5bdb', order }, ctx);
}
function group(name: string, members: Agenda[], order = 0): AgendaGroup {
  return createAgendaGroup({ name, agendaIds: members.map((a) => a.id), order }, ctx);
}

const school = agenda('School', 1);
const freelance = agenda('Freelance', 2);
const home = agenda('Home', 3);
const health = agenda('Health', 4);
const agendas = [home, health, school, freelance]; // not in order, on purpose
const personal = group('Personal', [home, health]);
const work = group('Work', [school, freelance]);

describe('visibleAgendaIds', () => {
  it('shows every agenda, in the order of the agendas, when the selection is null', () => {
    expect(visibleAgendaIds(ALL_AGENDAS, agendas)).toEqual([
      school.id,
      freelance.id,
      home.id,
      health.id,
    ]);
  });

  it('shows only the listed agendas', () => {
    expect(visibleAgendaIds([home.id, school.id], agendas)).toEqual([school.id, home.id]);
  });

  it('allows hiding everything with an empty list', () => {
    expect(visibleAgendaIds([], agendas)).toEqual([]);
  });

  it('ignores deleted agendas, so a new agenda is not shown by an explicit list', () => {
    const gone = softDelete(freelance, ctx);
    const list = [school.id, freelance.id];
    expect(visibleAgendaIds(list, [school, gone, home])).toEqual([school.id]);
    expect(visibleAgendaIds(ALL_AGENDAS, [school, gone, home])).toEqual([school.id, home.id]);
    expect(visibleAgendaIds([school.id], [school, home, agenda('New', 9)])).toEqual([school.id]);
  });

  it('falls back to every agenda when all the listed ones are gone', () => {
    const gone = softDelete(freelance, ctx);
    expect(visibleAgendaIds([freelance.id], [school, gone])).toEqual([school.id]);
    expect(visibleAgendaIds(['unknown'], [school, home])).toEqual([school.id, home.id]);
  });
});

describe('isAgendaSelectionActive', () => {
  it('is on only when some agenda is hidden', () => {
    expect(isAgendaSelectionActive(ALL_AGENDAS, agendas)).toBe(false);
    expect(
      isAgendaSelectionActive(
        agendas.map((a) => a.id),
        agendas,
      ),
    ).toBe(false);
    expect(isAgendaSelectionActive([home.id], agendas)).toBe(true);
    expect(isAgendaSelectionActive([], agendas)).toBe(true);
  });

  it('is off when there are no agendas', () => {
    expect(isAgendaSelectionActive([], [])).toBe(false);
  });
});

describe('selectAgendas and toggleAgenda', () => {
  it('turns "everything" into null, so agendas created later show up', () => {
    expect(
      selectAgendas(
        agendas.map((a) => a.id),
        agendas,
      ),
    ).toBeNull();
  });

  it('keeps the agenda order and drops unknown ids', () => {
    expect(selectAgendas([home.id, 'unknown', school.id], agendas)).toEqual([school.id, home.id]);
  });

  it('hides an agenda from "everything", and shows it again', () => {
    const hidden = toggleAgenda(ALL_AGENDAS, home.id, agendas);
    expect(hidden).toEqual([school.id, freelance.id, health.id]);
    expect(toggleAgenda(hidden, home.id, agendas)).toBeNull();
  });

  it('can hide the last shown agenda, leaving an empty list', () => {
    expect(toggleAgenda([home.id], home.id, agendas)).toEqual([]);
    expect(toggleAgenda([], home.id, agendas)).toEqual([home.id]);
  });

  it('changes nothing for an unknown or deleted agenda', () => {
    const selection = [home.id];
    expect(toggleAgenda(selection, 'unknown', agendas)).toBe(selection);
    expect(toggleAgenda(selection, freelance.id, [home, softDelete(freelance, ctx)])).toBe(
      selection,
    );
  });
});

describe('groupState and toggleGroup', () => {
  it('says all, some or none', () => {
    expect(groupState(personal, ALL_AGENDAS, agendas)).toBe('all');
    expect(groupState(personal, [home.id], agendas)).toBe('some');
    expect(groupState(personal, [school.id], agendas)).toBe('none');
  });

  it('counts a group with no agenda, or only deleted ones, as none', () => {
    expect(groupState(group('Empty', []), ALL_AGENDAS, agendas)).toBe('none');
    const onlyGone = group('Gone', [freelance]);
    expect(groupState(onlyGone, ALL_AGENDAS, [home, softDelete(freelance, ctx)])).toBe('none');
  });

  it('hides a group that is fully shown', () => {
    expect(toggleGroup(ALL_AGENDAS, personal, agendas)).toEqual([school.id, freelance.id]);
  });

  it('shows the whole group when only some of it is shown, or none', () => {
    expect(toggleGroup([home.id, school.id], personal, agendas)).toEqual([
      school.id,
      home.id,
      health.id,
    ]);
    expect(toggleGroup([school.id], personal, agendas)).toEqual([school.id, home.id, health.id]);
  });

  it('goes back to null when the group completes the selection', () => {
    expect(toggleGroup([school.id, freelance.id], personal, agendas)).toBeNull();
  });

  it('changes nothing for a group with no agenda', () => {
    const selection = [school.id];
    expect(toggleGroup(selection, group('Empty', []), agendas)).toBe(selection);
  });

  it('lets the group used last decide an agenda that is in two groups', () => {
    const mixed = group('Mixed', [home, school]);
    const afterWork = toggleGroup(ALL_AGENDAS, work, agendas); // hides school and freelance
    expect(afterWork).toEqual([home.id, health.id]);
    expect(toggleGroup(afterWork, mixed, agendas)).toEqual([school.id, home.id, health.id]);
  });
});

describe('filterByAgendas', () => {
  const items = [
    event('School class', { agendaId: school.id }),
    event('Home chore', { agendaId: home.id }),
    event('Client call', { agendaId: freelance.id }),
  ];

  it('returns the same list when the selection is null', () => {
    expect(filterByAgendas(items, ALL_AGENDAS, agendas)).toBe(items);
  });

  it('keeps only the items of shown agendas, in the same order', () => {
    expect(titles(filterByAgendas(items, [freelance.id, school.id], agendas))).toEqual([
      'School class',
      'Client call',
    ]);
  });

  it('returns nothing when everything is hidden', () => {
    expect(filterByAgendas(items, [], agendas)).toEqual([]);
  });
});

describe('tagsForSelection and dropUnavailableTags', () => {
  const global = createTag({ name: 'Global', color: '#3b5bdb' }, ctx);
  const schoolOnly = createTag(
    { name: 'SchoolOnly', color: '#3b5bdb', agendaIds: [school.id] },
    ctx,
  );
  const homeOnly = createTag({ name: 'HomeOnly', color: '#3b5bdb', agendaIds: [home.id] }, ctx);
  const tags = [global, schoolOnly, homeOnly];

  it('offers the tags valid in a shown agenda, marking the partial ones', () => {
    const all = tagsForSelection(tags, ALL_AGENDAS, agendas);
    expect(all.map((entry) => [entry.tag.name, entry.partial])).toEqual([
      ['Global', false],
      ['SchoolOnly', true],
      ['HomeOnly', true],
    ]);
    const onlySchool = tagsForSelection(tags, [school.id], agendas);
    expect(onlySchool.map((entry) => [entry.tag.name, entry.partial])).toEqual([
      ['Global', false],
      ['SchoolOnly', false],
    ]);
  });

  it('offers every tag when all agendas are hidden', () => {
    expect(tagsForSelection(tags, [], agendas)).toHaveLength(3);
  });

  it('takes out of the filter the tags that are not offered, and names them', () => {
    const filter = { ...EMPTY_FILTER, text: 'x', tagIds: [global.id, homeOnly.id, 'unknown'] };
    const result = dropUnavailableTags(filter, tags, [school.id], agendas);
    expect(result.dropped.map((tag) => tag.name)).toEqual(['HomeOnly']);
    expect(result.filter).toEqual({ ...filter, tagIds: [global.id, 'unknown'] });
  });

  it('returns the same filter when nothing is taken out', () => {
    const filter = { ...EMPTY_FILTER, tagIds: [global.id] };
    const result = dropUnavailableTags(filter, tags, [school.id], agendas);
    expect(result.filter).toBe(filter);
    expect(result.dropped).toEqual([]);
    expect(
      dropUnavailableTags({ ...filter, tagIds: [homeOnly.id] }, tags, [], agendas).dropped,
    ).toEqual([]);
  });
});
