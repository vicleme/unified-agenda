import {
  DAY_PERIODS,
  SAVED_VIEW_LAYOUTS,
  isPlainDate,
  isTimestamp,
  validateDue,
  validateItem,
  validateSchedule,
  type Agenda,
  type AgendaGroup,
  type Due,
  type Item,
  type ItemKind,
  type ItemLink,
  type SavedView,
  type SavedViewFilter,
  type SavedViewPeriod,
  type Schedule,
  type Settings,
  type Status,
  type StatusGroup,
  type SyncFields,
  type Tag,
  type Timestamp,
} from '../core';
import { isValidSettings } from './settings';

export const BACKUP_FORMAT = 'unified-agenda-backup';
export const BACKUP_VERSION = 1;

export interface BackupData {
  agendas: Agenda[];
  agendaGroups: AgendaGroup[];
  items: Item[];
  tags: Tag[];
  statusGroups: StatusGroup[];
  statuses: Status[];
  /** Missing in files from before saved views existed, which then count as having none. */
  savedViews: SavedView[];
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: Timestamp;
  /** Null when the file carries no settings. */
  settings: Settings | null;
  data: BackupData;
}

export type ImportIssueCode =
  | 'notJson'
  | 'notBackup'
  | 'unsupportedVersion'
  | 'invalidField'
  | 'invalidItem'
  | 'duplicateId'
  | 'danglingReference';

/** What is wrong and where. The interface turns the code into a sentence in the right language. */
export interface ImportIssue {
  /** For example `data.items[3].title`. */
  path: string;
  code: ImportIssueCode;
  detail?: string;
}

export type ParseResult = { ok: true; backup: BackupFile } | { ok: false; issues: ImportIssue[] };

type Rec = Record<string, unknown>;

function isRecord(value: unknown): value is Rec {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

/** Reads typed fields from one object and records an issue for each one that is wrong. */
class Reader {
  failed = false;
  readonly rec: Rec;
  readonly path: string;
  private readonly issues: ImportIssue[];

  constructor(rec: Rec, path: string, issues: ImportIssue[]) {
    this.rec = rec;
    this.path = path;
    this.issues = issues;
  }

  fail(key: string, code: ImportIssueCode = 'invalidField', detail?: string): void {
    this.failed = true;
    this.issues.push({ path: `${this.path}.${key}`, code, ...(detail ? { detail } : {}) });
  }

  raw(key: string): unknown {
    return this.rec[key];
  }

  string(key: string, required = false): string {
    const value = this.rec[key];
    if (typeof value === 'string' && (!required || value !== '')) return value;
    this.fail(key);
    return '';
  }

  number(key: string): number {
    const value = this.rec[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    this.fail(key);
    return 0;
  }

  timestamp(key: string): Timestamp {
    const value = this.rec[key];
    if (isTimestamp(value)) return value;
    this.fail(key);
    return '';
  }

  nullableTimestamp(key: string): Timestamp | null {
    const value = this.rec[key];
    if (value === null || value === undefined) return null;
    return this.timestamp(key);
  }

  nullableId(key: string): string | null {
    const value = this.rec[key];
    if (value === null || value === undefined) return null;
    return this.string(key, true);
  }

  nullableDate(key: string): string | null {
    const value = this.rec[key];
    if (value === null || value === undefined) return null;
    if (isPlainDate(value)) return value;
    this.fail(key);
    return null;
  }

  stringList(key: string): string[] {
    const value = this.rec[key];
    if (Array.isArray(value) && value.every((v) => typeof v === 'string' && v !== '')) {
      return [...(value as string[])];
    }
    this.fail(key);
    return [];
  }

  /** A true or false that older backups do not have: a missing value takes the fallback. */
  optionalBoolean(key: string, fallback: boolean): boolean {
    const value = this.rec[key];
    if (value === undefined) return fallback;
    if (typeof value === 'boolean') return value;
    this.fail(key);
    return fallback;
  }

  /** A nested object. Returns null (and records the problem) when it is missing or not an object. */
  child(key: string): Reader | null {
    const value = this.rec[key];
    if (isRecord(value)) return new Reader(value, `${this.path}.${key}`, this.issues);
    this.fail(key);
    return null;
  }

  /** A whole number of zero or more, or null. */
  nullableCount(key: string): number | null {
    const value = this.rec[key];
    if (value === null) return null;
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
    this.fail(key);
    return null;
  }

  /** A list of names that must all be among the allowed ones. */
  oneOfList<T extends string>(key: string, allowed: readonly T[]): T[] {
    const value = this.rec[key];
    if (
      Array.isArray(value) &&
      value.every((v) => typeof v === 'string' && (allowed as readonly string[]).includes(v))
    ) {
      return [...(value as T[])];
    }
    this.fail(key);
    return [];
  }

  /** A list of ids, or null. A missing value is a problem. */
  nullableStringList(key: string): string[] | null {
    return this.rec[key] === null ? null : this.stringList(key);
  }

  oneOf<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
    const value = this.rec[key];
    if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
      return value as T;
    }
    this.fail(key);
    return fallback;
  }
}

