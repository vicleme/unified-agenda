import type { Table } from 'dexie';
import { type SyncFields, type Timestamp } from '../core';
import { ENTITY_KINDS, type AgendaDatabase, type EntityKind } from './db';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  findDanglingReferences,
  parseBackup,
  type BackupData,
  type BackupFile,
  type ImportIssue,
} from './parseBackup';
import { SEEDED_KEY } from './seed';
import { SETTINGS_KEY, loadSettings } from './settings';

export * from './parseBackup';

export interface ExportOptions {
  /** Keep deleted entities (tombstones) so that a later import can tell they were deleted. */
  includeDeleted?: boolean;
  now?: () => Timestamp;
}

/** Reads everything in one consistent snapshot. */
export async function exportBackup(
  db: AgendaDatabase,
  options: ExportOptions = {},
): Promise<BackupFile> {
  const includeDeleted = options.includeDeleted ?? true;
  const now = options.now ?? (() => new Date().toISOString());

  return db.transaction(
    'r',
    [
      db.agendas,
      db.agendaGroups,
      db.items,
      db.tags,
      db.statusGroups,
      db.statuses,
      db.savedViews,
      db.meta,
    ],
    async () => {
      const keep = <T extends SyncFields>(list: T[]) =>
        includeDeleted ? list : list.filter((entity) => entity.deletedAt === null);
      const data: BackupData = {
        agendas: keep(await db.agendas.toArray()),
        agendaGroups: keep(await db.agendaGroups.toArray()),
        items: keep(await db.items.toArray()),
        tags: keep(await db.tags.toArray()),
        statusGroups: keep(await db.statusGroups.toArray()),
        statuses: keep(await db.statuses.toArray()),
        savedViews: keep(await db.savedViews.toArray()),
      };
      const hasSettings = (await db.meta.get(SETTINGS_KEY)) !== undefined;
      return {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt: now(),
        settings: hasSettings ? await loadSettings(db) : null,
        data,
      };
    },
  );
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

/** A suggested file name such as unified-agenda-2026-11-07.json. */
export function backupFileName(exportedAt: Timestamp): string {
  return `unified-agenda-${exportedAt.slice(0, 10)}.json`;
}

/**
 * - merge: adds what is new and, for an id that exists on both sides, keeps the version with the
 *   newest `updatedAt` (last write wins, a tie keeps the local one). Nothing is ever removed.
 *   Settings are taken from the file only when this device has none saved.
 * - replace: the device ends up equal to the file. Everything else is erased first.
 */
export type ImportMode = 'merge' | 'replace';

export interface KindSummary {
  added: number;
  updated: number;
  skipped: number;
}

export type ImportSummary = Record<EntityKind, KindSummary> & { settingsApplied: boolean };

export type ImportResult =
  { ok: true; summary: ImportSummary } | { ok: false; issues: ImportIssue[] };

type AnyTable = Table<SyncFields, string>;

async function mergeKind(table: AnyTable, incoming: readonly SyncFields[]): Promise<KindSummary> {
  const current = await table.bulkGet(incoming.map((entity) => entity.id));
  const toWrite: SyncFields[] = [];
  const summary: KindSummary = { added: 0, updated: 0, skipped: 0 };
  incoming.forEach((entity, index) => {
    const existing = current[index];
    if (!existing) {
      summary.added++;
      toWrite.push(entity);
    } else if (Date.parse(entity.updatedAt) > Date.parse(existing.updatedAt)) {
      summary.updated++;
      toWrite.push(entity);
    } else {
      summary.skipped++;
    }
  });
  await table.bulkPut(toWrite);
  return summary;
}

/**
 * Writes a parsed backup. It all happens in one transaction: if anything fails, nothing is
 * changed. In replace mode the file must be able to stand alone, so references to things that are
 * not in it are refused.
 */
export async function importBackup(
  db: AgendaDatabase,
  backup: BackupFile,
  mode: ImportMode = 'merge',
): Promise<ImportResult> {
  if (mode === 'replace') {
    const issues = findDanglingReferences(backup.data);
    if (issues.length > 0) return { ok: false, issues };
  }

  const tables = [
    db.agendas,
    db.agendaGroups,
    db.items,
    db.tags,
    db.statusGroups,
    db.statuses,
    db.savedViews,
    db.meta,
  ];
  const summary = await db.transaction('rw', tables, async () => {
    const result = {} as ImportSummary;
    for (const kind of ENTITY_KINDS) {
      const table = db.table(kind) as unknown as AnyTable;
      const incoming: readonly SyncFields[] = backup.data[kind];
      if (mode === 'replace') {
        await table.clear();
        await table.bulkPut([...incoming]);
        result[kind] = { added: incoming.length, updated: 0, skipped: 0 };
      } else {
        result[kind] = await mergeKind(table, incoming);
      }
    }

    let settingsApplied = false;
    if (mode === 'replace') {
      if (backup.settings) {
        await db.meta.put({ key: SETTINGS_KEY, value: backup.settings });
        settingsApplied = true;
      } else {
        await db.meta.delete(SETTINGS_KEY);
      }
    } else if (backup.settings && (await db.meta.get(SETTINGS_KEY)) === undefined) {
      await db.meta.put({ key: SETTINGS_KEY, value: backup.settings });
      settingsApplied = true;
    }
    // Imported data brings its own status groups, so the defaults must not be created later
    await db.meta.put({ key: SEEDED_KEY, value: true });

    result.settingsApplied = settingsApplied;
    return result;
  });
  return { ok: true, summary };
}

/** Reads a backup file's text and imports it. */
export async function importBackupText(
  db: AgendaDatabase,
  text: string,
  mode: ImportMode = 'merge',
): Promise<ImportResult> {
  const parsed = parseBackup(text);
  if (!parsed.ok) return { ok: false, issues: parsed.issues };
  return importBackup(db, parsed.backup, mode);
}
