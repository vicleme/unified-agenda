import { softDelete, type Item } from '../../src/core';
import {
  EMPTY_FILTER,
  createItemMatcher,
  filterItems,
  isFilterActive,
  normalizeText,
  type ItemFilter,
} from '../../src/filters';
import { event, tag, task, titles } from './helpers';

const filter = (changes: Partial<ItemFilter>): ItemFilter => ({ ...EMPTY_FILTER, ...changes });

describe('text helpers', () => {
  it('ignores case, accents and extra spaces', () => {
    expect(normalizeText('  Ação   RÁPIDA ')).toBe('acao rapida');
  });
});

describe('isFilterActive', () => {
  it('is off for the empty filter and for blank text', () => {
    expect(isFilterActive(EMPTY_FILTER)).toBe(false);
    expect(isFilterActive(filter({ text: '   ' }))).toBe(false);
  });

  it('is on when any sieve is on, and zero days counts', () => {
    expect(isFilterActive(filter({ tagIds: ['t'] }))).toBe(true);
    expect(isFilterActive(filter({ kinds: ['task'] }))).toBe(true);
    expect(isFilterActive(filter({ periods: ['morning'] }))).toBe(true);
    expect(isFilterActive(filter({ text: 'a' }))).toBe(true);
    expect(isFilterActive(filter({ dueWithinDays: 0 }))).toBe(true);
  });

  it('ignores a due within limit that is negative or not whole', () => {
    expect(isFilterActive(filter({ dueWithinDays: -1 }))).toBe(false);
    expect(isFilterActive(filter({ dueWithinDays: 2.5 }))).toBe(false);
  });
});

describe('filterItems: kind', () => {
  const items = [task('Paper'), event('Class')];

  it('keeps everything when no kind is chosen', () => {
    expect(titles(filterItems(items, EMPTY_FILTER, []))).toEqual(['Paper', 'Class']);
  });

  it('keeps only the chosen kinds', () => {
    expect(titles(filterItems(items, filter({ kinds: ['task'] }), []))).toEqual(['Paper']);
    expect(titles(filterItems(items, filter({ kinds: ['event'] }), []))).toEqual(['Class']);
    expect(titles(filterItems(items, filter({ kinds: ['event', 'task'] }), []))).toHaveLength(2);
  });
});

describe('filterItems: text', () => {
  const items = [
    task('Entregar relatório', { notes: 'Estatística aplicada' }),
    event('Aula', { location: 'Sala 12 Bloco B' }),
    event('Dentista'),
  ];
  const find = (text: string) => titles(filterItems(items, filter({ text }), []));

  it('looks in the title, the notes and the location', () => {
    expect(find('relatorio')).toEqual(['Entregar relatório']);
    expect(find('estatistica')).toEqual(['Entregar relatório']);
    expect(find('bloco b')).toEqual(['Aula']);
  });

  it('needs every word, in any order, ignoring case and accents', () => {
    expect(find('APLICADA relatório')).toEqual(['Entregar relatório']);
    expect(find('relatorio sala')).toEqual([]);
  });

  it('does nothing for blank text', () => {
    expect(find('   ')).toHaveLength(3);
  });
});

describe('filterItems: tags', () => {
  const care = tag('Care');
  const gardening = tag('Gardening', care.id);
  const watering = tag('Watering', gardening.id);
  const work = tag('Work');
  const tags = [care, gardening, watering, work];
  const items = [
    task('Water ferns', { tagIds: [watering.id] }),
    task('Buy soil', { tagIds: [gardening.id] }),
    task('Call mom', { tagIds: [care.id] }),
    task('Report', { tagIds: [work.id] }),
    task('No tag'),
  ];
  const find = (tagIds: string[]) => titles(filterItems(items, filter({ tagIds }), tags));

  it('a parent includes its descendants', () => {
    expect(find([care.id])).toEqual(['Water ferns', 'Buy soil', 'Call mom']);
  });

  it('a leaf includes only itself', () => {
    expect(find([watering.id])).toEqual(['Water ferns']);
  });

  it('several tags work as "any of them"', () => {
    expect(find([watering.id, work.id])).toEqual(['Water ferns', 'Report']);
  });

  it('drops a deleted or unknown tag, so the sieve does not match nothing', () => {
    const gone = softDelete(work);
    const withGone = [care, gardening, watering, gone];
    expect(titles(filterItems(items, filter({ tagIds: [work.id] }), withGone))).toHaveLength(5);
    expect(titles(filterItems(items, filter({ tagIds: ['nope'] }), tags))).toHaveLength(5);
    // A deleted one next to a live one: only the live one counts
    expect(
      titles(filterItems(items, filter({ tagIds: [work.id, watering.id] }), withGone)),
    ).toEqual(['Water ferns']);
  });
});