function readSync(rd: Reader): SyncFields {
  return {
    id: rd.string('id', true),
    createdAt: rd.timestamp('createdAt'),
    updatedAt: rd.timestamp('updatedAt'),
    deletedAt: rd.nullableTimestamp('deletedAt'),
  };
}

function readSchedule(rd: Reader): Schedule | null {
  const value = rd.raw('schedule');
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) return (rd.fail('schedule'), null);

  const { allDay, start, end, timeZone } = value;
  if (typeof allDay !== 'boolean' || typeof start !== 'string') return (rd.fail('schedule'), null);
  if (!isOptionalString(end) || !isOptionalString(timeZone)) return (rd.fail('schedule'), null);

  const schedule: Schedule = allDay
    ? { allDay: true, start, ...(end !== undefined ? { end } : {}) }
    : {
        allDay: false,
        start,
        ...(end !== undefined ? { end } : {}),
        ...(timeZone !== undefined ? { timeZone } : {}),
      };
  if (validateSchedule(schedule).length > 0) return (rd.fail('schedule'), null);
  return schedule;
}

function readDue(rd: Reader): Due | null {
  const value = rd.raw('due');
  if (value === null || value === undefined) return null;
  if (!isRecord(value) || typeof value.allDay !== 'boolean') return (rd.fail('due'), null);

  const { allDay, date, at, timeZone } = value;
  let due: Due;
  if (allDay) {
    if (typeof date !== 'string') return (rd.fail('due'), null);
    due = { allDay: true, date };
  } else {
    if (typeof at !== 'string' || !isOptionalString(timeZone)) return (rd.fail('due'), null);
    due = { allDay: false, at, ...(timeZone !== undefined ? { timeZone } : {}) };
  }
  if (validateDue(due).length > 0) return (rd.fail('due'), null);
  return due;
}

function readLinks(rd: Reader): ItemLink[] {
  const value = rd.raw('links');
  if (!Array.isArray(value)) return (rd.fail('links'), []);
  const links: ItemLink[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.label !== 'string' || typeof entry.url !== 'string') {
      return (rd.fail('links'), []);
    }
    links.push({ label: entry.label, url: entry.url });
  }
  return links;
}

const parseAgenda = (rd: Reader): Agenda => ({
  ...readSync(rd),
  name: rd.string('name'),
  color: rd.string('color'),
  order: rd.number('order'),
});

const parseAgendaGroup = (rd: Reader): AgendaGroup => ({
  ...readSync(rd),
  name: rd.string('name'),
  agendaIds: rd.stringList('agendaIds'),
  order: rd.number('order'),
});

const parseTag = (rd: Reader): Tag => ({
  ...readSync(rd),
  name: rd.string('name'),
  parentId: rd.nullableId('parentId'),
  agendaIds: rd.stringList('agendaIds'),
  color: rd.string('color'),
});

const parseStatusGroup = (rd: Reader): StatusGroup => ({
  ...readSync(rd),
  name: rd.string('name'),
  role: rd.oneOf('role', ['planned', 'started', 'done'] as const, 'planned'),
  order: rd.number('order'),
});

