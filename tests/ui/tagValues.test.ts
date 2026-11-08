import { createTag, softDelete } from '../../src/core';
import { flattenTagTree, possibleParents } from '../../src/ui/tagValues';

const make = (name: string, parentId: string | null = null) =>
  createTag({ name, color: '#3b5bdb', parentId });

describe('flattenTagTree', () => {
  it('lists each tag before its sub-tags, siblings by name, with the depth', () => {
    const work = make('Work');
    const home = make('Home');
    const reports = make('Reports', work.id);
    const ads = make('Ads', work.id);
    const deep = make('Draft', reports.id);
    const rows = flattenTagTree([work, deep, reports, home, ads], 'en');
    expect(rows.map((row) => [row.tag.name, row.depth])).toEqual([
      ['Home', 0],
      ['Work', 0],
      ['Ads', 1],
      ['Reports', 1],
      ['Draft', 2],
    ]);
  });

  it('sorts by the language of the person', () => {
    const rows = flattenTagTree([make('Éter'), make('Zebra'), make('Ana')], 'pt-BR');
    expect(rows.map((row) => row.tag.name)).toEqual(['Ana', 'Éter', 'Zebra']);
  });

  it('hides deleted tags and shows an orphan at the top level', () => {
    const parent = make('Parent');
    const orphan = make('Orphan', parent.id);
    const rows = flattenTagTree([softDelete(parent), orphan], 'en');
    expect(rows.map((row) => [row.tag.name, row.depth])).toEqual([['Orphan', 0]]);
  });

  it('does not loop on corrupted data', () => {
    const a = make('A');
    const b = make('B', a.id);
    expect(() => flattenTagTree([{ ...a, parentId: b.id }, b], 'en')).not.toThrow();
  });
});

describe('possibleParents', () => {
  it('leaves out the tag and everything inside it', () => {
    const a = make('A');
    const b = make('B', a.id);
    const c = make('C', b.id);
    const d = make('D');
    expect(possibleParents(a, [a, b, c, d]).map((tag) => tag.name)).toEqual(['D']);
    expect(possibleParents(c, [a, b, c, d]).map((tag) => tag.name)).toEqual(['A', 'B', 'D']);
    expect(possibleParents(null, [a, b]).map((tag) => tag.name)).toEqual(['A', 'B']);
  });
});
