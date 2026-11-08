export type Id = string;

/** An instant in time, written as an ISO 8601 string in UTC, such as 2026-11-07T17:00:00.000Z. */
export type Timestamp = string;

/** A calendar date with no time and no time zone, written YYYY-MM-DD. */
export type PlainDate = string;

/** Fields carried by every entity, so that sync can be added later without migrating data. */
export interface SyncFields {
  /** A UUID generated on the device. */
  id: Id;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** Empty while the entity exists. Deleting sets it instead of removing the record (tombstone). */
  deletedAt: Timestamp | null;
}

export interface Agenda extends SyncFields {
  name: string;
  /** Base tone, for example #3b5bdb. Light and dark variants are derived. */
  color: string;
  order: number;
}

export interface AgendaGroup extends SyncFields {
  name: string;
  agendaIds: Id[];
  order: number;
}

export type ItemKind = 'event' | 'task';

/** The ways to arrange a day in the Timeline. Same values as `AgendaLayout` in `filters`. */
export const SAVED_VIEW_LAYOUTS = ['mixed', 'separate', 'grouped'] as const;
export type SavedViewLayout = (typeof SAVED_VIEW_LAYOUTS)[number];

/** A whole-day schedule. It has no time zone: the 12th is the 12th wherever you are. */
export interface AllDaySchedule {
  allDay: true;
  /** First day. */
  start: PlainDate;
  /** Last day, included. Empty means a single day. */
  end?: PlainDate;
}

/** A schedule with a time of day, stored as absolute instants. */
export interface TimedSchedule {
  allDay: false;
  start: Timestamp;
  end?: Timestamp;
  /** Optional IANA name (for example Europe/Lisbon) for items that belong to another city. */
  timeZone?: string;
}

/** When something happens. Used by events and by work blocks, never by a task's own window. */
export type Schedule = AllDaySchedule | TimedSchedule;

/** A delivery that is due on a day, with no time of day. It has no time zone. */
export interface AllDayDue {
  allDay: true;
  date: PlainDate;
}

/** A delivery with a deadline time, stored as an absolute instant. */
export interface TimedDue {
  allDay: false;
  at: Timestamp;
  /** Optional IANA name (for example America/Sao_Paulo) of the place the deadline refers to. */
  timeZone?: string;
}

/** The delivery of a task: a whole day (the default) or a day and time. */
export type Due = AllDayDue | TimedDue;

export interface ItemLink {
  label: string;
  url: string;
}

export interface Item extends SyncFields {
  parentId: Id | null;
  /** Position among siblings. */
  order: number;
  kind: ItemKind;
  title: string;
  /** Free text with Markdown. */
  notes: string;
  /**
   * When an event or a work block happens. Empty means unscheduled, which lives in the inbox.
   * Tasks do not use it: they have a window (`from` and `due`) instead.
   */
  schedule: Schedule | null;
  /**
   * Tasks only. The first day the task is pending, such as the day a teacher assigned it.
   * Empty means the day the task was created. Needs `due`.
   */
  from: PlainDate | null;
  /** Tasks only. The delivery. The task is pending every day from `from` until it is done. */
  due: Due | null;
  agendaId: Id;
  tagIds: Id[];
  /**
   * When true (the default) the item also counts as having the tags of its parent, and of the
   * parent's parent while each one keeps this on. Only matters for an item that has a parent. Turn
   * it off for a child that does not belong to its parent's projects.
   */
  inheritTags: boolean;
  /** Required for tasks. Optional for events. */
  statusId: Id | null;
  location: string;
  links: ItemLink[];
}

export interface Tag extends SyncFields {
  name: string;
  parentId: Id | null;
  /** Empty means global. A filled list restricts the tag to those agendas. */
  agendaIds: Id[];
  color: string;
}

/** What the app understands about a status group. Names are free. */
export type StatusRole = 'planned' | 'started' | 'done';

export interface StatusGroup extends SyncFields {
  name: string;
  role: StatusRole;
  order: number;
}

/** A status is also a Kanban column. */
export interface Status extends SyncFields {
  name: string;
  groupId: Id;
  order: number;
}

export type DayPeriod = 'dawn' | 'morning' | 'afternoon' | 'evening';

/** Hours (0 to 24) where the morning, the afternoon and the evening start. Dawn starts at 0. */
export interface PeriodBounds {
  morningStart: number;
  afternoonStart: number;
  eveningStart: number;
}

export interface Settings {
  /** An IANA name, or auto to follow the device. */
  displayTimeZone: string;
  periodBounds: PeriodBounds;
}

/** A chip of the "when" filter: a day period, or `untimed` (whole-day events and task strips). */
export type SavedViewPeriod = DayPeriod | 'untimed';

/**
 * The sieves of a saved view. It has the same shape as `ItemFilter` in `filters`, written out here
 * because the core cannot import the layers above it. A test keeps the two in step.
 */
export interface SavedViewFilter {
  tagIds: Id[];
  kinds: ItemKind[];
  periods: SavedViewPeriod[];
  text: string;
  dueWithinDays: number | null;
}

/**
 * What the person chose to see in the Timeline, saved under a name: the filter, which agendas are
 * shown and how a day is laid out. It is plain data, so it syncs like everything else.
 */
export interface SavedView extends SyncFields {
  name: string;
  /** Position in the list of saved views. */
  order: number;
  filter: SavedViewFilter;
  /** The agendas shown. Empty (null) means every agenda, including the ones created later. */
  agendaIds: Id[] | null;
  layout: SavedViewLayout;
}