const parseStatus = (rd: Reader): Status => ({
  ...readSync(rd),
  name: rd.string('name'),
  groupId: rd.string('groupId', true),
  order: rd.number('order'),
});

const FILTER_KINDS: readonly ItemKind[] = ['event', 'task'];
const FILTER_PERIODS: readonly SavedViewPeriod[] = [...DAY_PERIODS, 'untimed'];

function readSavedFilter(rd: Reader): SavedViewFilter {
  return {
    tagIds: rd.stringList('tagIds'),
    kinds: rd.oneOfList('kinds', FILTER_KINDS),
    periods: rd.oneOfList('periods', FILTER_PERIODS),
    text: rd.string('text'),
    dueWithinDays: rd.nullableCount('dueWithinDays'),
  };
}

function parseSavedView(rd: Reader): SavedView {
  const view: SavedView = {
    ...readSync(rd),
    name: rd.string('name'),
    order: rd.number('order'),
    filter: { tagIds: [], kinds: [], periods: [], text: '', dueWithinDays: null },
    agendaIds: rd.nullableStringList('agendaIds'),
    layout: rd.oneOf('layout', SAVED_VIEW_LAYOUTS, 'mixed'),
  };
  const filterReader = rd.child('filter');
  if (filterReader) {
    view.filter = readSavedFilter(filterReader);
    if (filterReader.failed) rd.failed = true;
  }
  return view;
}

function parseItem(rd: Reader): Item {
  const item: Item = {
    ...readSync(rd),
    parentId: rd.nullableId('parentId'),
    order: rd.number('order'),
    kind: rd.oneOf('kind', ['event', 'task'] as const, 'event'),
    title: rd.string('title'),
    notes: rd.string('notes'),
    schedule: readSchedule(rd),
    from: rd.nullableDate('from'),
    due: readDue(rd),
    agendaId: rd.string('agendaId', true),
    tagIds: rd.stringList('tagIds'),
    inheritTags: rd.optionalBoolean('inheritTags', true),
    statusId: rd.nullableId('statusId'),
    location: rd.string('location'),
    links: readLinks(rd),
  };
  if (!rd.failed) {
    const problems = validateItem(item);
    if (problems.length > 0) rd.fail('item', 'invalidItem', problems.join(','));
  }
  return item;
}

function parseList<T extends SyncFields>(
  raw: unknown,
  name: string,
  issues: ImportIssue[],
  parseOne: (rd: Reader) => T,
): T[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    issues.push({ path: `data.${name}`, code: 'invalidField' });
    return [];
  }
  const seen = new Set<string>();
  const found: T[] = [];
  raw.forEach((entry, index) => {
    const path = `data.${name}[${index}]`;
    if (!isRecord(entry)) {
      issues.push({ path, code: 'invalidField' });
      return;
    }
    const before = issues.length;
    const entity = parseOne(new Reader(entry, path, issues));
    if (issues.length > before) return;
    if (seen.has(entity.id)) {
      issues.push({ path: `${path}.id`, code: 'duplicateId' });
      return;
    }
    seen.add(entity.id);
    found.push(entity);
  });
  return found;
}

function parseSettings(raw: unknown, issues: ImportIssue[]): Settings | null {
  if (raw === null || raw === undefined) return null;
  const rd = isRecord(raw) ? new Reader(raw, 'settings', issues) : null;
  if (!rd) {
    issues.push({ path: 'settings', code: 'invalidField' });
    return null;
  }
  const bounds = rd.raw('periodBounds');
  if (!isRecord(bounds)) {
    rd.fail('periodBounds');
    return null;
  }
  const boundsReader = new Reader(bounds, 'settings.periodBounds', issues);
  const settings: Settings = {
    displayTimeZone: rd.string('displayTimeZone', true),
    periodBounds: {
      morningStart: boundsReader.number('morningStart'),
      afternoonStart: boundsReader.number('afternoonStart'),
      eveningStart: boundsReader.number('eveningStart'),
    },
  };
  if (rd.failed || boundsReader.failed) return null;
  if (!isValidSettings(settings)) {
    rd.fail('displayTimeZone');
    return null;
  }
  return settings;
}

