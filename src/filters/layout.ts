import {
  isActive,
  type Agenda,
  type AgendaGroup,
  type Id,
  type OverdueEntry,
  type TimelineDay,
} from '../core';
import { compareAgendas } from './agendas';

/*
 * How the shown agendas are laid out inside each day. Analogy: one pile of cards per day, or the
 * same cards dealt into a pile per agenda, or into a pile per group of agendas.
 *
 * - `mixed`: one list per day, all agendas together, in time order (what the Timeline did so far).
 * - `separate`: one section per agenda, in the order of the agendas.
 * - `grouped`: one section per agenda group, in the order of the groups, plus a last section for
 *   the agendas that are in no group. An agenda listed in two groups goes to the first of them
 *   (by group order), so an item is never shown twice.
 *
 * Inside a section the order is the one the day already had (time order). A section with nothing
 * in it is never returned, and a day with nothing returns no section at all.
 *
 * Like the selection, the layout is a plain string, so a saved view can store it.
 */
export type AgendaLayout = 'mixed' | 'separate' | 'grouped';

export const DEFAULT_LAYOUT: AgendaLayout = 'mixed';

export const AGENDA_LAYOUTS: readonly AgendaLayout[] = ['mixed', 'separate', 'grouped'];

export function isAgendaLayout(value: unknown): value is AgendaLayout {
  return typeof value === 'string' && (AGENDA_LAYOUTS as readonly string[]).includes(value);
}

export type SectionKind = 'all' | 'agenda' | 'group' | 'ungrouped';

/** What a section is, so the screen can write its title. The names come from the entities. */
export interface SectionInfo {
  /** Stable, to use as a React key and to remember which sections are folded. */
  key: string;
  kind: SectionKind;
  /** Set for `agenda` sections. */
  agendaId: Id | null;
  /** Set for `group` sections. */
  groupId: Id | null;
}

export interface DaySection {
  info: SectionInfo;
  day: TimelineDay;
}

export interface OverdueSection {
  info: SectionInfo;
  entries: OverdueEntry[];
}

/** The sections of a layout and the rule that sends an agenda to one of them. Build it once. */
export interface LayoutPlan {
  layout: AgendaLayout;
  /** The sections in the order they are shown. In `mixed` there is only the `all` one. */
  sections: readonly SectionInfo[];
  /** The key of the section an agenda belongs to. */
  keyOf: (agendaId: Id) => string;
}

const ALL_SECTION: SectionInfo = { key: 'all', kind: 'all', agendaId: null, groupId: null };
const UNGROUPED_SECTION: SectionInfo = {
  key: 'ungrouped',
  kind: 'ungrouped',
  agendaId: null,
  groupId: null,
};

const agendaKey = (agendaId: Id) => `agenda:${agendaId}`;
const groupKey = (groupId: Id) => `group:${groupId}`;

