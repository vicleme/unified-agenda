import {
  createDefaultStatuses,
  defaultContext,
  type Context,
  type DefaultGroupKey,
  type DefaultStatusKey,
} from '../core';
import type { AgendaDatabase } from './db';

export const SEEDED_KEY = 'defaultsCreated';

/**
 * Creates the starting Kanban groups and columns the first time the app opens, and never again.
 * The mark is stored apart from the data, so deleting every group on purpose does not bring the
 * defaults back. Returns true when it created them.
 */
export function ensureDefaultStatuses(
  db: AgendaDatabase,
  label: (key: DefaultGroupKey | DefaultStatusKey) => string,
  ctx: Context = defaultContext,
): Promise<boolean> {
  return db.transaction('rw', db.statusGroups, db.statuses, db.meta, async () => {
    if (await db.meta.get(SEEDED_KEY)) return false;
    const existing = await db.statusGroups.count();
    if (existing === 0) {
      const { groups, statuses } = createDefaultStatuses(label, ctx);
      await db.statusGroups.bulkPut(groups);
      await db.statuses.bulkPut(statuses);
    }
    await db.meta.put({ key: SEEDED_KEY, value: true });
    return existing === 0;
  });
}
