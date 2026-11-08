import { createAgenda, createItem, createSavedView, type Item } from '../../src/core';
import {
  BACKUP_FORMAT,
  backupFileName,
  exportBackup,
  importBackup,
  importBackupText,
  isPristine,
  loadSettings,
  parseBackup,
  saveSettings,
  serializeBackup,
  createRepositories,
  ensureDefaultStatuses,
} from '../../src/storage';
import { testContext } from '../core/helpers';
import { fill, label, openTestDb, sampleData } from './helpers';

const NOW = () => '2026-11-07T20:00:00.000Z';

async function snapshot(db: ReturnType<typeof openTestDb>) {
  const sorted = <T extends { id: string }>(list: T[]) =>
    [...list].sort((a, b) => (a.id < b.id ? -1 : 1));
  return {
    agendas: sorted(await db.agendas.toArray()),
    groups: sorted(await db.statusGroups.toArray()),
    statuses: sorted(await db.statuses.toArray()),
    tags: sorted(await db.tags.toArray()),
    items: sorted(await db.items.toArray()),
    savedViews: sorted(await db.savedViews.toArray()),
  };
}

/** Parses text and expects it to fail, returning the issues. */
function issuesOf(text: string) {
  const result = parseBackup(text);
  if (result.ok) throw new Error('expected the file to be refused');
  return result.issues;
}

describe('export', () => {
  it('writes the format, the version and all the data', async () => {
    const db = openTestDb();
    const data = sampleData();
    await fill(db, data);
    const backup = await exportBackup(db, { now: NOW });
    expect(backup).toMatchObject({
      format: BACKUP_FORMAT,
      version: 1,
      exportedAt: NOW(),
      settings: null,
    });
    expect(backup.data.agendas).toEqual([data.agenda]);
    expect(backup.data.items).toHaveLength(2);
    expect(backup.data.statusGroups).toHaveLength(3);
    expect(backup.data.statuses).toHaveLength(7);
    expect(backupFileName(NOW())).toBe('unified-agenda-2026-11-07.json');
  });

  it('keeps tombstones by default and can leave them out', async () => {
    const db = openTestDb();
    const data = sampleData();
    await fill(db, data);
    await createRepositories(db).items.remove(data.block.id);
    expect((await exportBackup(db)).data.items).toHaveLength(2);
    const clean = await exportBackup(db, { includeDeleted: false });
    expect(clean.data.items.map((i) => i.id)).toEqual([data.task.id]);
  });

  it('includes the settings only when they were saved', async () => {
    const db = openTestDb();
    const settings = {
      displayTimeZone: 'Europe/Lisbon',
      periodBounds: { morningStart: 5, afternoonStart: 13, eveningStart: 19 },
    };
    await saveSettings(db, settings);
    expect((await exportBackup(db)).settings).toEqual(settings);
  });
});

describe('round trip', () => {
  it('rebuilds exactly the same data on another device', async () => {
    const source = openTestDb();
    await fill(source, sampleData());
    await createRepositories(source).items.remove(sampleData().block.id);
    await saveSettings(source, {
      displayTimeZone: 'Asia/Tokyo',
      periodBounds: { morningStart: 5, afternoonStart: 12, eveningStart: 20 },
    });
    const text = serializeBackup(await exportBackup(source, { now: NOW }));

    const target = openTestDb();
    const result = await importBackupText(target, text, 'replace');
    expect(result.ok).toBe(true);
    expect(await snapshot(target)).toEqual(await snapshot(source));
    expect(await loadSettings(target)).toEqual(await loadSettings(source));
  });

  it('survives text with accents and quotes', async () => {
    const source = openTestDb();
    const data = sampleData();
    const odd: Item = {
      ...data.task,
      title: 'Redação "final" ✓ \\ 日本',
      notes: 'linha 1\nlinha 2',
    };
    await fill(source, { ...data, task: odd });
    const text = serializeBackup(await exportBackup(source));
    const target = openTestDb();
    await importBackupText(target, text, 'replace');
    expect(await target.items.get(odd.id)).toEqual(odd);
  });

  it('handles a few thousand items', async () => {
    const source = openTestDb();
    const data = sampleData();
    // Real random ids, so none of them collides with the predictable ids of the sample data
    const many = Array.from({ length: 3000 }, (_, i) =>
      createItem({ kind: 'event', title: `Event ${i}`, agendaId: data.agenda.id }),
    );
    await fill(source, data);
    await source.items.bulkPut(many);
    const text = serializeBackup(await exportBackup(source));
    const target = openTestDb();
    const result = await importBackupText(target, text, 'replace');
    expect(result.ok && result.summary.items.added).toBe(3002);
    expect(await target.items.count()).toBe(3002);
  });
});

