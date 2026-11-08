import Dexie, { type EntityTable } from 'dexie';
import type { Agenda, AgendaGroup, Item, SavedView, Status, StatusGroup, Tag } from '../core';

/*
 * The local database, kept in IndexedDB (the browser's built-in database) through Dexie.
 *
 * Schema rules:
 * - Never edit a version that has shipped. A change adds `db.version(n + 1)` with `.stores()`
 *   for the new indexes and an `.upgrade()` step that moves the old data.
 * - Only fields used in a query are indexed. Everything else is stored but not searched here:
 *   the views filter in memory with the pure functions of the core.
 * - A key that is empty (`null`) cannot be indexed in IndexedDB, so `deletedAt` is listed for
 *   completeness and the code filters on it in memory.
 */

export const DEFAULT_DB_NAME = 'unified-agenda';

/** One row of small app data, such as the settings or the "defaults were created" mark. */
export interface MetaRecord {
  key: string;
  value: unknown;
}

export type AgendaDatabase = Dexie & {
  agendas: EntityTable<Agenda, 'id'>;
  agendaGroups: EntityTable<AgendaGroup, 'id'>;
  items: EntityTable<Item, 'id'>;
  tags: EntityTable<Tag, 'id'>;
  savedViews: EntityTable<SavedView, 'id'>;
  statusGroups: EntityTable<StatusGroup, 'id'>;
  statuses: EntityTable<Status, 'id'>;
  meta: EntityTable<MetaRecord, 'key'>;
};

/** The tables that hold entities, in the order the backup file lists them. */
export const ENTITY_KINDS = [
  'agendas',
  'agendaGroups',
  'items',
  'tags',
  'statusGroups',
  'statuses',
  'savedViews',
] as const;

export type EntityKind = (typeof ENTITY_KINDS)[number];

export function createDatabase(name: string = DEFAULT_DB_NAME): AgendaDatabase {
  const db = new Dexie(name) as AgendaDatabase;
  db.version(1).stores({
    agendas: 'id, order, updatedAt, deletedAt',
    agendaGroups: 'id, order, updatedAt, deletedAt',
    items: 'id, parentId, agendaId, statusId, *tagIds, updatedAt, deletedAt',
    tags: 'id, parentId, updatedAt, deletedAt',
    statusGroups: 'id, order, updatedAt, deletedAt',
    statuses: 'id, groupId, order, updatedAt, deletedAt',
    meta: 'key',
  });
  // Version 2 adds the saved views. A new table needs no `upgrade` step: nothing has to move.
  db.version(2).stores({
    savedViews: 'id, order, updatedAt, deletedAt',
  });
  return db;
}