function compareGroups(a: AgendaGroup, b: AgendaGroup): number {
  return (
    a.order - b.order || a.name.localeCompare(b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/**
 * Builds the plan for a layout. Pass every agenda (the plan only shows the sections that have
 * something in them, so hidden agendas never show up). Deleted agendas and groups are ignored.
 */
export function createLayoutPlan(
  layout: AgendaLayout,
  agendas: readonly Agenda[],
  groups: readonly AgendaGroup[],
): LayoutPlan {
  if (layout === 'separate') {
    return {
      layout,
      sections: agendas
        .filter(isActive)
        .sort(compareAgendas)
        .map((agenda) => ({
          key: agendaKey(agenda.id),
          kind: 'agenda' as const,
          agendaId: agenda.id,
          groupId: null,
        })),
      keyOf: agendaKey,
    };
  }

  if (layout === 'grouped') {
    const active = groups.filter(isActive).sort(compareGroups);
    const owner = new Map<Id, Id>();
    for (const group of active) {
      for (const agendaId of group.agendaIds) {
        if (!owner.has(agendaId)) owner.set(agendaId, group.id);
      }
    }
    return {
      layout,
      sections: [
        ...active.map((group) => ({
          key: groupKey(group.id),
          kind: 'group' as const,
          agendaId: null,
          groupId: group.id,
        })),
        UNGROUPED_SECTION,
      ],
      keyOf: (agendaId) => {
        const groupId = owner.get(agendaId);
        return groupId === undefined ? UNGROUPED_SECTION.key : groupKey(groupId);
      },
    };
  }

  return { layout: 'mixed', sections: [ALL_SECTION], keyOf: () => ALL_SECTION.key };
}

/** Splits a list into one list per section key, keeping the order inside each. */
function partition<T>(
  entries: readonly T[],
  agendaIdOf: (entry: T) => Id,
  plan: LayoutPlan,
): Map<string, T[]> {
  const buckets = new Map<string, T[]>();
  for (const entry of entries) {
    const key = plan.keyOf(agendaIdOf(entry));
    const bucket = buckets.get(key);
    if (bucket) bucket.push(entry);
    else buckets.set(key, [entry]);
  }
  return buckets;
}

/**
 * The sections that have something, in plan order. A key the plan does not know (an item whose
 * agenda is missing from the list) still gets a section, after the known ones, as an agenda.
 */
function usedSections(plan: LayoutPlan, keys: ReadonlySet<string>): SectionInfo[] {
  const known = new Set(plan.sections.map((info) => info.key));
  const strays = [...keys].filter((key) => !known.has(key)).sort();
  return [
    ...plan.sections.filter((info) => keys.has(info.key)),
    ...strays.map((key) => ({
      key,
      kind: 'agenda' as const,
      agendaId: key.startsWith('agenda:') ? key.slice('agenda:'.length) : null,
      groupId: null,
    })),
  ];
}

/** One day dealt into sections. In `mixed` it is the day itself, or nothing when the day is empty. */
export function arrangeDay(day: TimelineDay, plan: LayoutPlan): DaySection[] {
  if (day.empty) return [];
  if (plan.layout === 'mixed') return [{ info: ALL_SECTION, day }];

  const allDay = partition(day.allDay, (entry) => entry.item.agendaId, plan);
  const timed = partition(day.timed, (entry) => entry.item.agendaId, plan);
  const open = partition(day.open, (task) => task.item.agendaId, plan);
  const keys = new Set([...allDay.keys(), ...timed.keys(), ...open.keys()]);

  return usedSections(plan, keys).map((info) => {
    const part = {
      date: day.date,
      allDay: allDay.get(info.key) ?? [],
      timed: timed.get(info.key) ?? [],
      open: open.get(info.key) ?? [],
    };
    return { info, day: { ...part, empty: false } };
  });
}

/** The overdue strip dealt into sections, with the same rules as `arrangeDay`. */
export function arrangeOverdue(entries: OverdueEntry[], plan: LayoutPlan): OverdueSection[] {
  if (entries.length === 0) return [];
  if (plan.layout === 'mixed') return [{ info: ALL_SECTION, entries }];

  const buckets = partition(entries, (entry) => entry.item.agendaId, plan);
  return usedSections(plan, new Set(buckets.keys())).map((info) => ({
    info,
    entries: buckets.get(info.key) ?? [],
  }));
}

/** One section of a day with its overdue entries too. Used for today, which carries the strip. */
export interface CombinedSection {
  info: SectionInfo;
  /** What the day has in this section. Empty lists when only overdue entries belong here. */
  day: TimelineDay;
  /** The overdue entries of this section. Empty when none. */
  overdue: OverdueEntry[];
}

/**
 * A day and its overdue strip dealt into the same sections, in plan order. A section appears when
 * the day or the strip has something for it, so an agenda that only has an overdue task still gets
 * its section. Nothing at all (an empty day and no overdue entries) returns no section. In `mixed`
 * the only section holds the day itself, untouched.
 */
export function arrangeDayWithOverdue(
  day: TimelineDay,
  overdue: OverdueEntry[],
  plan: LayoutPlan,
): CombinedSection[] {
  const daySections = new Map(arrangeDay(day, plan).map((section) => [section.info.key, section]));
  const overdueSections = new Map(
    arrangeOverdue(overdue, plan).map((section) => [section.info.key, section]),
  );
  const keys = new Set([...daySections.keys(), ...overdueSections.keys()]);

  return usedSections(plan, keys).map((info) => ({
    info,
    day: daySections.get(info.key)?.day ?? {
      date: day.date,
      allDay: [],
      timed: [],
      open: [],
      empty: day.empty,
    },
    overdue: overdueSections.get(info.key)?.entries ?? [],
  }));
}
