import {
  computeProgress,
  createItem,
  defaultDoneStatusId,
  doneStatusIds,
  softDelete,
  type Item,
} from '../../src/core';
import { testContext, testStatuses } from './helpers';

function setup() {
  const ctx = testContext();
  const s = testStatuses(ctx);
  const statuses = [s.planned, s.started, s.done];
  const done = doneStatusIds(statuses, s.groups);
  const task = (title: string, parentId: string | null, statusId: string | null) =>
    createItem({ kind: 'task', title, agendaId: 'a', parentId, statusId }, ctx);
  const event = (title: string, parentId: string | null = null) =>
    createItem({ kind: 'event', title, agendaId: 'a', parentId }, ctx);
  return { ctx, s, done, task, event };
}

describe('progress', () => {
  it('finds the statuses that count as done', () => {
    const { s, done } = setup();
    expect(done).toEqual(new Set([s.done.id]));
  });

  it('treats a lone task as 1 of 1 or 0 of 1', () => {
    const { s, done, task } = setup();
    const open = task('open', null, s.started.id);
    const finished = task('finished', null, s.done.id);
    const result = computeProgress([open, finished], done);
    expect(result.get(open.id)).toEqual({ completed: 0, total: 1, ratio: 0 });
    expect(result.get(finished.id)).toEqual({ completed: 1, total: 1, ratio: 1 });
  });

  it('computes a parent from its children and ignores the parent status', () => {
    const { s, done, task } = setup();
    const parent = task('parent', null, s.done.id);
    const kids = [
      task('1', parent.id, s.done.id),
      task('2', parent.id, s.planned.id),
      task('3', parent.id, s.done.id),
      task('4', parent.id, null),
    ];
    const result = computeProgress([parent, ...kids], done);
    expect(result.get(parent.id)).toEqual({ completed: 2, total: 4, ratio: 0.5 });
  });

  it('is recursive, counting leaves at any depth', () => {
    const { s, done, task } = setup();
    const root = task('root', null, null);
    const a = task('a', root.id, null);
    const a1 = task('a1', a.id, s.done.id);
    const a2 = task('a2', a.id, s.done.id);
    const b = task('b', root.id, s.planned.id);
    const result = computeProgress([root, a, a1, a2, b], done);
    expect(result.get(a.id)).toEqual({ completed: 2, total: 2, ratio: 1 });
    expect(result.get(root.id)).toEqual({ completed: 2, total: 3, ratio: 2 / 3 });
  });

  it('ignores events, but counts tasks inside them', () => {
    const { s, done, task, event } = setup();
    const lone = event('lone event');
    const holder = event('holder');
    const inside = task('inside', holder.id, s.done.id);
    const noTasks = event('child event', lone.id);
    const result = computeProgress([lone, noTasks, holder, inside], done);
    expect(result.has(lone.id)).toBe(false);
    expect(result.has(noTasks.id)).toBe(false);
    expect(result.get(holder.id)).toEqual({ completed: 1, total: 1, ratio: 1 });
  });

  it('falls back to the own status when children are only events', () => {
    const { s, done, task, event } = setup();
    const parent = task('parent', null, s.done.id);
    const child = event('child', parent.id);
    expect(computeProgress([parent, child], done).get(parent.id)?.ratio).toBe(1);
  });

  it('ignores deleted items', () => {
    const { ctx, s, done, task } = setup();
    const parent = task('parent', null, null);
    const kept = task('kept', parent.id, s.done.id);
    const removed = softDelete(task('removed', parent.id, s.planned.id), ctx);
    const result = computeProgress([parent, kept, removed], done);
    expect(result.get(parent.id)).toEqual({ completed: 1, total: 1, ratio: 1 });
    expect(result.has(removed.id)).toBe(false);
  });

  it('handles a very deep tree without overflowing the stack', () => {
    const { s, done, task } = setup();
    const items: Item[] = [];
    let parentId: string | null = null;
    for (let i = 0; i < 20_000; i++) {
      const node = task(`n${i}`, parentId, i === 19_999 ? s.done.id : null);
      items.push(node);
      parentId = node.id;
    }
    const result = computeProgress(items, done);
    expect(result.get(items[0]!.id)).toEqual({ completed: 1, total: 1, ratio: 1 });
  });

  it('does not hang on a cycle', () => {
    const { s, done, task } = setup();
    const a = task('a', null, s.done.id);
    const b = task('b', a.id, s.done.id);
    const cyclic = { ...a, parentId: b.id };
    expect(() => computeProgress([cyclic, b], done)).not.toThrow();
  });

  it('picks the first status of the done group as the one a finished task gets', () => {
    const { s } = setup();
    const statuses = [s.planned, s.started, s.done];
    expect(defaultDoneStatusId(statuses, s.groups)).toBe(s.done.id);
  });

  it('skips deleted done statuses and returns null when none is left', () => {
    const { ctx, s } = setup();
    const extra = { ...s.done, id: 'extra', order: 5 };
    expect(defaultDoneStatusId([s.planned, softDelete(s.done, ctx), extra], s.groups)).toBe(
      'extra',
    );
    expect(defaultDoneStatusId([s.planned, softDelete(s.done, ctx)], s.groups)).toBeNull();
    expect(defaultDoneStatusId([s.planned, s.started], s.groups)).toBeNull();
  });

  it('uses the lowest order inside the done group', () => {
    const { s } = setup();
    const later = { ...s.done, id: 'later', order: 3 };
    const sooner = { ...s.done, id: 'sooner', order: 1 };
    expect(defaultDoneStatusId([later, sooner], s.groups)).toBe('sooner');
  });
});
