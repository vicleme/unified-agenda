import {
  defaultContext,
  isActive,
  softDelete,
  updateEntity,
  type Agenda,
  type AgendaGroup,
  type Context,
  type Id,
  type Item,
  type SavedView,
  type Status,
  type StatusGroup,
  type SyncFields,
  type Tag,
} from '../core';
import type { AgendaDatabase } from './db';

export interface ListOptions {
  /** Deleted entities (tombstones) are hidden unless this is true. */
  includeDeleted?: boolean;
}

/** The few table operations the repository needs. A Dexie table fits it. */
interface EntityStore<T> {
  get(id: Id): Promise<T | undefined>;
  toArray(): Promise<T[]>;
  put(entity: T): Promise<unknown>;
  bulkPut(entities: T[]): Promise<unknown>;
}

/** Reads and writes one kind of entity. Deleting only marks `deletedAt`, as sync will need. */
export class Repository<T extends SyncFields> {
  private readonly table: EntityStore<T>;

  constructor(table: EntityStore<T>) {
    this.table = table;
  }

  get(id: Id): Promise<T | undefined> {
    return this.table.get(id);
  }

  async list(options: ListOptions = {}): Promise<T[]> {
    const all = await this.table.toArray();
    return options.includeDeleted ? all : all.filter(isActive);
  }

  async put(entity: T): Promise<void> {
    await this.table.put(entity);
  }

  async putMany(entities: readonly T[]): Promise<void> {
    await this.table.bulkPut([...entities]);
  }

  /** Applies the changes and refreshes `updatedAt`. Returns undefined if the id does not exist. */
  async update(
    id: Id,
    changes: Partial<Omit<T, keyof SyncFields>>,
    ctx: Context = defaultContext,
  ): Promise<T | undefined> {
    const current = await this.table.get(id);
    if (!current) return undefined;
    const next = updateEntity(current, changes, ctx);
    await this.table.put(next);
    return next;
  }

  /** Marks the entity as deleted. The record stays, so the deletion can sync later. */
  async remove(id: Id, ctx: Context = defaultContext): Promise<T | undefined> {
    const current = await this.table.get(id);
    if (!current) return undefined;
    const next = softDelete(current, ctx);
    if (next !== current) await this.table.put(next);
    return next;
  }
}

export interface Repositories {
  agendas: Repository<Agenda>;
  agendaGroups: Repository<AgendaGroup>;
  items: Repository<Item>;
  tags: Repository<Tag>;
  savedViews: Repository<SavedView>;
  statusGroups: Repository<StatusGroup>;
  statuses: Repository<Status>;
}

export function createRepositories(db: AgendaDatabase): Repositories {
  return {
    agendas: new Repository<Agenda>(db.agendas),
    agendaGroups: new Repository<AgendaGroup>(db.agendaGroups),
    items: new Repository<Item>(db.items),
    tags: new Repository<Tag>(db.tags),
    savedViews: new Repository<SavedView>(db.savedViews),
    statusGroups: new Repository<StatusGroup>(db.statusGroups),
    statuses: new Repository<Status>(db.statuses),
  };
}

/** True while the person has created nothing yet: no agendas, items or tags. */
export async function isPristine(db: AgendaDatabase): Promise<boolean> {
  const counts = await Promise.all([db.agendas.count(), db.items.count(), db.tags.count()]);
  return counts.every((count) => count === 0);
}
