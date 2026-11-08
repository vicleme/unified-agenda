import {
  isActive,
  type Agenda,
  type Id,
  type SavedView,
  type SavedViewFilter,
  type SavedViewLayout,
} from '../core';
import { ALL_AGENDAS, visibleAgendaIds, type AgendaSelection } from './agendas';
import { DEFAULT_LAYOUT, type AgendaLayout } from './layout';
import { EMPTY_FILTER, isValidDueWithin, type ItemFilter } from './types';

/*
 * What a saved view stores, seen from the screen. Analogy: a photo of the control panel. The panel
 * has three groups of switches (the sieves, which agendas are shown and how a day is laid out).
 * Saving a view takes a photo, applying one sets every switch back to the photo, and "changed"
 * means the switches no longer match it.
 *
 * Everything here is plain data in and out, with no React and no storage.
 */

/** The three groups of switches of the Timeline. */
export interface TimelineControls {
  filter: ItemFilter;
  selection: AgendaSelection;
  layout: AgendaLayout;
}

/** The controls with nothing filtered, every agenda shown and the days mixed. */
export const DEFAULT_CONTROLS: TimelineControls = {
  filter: EMPTY_FILTER,
  selection: ALL_AGENDAS,
  layout: DEFAULT_LAYOUT,
};

/** The part of a saved view that comes from the controls (the rest is name and position). */
export interface ViewSnapshot {
  filter: SavedViewFilter;
  agendaIds: Id[] | null;
  layout: SavedViewLayout;
}

/** The longest name a saved view can have. */
export const VIEW_NAME_MAX = 80;

/** Takes the photo. The lists are copied, so changing the controls later never changes a view. */
export function snapshotControls(controls: TimelineControls): ViewSnapshot {
  const { filter, selection, layout } = controls;
  return {
    filter: {
      tagIds: [...filter.tagIds],
      kinds: [...filter.kinds],
      periods: [...filter.periods],
      text: filter.text,
      dueWithinDays: filter.dueWithinDays,
    },
    agendaIds: selection === null ? null : [...selection],
    layout,
  };
}

/** Sets the controls back to a saved view. The lists are copied. */
export function controlsFromView(view: SavedView): TimelineControls {
  return {
    filter: {
      tagIds: [...view.filter.tagIds],
      kinds: [...view.filter.kinds],
      periods: [...view.filter.periods],
      text: view.filter.text,
      dueWithinDays: view.filter.dueWithinDays,
    },
    selection: view.agendaIds === null ? ALL_AGENDAS : [...view.agendaIds],
    layout: view.layout,
  };
}

function sameSet<T>(a: readonly T[], b: readonly T[]): boolean {
  const left = new Set(a);
  const right = new Set(b);
  return left.size === right.size && [...left].every((value) => right.has(value));
}

/** A limit that does not count (empty, negative, decimal) is the same as no limit. */
function dueLimit(value: number | null): number | null {
  return isValidDueWithin(value) ? value : null;
}

/**
 * True when the controls still show exactly what the view saved. The order of the ticked boxes does
 * not matter, and the agendas are compared by what is shown: "every agenda" and a list naming all
 * the agendas that exist look the same on the screen, so they count as the same.
 */
export function isViewCurrent(
  view: SavedView,
  controls: TimelineControls,
  agendas: readonly Agenda[],
): boolean {
  const saved = controlsFromView(view);
  return (
    view.layout === controls.layout &&
    sameSet(saved.filter.tagIds, controls.filter.tagIds) &&
    sameSet(saved.filter.kinds, controls.filter.kinds) &&
    sameSet(saved.filter.periods, controls.filter.periods) &&
    saved.filter.text.trim() === controls.filter.text.trim() &&
    dueLimit(saved.filter.dueWithinDays) === dueLimit(controls.filter.dueWithinDays) &&
    sameSet(
      visibleAgendaIds(saved.selection, agendas),
      visibleAgendaIds(controls.selection, agendas),
    )
  );
}

/** Active views in the order they are listed: by `order`, then by name, then by id. */
export function sortSavedViews(views: readonly SavedView[], locale?: string): SavedView[] {
  return views
    .filter(isActive)
    .sort(
      (a, b) =>
        a.order - b.order ||
        a.name.localeCompare(b.name, locale) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
}

/** The position for a new view: after the last one. */
export function nextViewOrder(views: readonly SavedView[]): number {
  return views.filter(isActive).reduce((max, view) => Math.max(max, view.order + 1), 0);
}

export type ViewNameProblem = 'empty' | 'duplicate';

function nameKey(name: string): string {
  return name.trim().toLocaleLowerCase();
}

/**
 * Why a name can not be used, or null when it can. A name has to have something in it and can not
 * repeat the name of another view (ignoring case and the spaces around it). Pass `ignoreId` when
 * renaming, so a view does not clash with itself.
 */
export function viewNameProblem(
  name: string,
  views: readonly SavedView[],
  ignoreId?: Id,
): ViewNameProblem | null {
  const key = nameKey(name);
  if (key === '') return 'empty';
  const taken = views.some(
    (view) => isActive(view) && view.id !== ignoreId && nameKey(view.name) === key,
  );
  return taken ? 'duplicate' : null;
}
