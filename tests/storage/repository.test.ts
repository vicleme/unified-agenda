import Dexie from 'dexie';
import { createAgenda, createSavedView } from '../../src/core';
import {
  createDatabase,
  createRepositories,
  ensureDefaultStatuses,
  isPristine,
  loadSettings,
  saveSettings,
  normalizeSettings,
} from '../../src/storage';
import { testContext } from '../core/helpers';
import { label, openTestDb, sampleData, fill } from './helpers';

describe('repository', () => {
  it('stores and reads an entity back', async () => {
    const repos = createRepositories(openTestDb());
    const agenda = createAgenda({ name: 'Home', color: '#000000' }, testContext());
    await repos.agendas.put(agenda);
    expect(await repos.agendas.get(agenda.id)).toEqual(agenda);
    expect(await repos.agendas.get('missing')).toBeUndefined();
  });

  it('keeps data after the database is closed and opened again', async () => {
    const db = openTestDb('reopen-test');
    const agenda = createAgenda({ name: 'Home', color: '#000000' }, testContext());
    await createRepositories(db).agendas.put(agenda);
    db.close();

    const again = createDatabase('reopen-test');
    try {
      expect(await createRepositories(again).agendas.list()).toEqual([agenda]);
    } finally {
      again.close();
    }
  });

  it('updates fields and refreshes updatedAt', async () => {
    const repos = createRepositories(openTestDb());
    const ctx = testContext();
    const agenda = createAgenda({ name: 'Home', color: '#000000' }, ctx);
    await repos.agendas.put(agenda);
    ctx.tick();

    const changed = await repos.agendas.update(agenda.id, { name: 'House' }, ctx);
    expect(changed).toMatchObject({ name: 'House', createdAt: agenda.createdAt });
    expect(changed?.updatedAt).toBe('2026-11-07T12:00:01.000Z');
    expect((await repos.agendas.get(agenda.id))?.name).toBe('House');
    expect(await repos.agendas.update('missing', { name: 'x' }, ctx)).toBeUndefined();
  });

  it('deletes by marking, hides tombstones and can list them', async () => {
    const repos = createRepositories(openTestDb());
    const ctx = testContext();
    const keep = createAgenda({ name: 'Keep', color: '#000000' }, ctx);
    const drop = createAgenda({ name: 'Drop', color: '#000000' }, ctx);
    await repos.agendas.putMany([keep, drop]);
    ctx.tick();

    const removed = await repos.agendas.remove(drop.id, ctx);
    expect(removed?.deletedAt).toBe('2026-11-07T12:00:01.000Z');
    expect((await repos.agendas.list()).map((a) => a.name)).toEqual(['Keep']);
    expect(await repos.agendas.list({ includeDeleted: true })).toHaveLength(2);
    expect(await repos.agendas.get(drop.id)).toBeDefined();

    ctx.tick();
    const twice = await repos.agendas.remove(drop.id, ctx);
    expect(twice?.deletedAt).toBe('2026-11-07T12:00:01.000Z');
    expect(await repos.agendas.remove('missing', ctx)).toBeUndefined();
  });

  it('finds items by tag through the multi entry index', async () => {
    const db = openTestDb();
    const data = sampleData();
    await fill(db, data);
    const found = await db.items.where('tagIds').equals(data.tag.id).toArray();
    expect(found.map((i) => i.id)).toEqual([data.task.id]);
    expect(await db.items.where('parentId').equals(data.task.id).count()).toBe(1);
  });

  it('is pristine until something is created', async () => {
    const db = openTestDb();
    expect(await isPristine(db)).toBe(true);
    await ensureDefaultStatuses(db, label);
    expect(await isPristine(db)).toBe(true);
    await createRepositories(db).agendas.put(createAgenda({ name: 'A', color: '#000000' }));
    expect(await isPristine(db)).toBe(false);
  });
});