describe('filterItems: inherited tags', () => {
  const garden = tag('Garden');
  const home = tag('Home');
  const tags = [garden, home];
  const parent = task('Garden task', { tagIds: [garden.id] });
  const child = (title: string, extra: Parameters<typeof task>[1] = {}) =>
    task(title, { parentId: parent.id, ...extra });
  const find = (items: Item[], tagIds: string[]) =>
    titles(filterItems(items, filter({ tagIds }), tags));

  it('a child with no tag of its own passes the parent tag, and a grandchild too', () => {
    const buySoil = child('Buy soil');
    const bag = task('Pick a bag', { parentId: buySoil.id });
    expect(find([parent, buySoil, bag], [garden.id])).toEqual([
      'Garden task',
      'Buy soil',
      'Pick a bag',
    ]);
  });

  it('adds its own tags to the inherited ones', () => {
    const urgent = tag('Urgent');
    const block = event('Study block', { parentId: parent.id, tagIds: [urgent.id] });
    const list = (ids: string[]) =>
      titles(filterItems([parent, block], filter({ tagIds: ids }), [...tags, urgent]));
    expect(list([urgent.id])).toEqual(['Study block']);
    expect(list([garden.id])).toEqual(['Garden task', 'Study block']);
  });

  it('stops inheriting when the switch is off', () => {
    const personal = child('Personal', { tagIds: [home.id], inheritTags: false });
    expect(find([parent, personal], [garden.id])).toEqual(['Garden task']);
    expect(find([parent, personal], [home.id])).toEqual(['Personal']);
  });

  it('a parent with the switch off still passes what its parent gives only if its child asks', () => {
    const top = task('Top', { tagIds: [home.id] });
    const middle = task('Middle', { parentId: top.id, inheritTags: false });
    const leaf = task('Leaf', { parentId: middle.id });
    // The leaf inherits from the middle, which has no tags, and the middle does not reach the top
    expect(find([top, middle, leaf], [home.id])).toEqual(['Top']);
  });

  it('finds the parent even when another sieve would drop it', () => {
    const block = event('Study block', { parentId: parent.id });
    const byKind = filterItems(
      [parent, block],
      filter({ tagIds: [garden.id], kinds: ['event'] }),
      tags,
    );
    expect(titles(byKind)).toEqual(['Study block']);
  });

  it('ignores a deleted parent', () => {
    const buySoil = child('Buy soil');
    expect(find([softDelete(parent), buySoil], [garden.id])).not.toContain('Buy soil');
  });

  it('without the item list, only own tags count', () => {
    const match = createItemMatcher(filter({ tagIds: [garden.id] }), tags);
    expect(match(child('Buy soil'))).toBe(false);
    expect(match(parent)).toBe(true);
  });

  it('survives a loop in corrupted data', () => {
    const a = task('A', { tagIds: [home.id] });
    const b = task('B', { parentId: a.id });
    const looped = { ...a, parentId: b.id };
    expect(find([looped, b], [garden.id])).toEqual([]);
  });
});

describe('filterItems: everything together', () => {
  it('needs the item to pass every sieve that is on', () => {
    const work = tag('Work');
    const items = [
      task('Report draft', { tagIds: [work.id] }),
      event('Report meeting', { tagIds: [work.id] }),
      task('Report at home'),
    ];
    const matches = createItemMatcher(
      filter({ tagIds: [work.id], kinds: ['task'], text: 'report' }),
      [work],
    );
    expect(titles(items.filter(matches))).toEqual(['Report draft']);
  });
});