describe('merge', () => {
  it('adds what is new and leaves the rest alone', async () => {
    const db = openTestDb();
    const local = createAgenda({ name: 'Local', color: '#000000' });
    await db.agendas.put(local);

    const other = openTestDb();
    const remote = sampleData(testContext(Date.UTC(2026, 10, 8)));
    await fill(other, remote);
    const result = await importBackup(db, await exportBackup(other), 'merge');

    expect(result.ok && result.summary.agendas).toEqual({ added: 1, updated: 0, skipped: 0 });
    expect((await db.agendas.toArray()).map((a) => a.name).sort()).toEqual(['College', 'Local']);
  });

  it('keeps the newest version of an item and skips the older one', async () => {
    const ctx = testContext();
    const data = sampleData(ctx);
    const db = openTestDb();
    await fill(db, data);

    ctx.tick();
    const newer: Item = { ...data.task, title: 'Newer', updatedAt: ctx.now() };
    ctx.tick();
    const newest: Item = { ...data.block, title: 'Newest', updatedAt: ctx.now() };
    const older: Item = { ...data.block, title: 'Older', updatedAt: '2026-01-01T00:00:00.000Z' };

    const source = openTestDb();
    await fill(source, { ...data, task: newer, block: older });
    const result = await importBackup(db, await exportBackup(source), 'merge');
    expect(result.ok && result.summary.items).toEqual({ added: 0, updated: 1, skipped: 1 });
    expect((await db.items.get(data.task.id))?.title).toBe('Newer');
    expect((await db.items.get(data.block.id))?.title).toBe('Work on paper');

    const again = openTestDb();
    await fill(again, { ...data, block: newest });
    await importBackup(db, await exportBackup(again), 'merge');
    expect((await db.items.get(data.block.id))?.title).toBe('Newest');
  });

  it('keeps the local version on a tie', async () => {
    const data = sampleData();
    const db = openTestDb();
    await fill(db, data);
    const source = openTestDb();
    await fill(source, { ...data, task: { ...data.task, title: 'Same time, other text' } });
    const result = await importBackup(db, await exportBackup(source), 'merge');
    expect(result.ok && result.summary.items.skipped).toBe(2);
    expect((await db.items.get(data.task.id))?.title).toBe('Paper');
  });

  it('carries a deletion to the other device', async () => {
    const ctx = testContext();
    const data = sampleData(ctx);
    const db = openTestDb();
    await fill(db, data);
    const source = openTestDb();
    await fill(source, data);
    ctx.tick();
    await createRepositories(source).items.remove(data.block.id, ctx);

    await importBackup(db, await exportBackup(source), 'merge');
    expect((await db.items.get(data.block.id))?.deletedAt).toBe(ctx.now());
    expect(await createRepositories(db).items.list()).toHaveLength(1);
  });

  it('takes the settings from the file only when none are saved here', async () => {
    const fileSettings = {
      displayTimeZone: 'Europe/Lisbon',
      periodBounds: { morningStart: 5, afternoonStart: 13, eveningStart: 19 },
    };
    const source = openTestDb();
    await saveSettings(source, fileSettings);
    const backup = await exportBackup(source);

    const fresh = openTestDb();
    const first = await importBackup(fresh, backup, 'merge');
    expect(first.ok && first.summary.settingsApplied).toBe(true);
    expect((await loadSettings(fresh)).displayTimeZone).toBe('Europe/Lisbon');

    const configured = openTestDb();
    await saveSettings(configured, { ...fileSettings, displayTimeZone: 'Asia/Tokyo' });
    const second = await importBackup(configured, backup, 'merge');
    expect(second.ok && second.summary.settingsApplied).toBe(false);
    expect((await loadSettings(configured)).displayTimeZone).toBe('Asia/Tokyo');
  });
});

