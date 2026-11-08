import { createDefaultStatuses, doneStatusIds } from '../../src/core';
import { testContext } from './helpers';

describe('default statuses', () => {
  it('create the three groups with their starting columns', () => {
    const { groups, statuses } = createDefaultStatuses((key) => `label:${key}`, testContext());
    expect(groups.map((g) => [g.name, g.role])).toEqual([
      ['label:planned', 'planned'],
      ['label:started', 'started'],
      ['label:done', 'done'],
    ]);
    expect(statuses.map((s) => s.name)).toEqual([
      'label:idealized',
      'label:paused',
      'label:scheduled',
      'label:started',
      'label:inProgress',
      'label:done',
      'label:delivered',
    ]);
  });

  it('mark Done and Delivered as done', () => {
    const { groups, statuses } = createDefaultStatuses((key) => key, testContext());
    const done = doneStatusIds(statuses, groups);
    const names = statuses.filter((s) => done.has(s.id)).map((s) => s.name);
    expect(names).toEqual(['done', 'delivered']);
  });
});