/**
 * Reads the text of a backup file. Nothing is accepted halfway: if any part is wrong, the result
 * lists every problem found and no data is returned. Unknown extra fields are dropped.
 */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, issues: [{ path: '', code: 'notJson' }] };
  }
  if (!isRecord(raw) || raw.format !== BACKUP_FORMAT) {
    return { ok: false, issues: [{ path: 'format', code: 'notBackup' }] };
  }
  const { version } = raw;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, issues: [{ path: 'version', code: 'notBackup' }] };
  }
  if (version > BACKUP_VERSION) {
    return { ok: false, issues: [{ path: 'version', code: 'unsupportedVersion' }] };
  }

  const issues: ImportIssue[] = [];
  const exportedAt = isTimestamp(raw.exportedAt) ? raw.exportedAt : '';
  if (exportedAt === '') issues.push({ path: 'exportedAt', code: 'invalidField' });

  if (!isRecord(raw.data)) {
    issues.push({ path: 'data', code: 'invalidField' });
    return { ok: false, issues };
  }
  const data: BackupData = {
    agendas: parseList(raw.data.agendas, 'agendas', issues, parseAgenda),
    agendaGroups: parseList(raw.data.agendaGroups, 'agendaGroups', issues, parseAgendaGroup),
    items: parseList(raw.data.items, 'items', issues, parseItem),
    tags: parseList(raw.data.tags, 'tags', issues, parseTag),
    statusGroups: parseList(raw.data.statusGroups, 'statusGroups', issues, parseStatusGroup),
    statuses: parseList(raw.data.statuses, 'statuses', issues, parseStatus),
    savedViews: parseList(raw.data.savedViews, 'savedViews', issues, parseSavedView),
  };
  const settings = parseSettings(raw.settings, issues);

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, backup: { format: BACKUP_FORMAT, version, exportedAt, settings, data } };
}

/**
 * References that point to something missing from the file itself. Only meaningful when the file
 * is meant to stand alone (replace mode). Deleted entities count as present, so a tombstone keeps
 * the things that point to it valid.
 */
export function findDanglingReferences(data: BackupData): ImportIssue[] {
  const issues: ImportIssue[] = [];
  const ids = (list: readonly SyncFields[]) => new Set(list.map((entity) => entity.id));
  const agendas = ids(data.agendas);
  const items = ids(data.items);
  const tags = ids(data.tags);
  const statuses = ids(data.statuses);
  const groups = ids(data.statusGroups);

  const check = (known: Set<string>, id: string | null, path: string) => {
    if (id !== null && !known.has(id)) issues.push({ path, code: 'danglingReference' });
  };

  data.items.forEach((item, i) => {
    const base = `data.items[${i}]`;
    check(agendas, item.agendaId, `${base}.agendaId`);
    check(items, item.parentId, `${base}.parentId`);
    check(statuses, item.statusId, `${base}.statusId`);
    item.tagIds.forEach((id, t) => check(tags, id, `${base}.tagIds[${t}]`));
  });
  data.statuses.forEach((status, i) =>
    check(groups, status.groupId, `data.statuses[${i}].groupId`),
  );
  data.tags.forEach((tag, i) => {
    check(tags, tag.parentId, `data.tags[${i}].parentId`);
    tag.agendaIds.forEach((id, a) => check(agendas, id, `data.tags[${i}].agendaIds[${a}]`));
  });
  data.agendaGroups.forEach((group, i) => {
    group.agendaIds.forEach((id, a) =>
      check(agendas, id, `data.agendaGroups[${i}].agendaIds[${a}]`),
    );
  });
  data.savedViews.forEach((view, i) => {
    const base = `data.savedViews[${i}]`;
    view.agendaIds?.forEach((id, a) => check(agendas, id, `${base}.agendaIds[${a}]`));
    view.filter.tagIds.forEach((id, t) => check(tags, id, `${base}.filter.tagIds[${t}]`));
  });
  return issues;
}