describe('replace', () => {
  it('erases what is not in the file', async () => {
    const db = openTestDb();
    await fill(db, sampleData());
    await saveSettings(db, {
      displayTimeZone: 'Asia/Tokyo',
      periodBounds: { morningStart: 6, afternoonStart: 12, eveningStart: 18 },
    });

    const other = sampleData(testContext(Date.UTC(2026, 10, 9)));
    const source = openTestDb();
    await fill(source, other);
    await importBackup(db, await exportBackup(source), 'replace');

    expect(await snapshot(db)).toEqual(await snapshot(source));
    expect((await loadSettings(db)).displayTimeZone).toBe('auto');
  });

  it('refuses a file whose references point outside of it, and changes nothing', async () => {
    const db = openTestDb();
    const data = sampleData();
    await fill(db, data);
    const before = await snapshot(db);

    const source = openTestDb();
    await fill(source, data);
    const backup = await exportBackup(source);
    backup.data.agendas = [];
    const result = await importBackup(db, backup, 'replace');

    expect(result.ok).toBe(false);
    expect(!result.ok && result.issues.every((i) => i.code === 'danglingReference')).toBe(true);
    expect(!result.ok && result.issues.map((i) => i.path)).toContain('data.items[0].agendaId');
    expect(await snapshot(db)).toEqual(before);
  });

  it('lets a partial file merge, since the rest is already here', async () => {
    const db = openTestDb();
    const data = sampleData();
    await fill(db, data);
    const source = openTestDb();
    await fill(source, data);
    const backup = await exportBackup(source);
    backup.data.agendas = [];
    const result = await importBackup(db, backup, 'merge');
    expect(result.ok).toBe(true);
  });
});

describe('default statuses and imports', () => {
  it('do not appear after an import into a fresh install', async () => {
    const source = openTestDb();
    await fill(source, sampleData());
    const text = serializeBackup(await exportBackup(source));

    const db = openTestDb();
    expect(await isPristine(db)).toBe(true);
    await importBackupText(db, text, 'replace');
    expect(await ensureDefaultStatuses(db, label)).toBe(false);
    expect(await db.statusGroups.count()).toBe(3);
  });
});

