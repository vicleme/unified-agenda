import {
  isActive,
  tagsForFilter,
  type Agenda,
  type AgendaGroup,
  type FilterTag,
  type Id,
  type Item,
  type Tag,
} from '../core';
import type { ItemFilter } from './types';

/*
 * Which agendas the person wants to see. Analogy: a row of light switches, one per agenda, plus a
 * master switch per group that flips all the switches of its agendas at once.
 *
 * It is plain data (a list of ids or null), so a saved view can store it as JSON later.
 *
 * - `null` means every agenda, including the ones created later. This is the default, so a new
 *   agenda shows up by itself.
 * - A list means exactly those agendas. An empty list is allowed: the person hid everything.
 *
 * Agendas that were deleted are ignored when the list is read, so deleting an agenda never leaves
 * a selection that points at nothing. If every agenda the list named is gone, the selection falls
 * back to showing everything, instead of leaving a screen that is empty for no visible reason.
 */
export type AgendaSelection = Id[] | null;

export const ALL_AGENDAS: AgendaSelection = null;

/** The shown state of a group: all its agendas, only some of them, or none. */
export type GroupState = 'all' | 'some' | 'none';

/** The order the agendas have in the app: by `order`, then by name, then by id. */
export function compareAgendas(a: Agenda, b: Agenda): number {
  return (
    a.order - b.order || a.name.localeCompare(b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

function activeAgendas(agendas: readonly Agenda[]): Agenda[] {
  return agendas.filter(isActive).sort(compareAgendas);
}

/** The ids of the agendas that are shown, in the order of the agendas. */
export function visibleAgendaIds(selection: AgendaSelection, agendas: readonly Agenda[]): Id[] {
  const active = activeAgendas(agendas);
  if (selection === null) return active.map((agenda) => agenda.id);
  const chosen = new Set(selection);
  const kept = active.filter((agenda) => chosen.has(agenda.id));
  if (kept.length === 0 && selection.length > 0) return active.map((agenda) => agenda.id);
  return kept.map((agenda) => agenda.id);
}

/** True when some agenda is hidden, so the interface can say that something is filtered out. */
export function isAgendaSelectionActive(
  selection: AgendaSelection,
  agendas: readonly Agenda[],
): boolean {
  return visibleAgendaIds(selection, agendas).length < activeAgendas(agendas).length;
}

/** Turns a set of shown agendas into a selection. Showing all of them is `null` (the default). */
function toSelection(shown: ReadonlySet<Id>, active: readonly Agenda[]): AgendaSelection {
  if (active.every((agenda) => shown.has(agenda.id))) return null;
  return active.filter((agenda) => shown.has(agenda.id)).map((agenda) => agenda.id);
}

/** Shows exactly these agendas. Unknown and deleted ids are ignored. */
export function selectAgendas(ids: readonly Id[], agendas: readonly Agenda[]): AgendaSelection {
  return toSelection(new Set(ids), activeAgendas(agendas));
}

/** Shows an agenda that is hidden, or hides one that is shown. An unknown id changes nothing. */
export function toggleAgenda(
  selection: AgendaSelection,
  agendaId: Id,
  agendas: readonly Agenda[],
): AgendaSelection {
  const active = activeAgendas(agendas);
  if (!active.some((agenda) => agenda.id === agendaId)) return selection;
  const shown = new Set(visibleAgendaIds(selection, agendas));
  if (shown.has(agendaId)) shown.delete(agendaId);
  else shown.add(agendaId);
  return toSelection(shown, active);
}

/** The agendas of a group that still exist, without repeats. */
function groupMembers(group: AgendaGroup, active: readonly Agenda[]): Id[] {
  const members = new Set(group.agendaIds);
  return active.filter((agenda) => members.has(agenda.id)).map((agenda) => agenda.id);
}

/** Whether all, some or none of the group's agendas are shown. A group with no agenda is none. */
export function groupState(
  group: AgendaGroup,
  selection: AgendaSelection,
  agendas: readonly Agenda[],
): GroupState {
  const members = groupMembers(group, activeAgendas(agendas));
  if (members.length === 0) return 'none';
  const shown = new Set(visibleAgendaIds(selection, agendas));
  const count = members.filter((id) => shown.has(id)).length;
  if (count === 0) return 'none';
  return count === members.length ? 'all' : 'some';
}

/**
 * One action for the whole group. When all its agendas are shown it hides them. Otherwise (some or
 * none shown) it shows them all. An agenda that belongs to two groups follows whichever group was
 * used last. A group with no agenda changes nothing.
 */
export function toggleGroup(
  selection: AgendaSelection,
  group: AgendaGroup,
  agendas: readonly Agenda[],
): AgendaSelection {
  const active = activeAgendas(agendas);
  const members = groupMembers(group, active);
  if (members.length === 0) return selection;
  const hide = groupState(group, selection, agendas) === 'all';
  const shown = new Set(visibleAgendaIds(selection, agendas));
  for (const id of members) {
    if (hide) shown.delete(id);
    else shown.add(id);
  }
  return toSelection(shown, active);
}

/**
 * The items that belong to a shown agenda, in the same order. Returns the same list when the
 * selection is `null`. Inherited tags are found by looking at the parents, so run the tag, type and
 * text sieves (`filterItems`) on the whole list first and cut by agenda after. That way a child
 * still counts the tags of a parent that sits in a hidden agenda.
 */
export function filterByAgendas(
  items: readonly Item[],
  selection: AgendaSelection,
  agendas: readonly Agenda[],
): readonly Item[] {
  if (selection === null) return items;
  const shown = new Set(visibleAgendaIds(selection, agendas));
  return items.filter((item) => shown.has(item.agendaId));
}

/**
 * The tags the filter offers for the shown agendas: the ones valid in at least one of them, with
 * `partial` set for the ones that exist in only part of the selection. When every agenda is hidden
 * there is nothing to narrow by, so all tags are offered.
 */
export function tagsForSelection(
  tags: readonly Tag[],
  selection: AgendaSelection,
  agendas: readonly Agenda[],
): FilterTag[] {
  const shown = visibleAgendaIds(selection, agendas);
  if (shown.length === 0) return tags.filter(isActive).map((tag) => ({ tag, partial: false }));
  return tagsForFilter(tags, shown);
}

/**
 * Takes out of the tag filter the tags that are not offered for the shown agendas any more (for
 * example the tag of an agenda that was just hidden), so the filter never waits for a tag that can
 * not be unticked in the panel. Returns those tags, to tell the person, and the same filter object
 * when nothing was taken out.
 */
export function dropUnavailableTags(
  filter: ItemFilter,
  tags: readonly Tag[],
  selection: AgendaSelection,
  agendas: readonly Agenda[],
): { filter: ItemFilter; dropped: Tag[] } {
  const offered = new Set(tagsForSelection(tags, selection, agendas).map((entry) => entry.tag.id));
  const active = new Map(tags.filter(isActive).map((tag) => [tag.id, tag]));
  const dropped = filter.tagIds
    .filter((id) => active.has(id) && !offered.has(id))
    .map((id) => active.get(id)!);
  if (dropped.length === 0) return { filter, dropped };
  const gone = new Set(dropped.map((tag) => tag.id));
  return { filter: { ...filter, tagIds: filter.tagIds.filter((id) => !gone.has(id)) }, dropped };
}
