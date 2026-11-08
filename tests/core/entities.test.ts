import {
  createAgenda,
  createItem,
  createTag,
  defaultContext,
  isActive,
  softDelete,
  updateEntity,
} from '../../src/core';
import { testContext } from './helpers';

describe('entities', () => {
  it('create with the four sync fields', () => {
    const ctx = testContext();
    const agenda = createAgenda({ name: 'College', color: '#3b5bdb' }, ctx);
    expect(agenda).toMatchObject({
      id: 'id-1',
      createdAt: '2026-11-07T12:00:00.000Z',
      updatedAt: '2026-11-07T12:00:00.000Z',
      deletedAt: null,
    });
  });

  it('create items with safe defaults', () => {
    const item = createItem({ kind: 'task', title: 'Read', agendaId: 'a' }, testContext());
    expect(item).toMatchObject({
      parentId: null,
      notes: '',
      schedule: null,
      from: null,
      due: null,
      tagIds: [],
      inheritTags: true,
      statusId: null,
      location: '',
      links: [],
    });
  });

  it('generate real UUIDs by default', () => {
    const tag = createTag({ name: 'x', color: '#000000' });
    expect(tag.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(defaultContext.now()).toMatch(/Z$/);
  });

  it('update keeps createdAt and refreshes updatedAt without touching the original', () => {
    const ctx = testContext();
    const original = createAgenda({ name: 'Home', color: '#000000' }, ctx);
    ctx.tick();
    const changed = updateEntity(original, { name: 'House' }, ctx);
    expect(changed.name).toBe('House');
    expect(changed.createdAt).toBe(original.createdAt);
    expect(changed.updatedAt).toBe('2026-11-07T12:00:01.000Z');
    expect(original.name).toBe('Home');
  });

  it('soft delete sets a tombstone and keeps the first deletion time', () => {
    const ctx = testContext();
    const agenda = createAgenda({ name: 'Home', color: '#000000' }, ctx);
    ctx.tick();
    const deleted = softDelete(agenda, ctx);
    expect(deleted.deletedAt).toBe('2026-11-07T12:00:01.000Z');
    expect(isActive(deleted)).toBe(false);
    expect(isActive(agenda)).toBe(true);

    ctx.tick();
    expect(softDelete(deleted, ctx)).toBe(deleted);
  });
});