describe('refusing bad files', () => {
  const valid = async () => {
    const source = openTestDb();
    await fill(source, sampleData());
    return JSON.parse(serializeBackup(await exportBackup(source, { now: NOW })));
  };

  it('refuses text that is not JSON and JSON that is not a backup', () => {
    expect(issuesOf('not json at all')).toEqual([{ path: '', code: 'notJson' }]);
    expect(issuesOf('[]')).toEqual([{ path: 'format', code: 'notBackup' }]);
    expect(issuesOf('{"format":"other"}')).toEqual([{ path: 'format', code: 'notBackup' }]);
    expect(issuesOf(JSON.stringify({ format: BACKUP_FORMAT }))).toEqual([
      { path: 'version', code: 'notBackup' },
    ]);
  });

  it('refuses a version this app does not know', async () => {
    const file = await valid();
    file.version = 2;
    expect(issuesOf(JSON.stringify(file))).toEqual([
      { path: 'version', code: 'unsupportedVersion' },
    ]);
  });

  it('points to every wrong field and writes nothing', async () => {
    const file = await valid();
    file.data.items[0].title = '   ';
    file.data.items[1].createdAt = 'yesterday';
    file.data.agendas[0].order = 'first';
    const issues = issuesOf(JSON.stringify(file));
    expect(issues).toEqual(
      expect.arrayContaining([
        { path: 'data.agendas[0].order', code: 'invalidField' },
        { path: 'data.items[1].createdAt', code: 'invalidField' },
      ]),
    );

    const db = openTestDb();
    const result = await importBackupText(db, JSON.stringify(file), 'replace');
    expect(result.ok).toBe(false);
    expect(await isPristine(db)).toBe(true);
  });

  it('reads an older backup without inheritTags as switched on', async () => {
    const file = await valid();
    for (const item of file.data.items) delete item.inheritTags;
    const result = parseBackup(JSON.stringify(file));
    if (!result.ok) throw new Error('expected the file to be accepted');
    expect(result.backup.data.items.every((item: Item) => item.inheritTags === true)).toBe(true);
  });

  it('keeps a switched off inheritTags and refuses one that is not true or false', async () => {
    const file = await valid();
    file.data.items[0].inheritTags = false;
    const result = parseBackup(JSON.stringify(file));
    if (!result.ok) throw new Error('expected the file to be accepted');
    expect(result.backup.data.items[0]?.inheritTags).toBe(false);

    file.data.items[0].inheritTags = 'yes';
    expect(issuesOf(JSON.stringify(file))).toEqual([
      { path: 'data.items[0].inheritTags', code: 'invalidField' },
    ]);
  });

  it('applies the item rules of the core', async () => {
    const file = await valid();
    file.data.items[0].title = '';
    expect(issuesOf(JSON.stringify(file))).toEqual([
      { path: 'data.items[0].item', code: 'invalidItem', detail: 'titleRequired' },
    ]);

    const mixed = await valid();
    mixed.data.items[0].schedule = { allDay: true, start: '2026-11-10' };
    expect(issuesOf(JSON.stringify(mixed))[0]).toMatchObject({
      code: 'invalidItem',
      detail: 'taskCannotHaveSchedule',
    });
  });

  it('refuses impossible dates, zones and window values', async () => {
    const file = await valid();
    file.data.items[0].from = '2026-02-30';
    file.data.items[0].due = {
      allDay: false,
      at: '2026-11-25T02:59:00.000Z',
      timeZone: 'Mars/Base',
    };
    file.data.items[1].schedule = { allDay: false, start: 'soon' };
    expect(issuesOf(JSON.stringify(file)).map((i) => i.path)).toEqual([
      'data.items[0].from',
      'data.items[0].due',
      'data.items[1].schedule',
    ]);
  });

  it('refuses repeated ids', async () => {
    const file = await valid();
    file.data.agendas.push({ ...file.data.agendas[0] });
    expect(issuesOf(JSON.stringify(file))).toEqual([
      { path: 'data.agendas[1].id', code: 'duplicateId' },
    ]);
  });

  it('refuses settings that are not valid', async () => {
    const file = await valid();
    file.settings = {
      displayTimeZone: 'auto',
      periodBounds: { morningStart: 12, afternoonStart: 6, eveningStart: 18 },
    };
    expect(issuesOf(JSON.stringify(file))).toHaveLength(1);
  });

  it('drops unknown extra fields', async () => {
    const file = await valid();
    file.data.agendas[0].secret = 'x';
    file.extra = true;
    const result = parseBackup(JSON.stringify(file));
    expect(result.ok && result.backup.data.agendas[0]).not.toHaveProperty('secret');
  });

  it('accepts a file with some lists missing', async () => {
    const file = await valid();
    delete file.data.tags;
    delete file.settings;
    const result = parseBackup(JSON.stringify(file));
    expect(result.ok && result.backup.data.tags).toEqual([]);
    expect(result.ok && result.backup.settings).toBeNull();
  });
});

