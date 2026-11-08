import { afterEach } from 'vitest';
import {
  createAgenda,
  createItem,
  createDefaultStatuses,
  createTag,
  type Context,
  type Item,
} from '../../src/core';
import { createDatabase, type AgendaDatabase } from '../../src/storage';
import { testContext } from '../core/helpers';
import { settleApp } from '../helpers';
import { mountedDbs } from '../mounted';

const opened: AgendaDatabase[] = [];
let counter = 0;

/** A fresh, empty database with its own name, closed and deleted after each test. */
export function openTestDb(name = `test-db-${++counter}`): AgendaDatabase {
  const db = createDatabase(name);
  opened.push(db);
  return db;
}

afterEach(async () => {
  for (const db of opened.splice(0)) {
    if (mountedDbs.has(db)) await settleApp(db);
    db.close();
    await db.delete();
  }
});

export const label = (key: string) => key;

/** A small but complete data set: agenda, status groups, a tag, a task with a window and a block. */
export function sampleData(ctx: Context = testContext()) {
  const agenda = createAgenda({ name: 'College', color: '#3b5bdb' }, ctx);
  const { groups, statuses } = createDefaultStatuses(label, ctx);
  const tag = createTag({ name: 'Study', color: '#2f9e44' }, ctx);
  const planned = statuses.find((s) => s.name === 'scheduled')!;
  const task = createItem(
    {
      kind: 'task',
      title: 'Paper',
      agendaId: agenda.id,
      statusId: planned.id,
      tagIds: [tag.id],
      from: '2026-11-03',
      due: { allDay: false, at: '2026-11-25T02:59:00.000Z', timeZone: 'America/Sao_Paulo' },
      links: [{ label: 'Portal', url: 'https://example.com' }],
    },
    ctx,
  );
  const block: Item = createItem(
    {
      kind: 'event',
      title: 'Work on paper',
      agendaId: agenda.id,
      parentId: task.id,
      schedule: {
        allDay: false,
        start: '2026-11-10T17:00:00.000Z',
        end: '2026-11-10T19:00:00.000Z',
      },
    },
    ctx,
  );
  return { agenda, groups, statuses, tag, task, block };
}

export async function fill(db: AgendaDatabase, data: ReturnType<typeof sampleData>) {
  await db.agendas.put(data.agenda);
  await db.statusGroups.bulkPut(data.groups);
  await db.statuses.bulkPut(data.statuses);
  await db.tags.put(data.tag);
  await db.items.bulkPut([data.task, data.block]);
}
