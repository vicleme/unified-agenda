import type {
  Agenda,
  AgendaGroup,
  Due,
  Id,
  Item,
  ItemKind,
  ItemLink,
  PlainDate,
  Schedule,
  SavedView,
  SavedViewFilter,
  SavedViewLayout,
  Status,
  StatusGroup,
  StatusRole,
  SyncFields,
  Tag,
  Timestamp,
} from './types';

/** Where ids and the clock come from. Tests pass fixed ones, the app uses the default. */
export interface Context {
  now: () => Timestamp;
  newId: () => Id;
}

export const defaultContext: Context = {
  now: () => new Date().toISOString(),
  newId: () => crypto.randomUUID(),
};

function newSyncFields(ctx: Context): SyncFields {
  const stamp = ctx.now();
  return { id: ctx.newId(), createdAt: stamp, updatedAt: stamp, deletedAt: null };
}

export function isActive(entity: SyncFields): boolean {
  return entity.deletedAt === null;
}

/** Returns a copy with the changes applied and `updatedAt` refreshed. */
export function updateEntity<T extends SyncFields>(
  entity: T,
  changes: Partial<Omit<T, keyof SyncFields>>,
  ctx: Context = defaultContext,
): T {
  return { ...entity, ...changes, updatedAt: ctx.now() };
}

/** Marks the entity as deleted (a tombstone). Deleting twice keeps the first deletion time. */
export function softDelete<T extends SyncFields>(entity: T, ctx: Context = defaultContext): T {
  if (entity.deletedAt !== null) return entity;
  const stamp = ctx.now();
  return { ...entity, deletedAt: stamp, updatedAt: stamp };
}

export function createAgenda(
  input: { name: string; color: string; order?: number },
  ctx: Context = defaultContext,
): Agenda {
  return { ...newSyncFields(ctx), name: input.name, color: input.color, order: input.order ?? 0 };
}

export function createAgendaGroup(
  input: { name: string; agendaIds?: Id[]; order?: number },
  ctx: Context = defaultContext,
): AgendaGroup {
  return {
    ...newSyncFields(ctx),
    name: input.name,
    agendaIds: input.agendaIds ?? [],
    order: input.order ?? 0,
  };
}

export function createItem(
  input: {
    kind: ItemKind;
    title: string;
    agendaId: Id;
    parentId?: Id | null;
    order?: number;
    notes?: string;
    schedule?: Schedule | null;
    from?: PlainDate | null;
    due?: Due | null;
    tagIds?: Id[];
    inheritTags?: boolean;
    statusId?: Id | null;
    location?: string;
    links?: ItemLink[];
  },
  ctx: Context = defaultContext,
): Item {
  return {
    ...newSyncFields(ctx),
    parentId: input.parentId ?? null,
    order: input.order ?? 0,
    kind: input.kind,
    title: input.title,
    notes: input.notes ?? '',
    schedule: input.schedule ?? null,
    from: input.from ?? null,
    due: input.due ?? null,
    agendaId: input.agendaId,
    tagIds: input.tagIds ?? [],
    inheritTags: input.inheritTags ?? true,
    statusId: input.statusId ?? null,
    location: input.location ?? '',
    links: input.links ?? [],
  };
}

export function createTag(
  input: { name: string; color: string; parentId?: Id | null; agendaIds?: Id[] },
  ctx: Context = defaultContext,
): Tag {
  return {
    ...newSyncFields(ctx),
    name: input.name,
    color: input.color,
    parentId: input.parentId ?? null,
    agendaIds: input.agendaIds ?? [],
  };
}

export function createStatusGroup(
  input: { name: string; role: StatusRole; order?: number },
  ctx: Context = defaultContext,
): StatusGroup {
  return { ...newSyncFields(ctx), name: input.name, role: input.role, order: input.order ?? 0 };
}

export function createStatus(
  input: { name: string; groupId: Id; order?: number },
  ctx: Context = defaultContext,
): Status {
  return {
    ...newSyncFields(ctx),
    name: input.name,
    groupId: input.groupId,
    order: input.order ?? 0,
  };
}

export const EMPTY_SAVED_FILTER: SavedViewFilter = {
  tagIds: [],
  kinds: [],
  periods: [],
  text: '',
  dueWithinDays: null,
};

export function createSavedView(
  input: {
    name: string;
    order?: number;
    filter?: SavedViewFilter;
    agendaIds?: Id[] | null;
    layout?: SavedViewLayout;
  },
  ctx: Context = defaultContext,
): SavedView {
  const filter = input.filter ?? EMPTY_SAVED_FILTER;
  return {
    ...newSyncFields(ctx),
    name: input.name,
    order: input.order ?? 0,
    // Copies, so changing the view later never changes the shared empty filter
    filter: {
      ...filter,
      tagIds: [...filter.tagIds],
      kinds: [...filter.kinds],
      periods: [...filter.periods],
    },
    agendaIds:
      input.agendaIds === undefined || input.agendaIds === null ? null : [...input.agendaIds],
    layout: input.layout ?? 'mixed',
  };
}