describe('saved views in a backup', () => {
  const makeView = (agendaId: string, tagId: string) =>
    createSavedView({
      name: 'Study',
      order: 1,
      agendaIds: [agendaId],
      layout: 'grouped',
      filter: {
        tagIds: [tagId],
        kinds: ['task'],
        periods: ['dawn', 'untimed'],
        text: 'ação',
        dueWithinDays: 0,
      },
    });

  async function source() {
    const db = openTestDb();
    const data = sampleData();
    await fill(db, data);
    const view = makeView(data.agenda.id, data.tag.id);
    await db.savedViews.put(view);
    return { db, data, view };
  }
  const valid = async () => {
    const { db } = await source();
    return JSON.parse(serializeBackup(await exportBackup(db, { now: NOW })));
  };

  it('are exported and come back identical, with a deleted one too', async () => {
    const { db, data } = await source();
    const gone = makeView(data.agenda.id, data.tag.id);
    await db.savedViews.put(gone);
    await createRepositories(db).savedViews.remove(gone.id);
    const text = serializeBackup(await exportBackup(db, { now: NOW }));

    const target = openTestDb();
    const result = await importBackupText(target, text, 'replace');
    expect(result.ok && result.summary.savedViews).toEqual({ added: 2, updated: 0, skipped: 0 });
    expect(await snapshot(target)).toEqual(await snapshot(db));
  });

  it('can be left out with the tombstones', async () => {
    const { db, data } = await source();
    const gone = makeView(data.agenda.id, data.tag.id);
    await db.savedViews.put(gone);
    await createRepositories(db).savedViews.remove(gone.id);
    const backup = await exportBackup(db, { includeDeleted: false });
    expect(backup.data.savedViews).toHaveLength(1);
  });

  it('merge by the newest updatedAt, and never remove a local view', async () => {
    const { db: local, view } = await source();
    const mine = createSavedView({ name: 'Mine' });
    await local.savedViews.put(mine);

    const remote = openTestDb();
    const data = sampleData();
    await fill(remote, data);
    await remote.savedViews.put({
      ...view,
      name: 'Renamed',
      updatedAt: '2026-12-01T00:00:00.000Z',
    });

    const result = await importBackup(local, await exportBackup(remote), 'merge');
    expect(result.ok && result.summary.savedViews).toEqual({ added: 0, updated: 1, skipped: 0 });
    expect((await local.savedViews.toArray()).map((v) => v.name).sort()).toEqual([
      'Mine',
      'Renamed',
    ]);
  });

  it('count as none in a file from before they existed, and replace then clears them', async () => {
    const file = await valid();
    delete file.data.savedViews;
    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed.ok && parsed.backup.data.savedViews).toEqual([]);

    const { db } = await source();
    const result = await importBackupText(db, JSON.stringify(file), 'replace');
    expect(result.ok).toBe(true);
    expect(await db.savedViews.count()).toBe(0);
  });

  it('are checked field by field, with the path of each problem', async () => {
    const file = await valid();
    const view = file.data.savedViews[0];
    view.name = 5;
    view.layout = 'tabs';
    view.agendaIds = 'a1';
    view.filter.kinds = ['note'];
    view.filter.periods = ['noon'];
    view.filter.text = null;
    view.filter.dueWithinDays = -1;
    view.filter.tagIds = [''];

    const paths = issuesOf(JSON.stringify(file)).map((issue) => issue.path);
    expect(paths.sort()).toEqual(
      [
        'data.savedViews[0].name',
        'data.savedViews[0].layout',
        'data.savedViews[0].agendaIds',
        'data.savedViews[0].filter.kinds',
        'data.savedViews[0].filter.periods',
        'data.savedViews[0].filter.text',
        'data.savedViews[0].filter.dueWithinDays',
        'data.savedViews[0].filter.tagIds',
      ].sort(),
    );
  });

  it('refuse a filter that is missing or not an object', async () => {
    const file = await valid();
    file.data.savedViews[0].filter = 'all';
    expect(issuesOf(JSON.stringify(file))).toEqual([
      { path: 'data.savedViews[0].filter', code: 'invalidField' },
    ]);
    delete file.data.savedViews[0].filter;
    expect(issuesOf(JSON.stringify(file))).toEqual([
      { path: 'data.savedViews[0].filter', code: 'invalidField' },
    ]);
  });

  it('accept null agendas (all) and an empty list (none)', async () => {
    const file = await valid();
    file.data.savedViews[0].agendaIds = null;
    let parsed = parseBackup(JSON.stringify(file));
    expect(parsed.ok && parsed.backup.data.savedViews[0]!.agendaIds).toBeNull();
    file.data.savedViews[0].agendaIds = [];
    parsed = parseBackup(JSON.stringify(file));
    expect(parsed.ok && parsed.backup.data.savedViews[0]!.agendaIds).toEqual([]);
  });

  it('refuse a replace file whose view points to an agenda or a tag outside of it', async () => {
    const { db, data, view } = await source();
    const backup = await exportBackup(db);
    backup.data.savedViews = [
      {
        ...view,
        agendaIds: ['missing-agenda'],
        filter: { ...view.filter, tagIds: ['missing-tag'] },
      },
    ];
    const result = await importBackup(openTestDb(), backup, 'replace');
    expect(!result.ok && result.issues).toEqual([
      { path: 'data.savedViews[0].agendaIds[0]', code: 'danglingReference' },
      { path: 'data.savedViews[0].filter.tagIds[0]', code: 'danglingReference' },
    ]);
    // A tombstone of the agenda keeps the reference valid
    backup.data.savedViews = [view];
    backup.data.agendas = [{ ...data.agenda, deletedAt: '2026-11-01T00:00:00.000Z' }];
    expect((await importBackup(openTestDb(), backup, 'replace')).ok).toBe(true);
  });
});