describe('settings', () => {
  it('starts with the defaults', async () => {
    expect(await loadSettings(openTestDb())).toEqual({
      displayTimeZone: 'auto',
      periodBounds: { morningStart: 6, afternoonStart: 12, eveningStart: 18 },
    });
  });

  it('saves and loads', async () => {
    const db = openTestDb();
    const settings = {
      displayTimeZone: 'Europe/Lisbon',
      periodBounds: { morningStart: 5, afternoonStart: 13, eveningStart: 19 },
    };
    await saveSettings(db, settings);
    expect(await loadSettings(db)).toEqual(settings);
  });

  it('refuses invalid settings without saving them', async () => {
    const db = openTestDb();
    const good = normalizeSettings(null);
    await expect(saveSettings(db, { ...good, displayTimeZone: 'Mars/Olympus' })).rejects.toThrow(
      RangeError,
    );
    await expect(
      saveSettings(db, {
        ...good,
        periodBounds: { morningStart: 12, afternoonStart: 6, eveningStart: 18 },
      }),
    ).rejects.toThrow(RangeError);
    expect(await loadSettings(db)).toEqual(good);
  });

  it('replaces each bad stored part with its default', () => {
    const defaults = normalizeSettings(null);
    expect(normalizeSettings({ displayTimeZone: 'Nowhere/Land', periodBounds: 7 })).toEqual(
      defaults,
    );
    expect(
      normalizeSettings({ displayTimeZone: 'Asia/Tokyo', periodBounds: { morningStart: 1 } }),
    ).toEqual({ ...defaults, displayTimeZone: 'Asia/Tokyo' });
  });
});

describe('default statuses', () => {
  it('are created once', async () => {
    const db = openTestDb();
    expect(await ensureDefaultStatuses(db, label)).toBe(true);
    expect(await db.statusGroups.count()).toBe(3);
    expect(await db.statuses.count()).toBe(7);
    expect(await ensureDefaultStatuses(db, label)).toBe(false);
    expect(await db.statusGroups.count()).toBe(3);
  });

  it('do not come back after the person deletes every group', async () => {
    const db = openTestDb();
    await ensureDefaultStatuses(db, label);
    await db.statusGroups.clear();
    await db.statuses.clear();
    expect(await ensureDefaultStatuses(db, label)).toBe(false);
    expect(await db.statusGroups.count()).toBe(0);
  });

  it('are skipped when status groups already exist', async () => {
    const db = openTestDb();
    await db.statusGroups.put(sampleData().groups[0]!);
    expect(await ensureDefaultStatuses(db, label)).toBe(false);
    expect(await db.statusGroups.count()).toBe(1);
  });

  it('use the names the caller gives', async () => {
    const db = openTestDb();
    await ensureDefaultStatuses(db, (key) => `pt:${key}`);
    expect((await db.statusGroups.toArray()).map((g) => g.name).sort()).toEqual([
      'pt:done',
      'pt:planned',
      'pt:started',
    ]);
  });
});

describe('saved views table', () => {
  it('stores, lists, updates and removes a view like any other entity', async () => {
    const repos = createRepositories(openTestDb());
    const ctx = testContext();
    const view = createSavedView({ name: 'School', agendaIds: ['a1'], layout: 'separate' }, ctx);
    await repos.savedViews.put(view);
    expect(await repos.savedViews.get(view.id)).toEqual(view);

    ctx.tick();
    const renamed = await repos.savedViews.update(view.id, { name: 'College' }, ctx);
    expect(renamed).toMatchObject({ name: 'College', layout: 'separate' });
    expect(renamed!.updatedAt).not.toBe(view.updatedAt);

    ctx.tick();
    await repos.savedViews.remove(view.id, ctx);
    expect(await repos.savedViews.list()).toEqual([]);
    expect(await repos.savedViews.list({ includeDeleted: true })).toHaveLength(1);
  });

  it('can be listed in order through the index', async () => {
    const db = openTestDb();
    const ctx = testContext();
    await db.savedViews.bulkPut([
      createSavedView({ name: 'B', order: 1 }, ctx),
      createSavedView({ name: 'A', order: 0 }, ctx),
    ]);
    expect((await db.savedViews.orderBy('order').toArray()).map((v) => v.name)).toEqual(['A', 'B']);
  });

  it('is added to a database that was created on version 1, keeping its data', async () => {
    const name = 'upgrade-test';
    const old = new Dexie(name);
    old.version(1).stores({
      agendas: 'id, order, updatedAt, deletedAt',
      agendaGroups: 'id, order, updatedAt, deletedAt',
      items: 'id, parentId, agendaId, statusId, *tagIds, updatedAt, deletedAt',
      tags: 'id, parentId, updatedAt, deletedAt',
      statusGroups: 'id, order, updatedAt, deletedAt',
      statuses: 'id, groupId, order, updatedAt, deletedAt',
      meta: 'key',
    });
    const agenda = createAgenda({ name: 'Home', color: '#000000' }, testContext());
    await old.table('agendas').put(agenda);
    old.close();

    const db = openTestDb(name);
    expect(await db.agendas.toArray()).toEqual([agenda]);
    expect(await db.savedViews.toArray()).toEqual([]);
    const view = createSavedView({ name: 'New' }, testContext());
    await db.savedViews.put(view);
    expect(await db.savedViews.get(view.id)).toEqual(view);
  });
});
