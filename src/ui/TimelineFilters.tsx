import { useMemo, useState, type KeyboardEvent } from 'react';
import type { Agenda, AgendaGroup, Id, ItemKind, SavedView, Tag } from '../core';
import {
  AGENDA_LAYOUTS,
  groupState,
  tagsForSelection,
  toggleAgenda,
  toggleGroup,
  visibleAgendaIds,
  type AgendaLayout,
  type AgendaSelection,
  type ItemFilter,
  type PeriodFilter,
} from '../filters';
import { useI18n } from './i18n/useI18n';
import { flattenTagTree } from './tagValues';
import { PERIOD_CHIPS, parseDueWithin, toggleValue } from './timelineFilterValues';
import { TimelineViews } from './TimelineViews';

interface TimelineFiltersProps {
  filter: ItemFilter;
  /** Every active tag. */
  tags: readonly Tag[];
  agendas: readonly Agenda[];
  groups: readonly AgendaGroup[];
  /** Which agendas are shown. */
  selection: AgendaSelection;
  /** How each day is arranged. It hides nothing, so it never counts as a filter. */
  layout: AgendaLayout;
  /** The saved views, and the one the controls came from (null for none). */
  savedViews: readonly SavedView[];
  activeViewId: Id | null;
  /** Names of the tags that were just taken out of the filter because their agenda was hidden. */
  droppedTagNames: readonly string[];
  /** How many sieves are on, the agenda selection included. Zero turns "Clear filters" off. */
  activeCount: number;
  onChange: (next: ItemFilter) => void;
  onSelectionChange: (next: AgendaSelection) => void;
  onLayoutChange: (next: AgendaLayout) => void;
  /** Sets every control to the view and makes it the active one. */
  onApplyView: (view: SavedView) => void;
  /** Changes which view is active without touching the controls. */
  onActiveViewChange: (id: Id | null) => void;
  /** Turns every sieve off, the agenda selection included. */
  onClear: () => void;
  onClose: () => void;
}

const KINDS: readonly ItemKind[] = ['event', 'task'];

/**
 * The filter panel of the Timeline. Analogy: the sieves from `src/filters` with a switch each. On
 * a phone it is a sheet over the whole screen (with a Close button), on a wide screen a card
 * under the bar. It only edits the `ItemFilter` it is given: the screen above applies it.
 */
export function TimelineFilters({
  filter,
  tags,
  agendas,
  groups,
  selection,
  layout,
  savedViews,
  activeViewId,
  droppedTagNames,
  activeCount,
  onChange,
  onSelectionChange,
  onLayoutChange,
  onApplyView,
  onActiveViewChange,
  onClear,
  onClose,
}: TimelineFiltersProps) {
  const { t, locale } = useI18n();
  const text = t.timeline.filters;
  // Only the tags that are valid in the shown agendas, the ones valid in just some marked
  const offered = useMemo(
    () => tagsForSelection(tags, selection, agendas),
    [tags, selection, agendas],
  );
  const rows = useMemo(
    () =>
      flattenTagTree(
        offered.map((entry) => entry.tag),
        locale,
      ),
    [offered, locale],
  );
  const partialIds = useMemo(
    () => new Set<Id>(offered.filter((entry) => entry.partial).map((entry) => entry.tag.id)),
    [offered],
  );
  const shownAgendaIds = useMemo(
    () => new Set(visibleAgendaIds(selection, agendas)),
    [selection, agendas],
  );
  const orderedAgendas = useMemo(
    () => [...agendas].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, locale)),
    [agendas, locale],
  );
  const orderedGroups = useMemo(
    () => [...groups].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, locale)),
    [groups, locale],
  );
  // The number is kept as typed, so a half written value does not jump around
  const [dueText, setDueText] = useState(() => String(filter.dueWithinDays ?? ''));

  // The text is shown as typed while it still means the same limit as the filter. When the filter
  // changes from outside ("Clear filters"), the field follows it instead of keeping old text.
  const dueShown =
    parseDueWithin(dueText) === filter.dueWithinDays ? dueText : String(filter.dueWithinDays ?? '');

  const update = (patch: Partial<ItemFilter>) => onChange({ ...filter, ...patch });

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') onClose();
  }

  return (
    <div
      id="timeline-filters"
      className="timeline__filters"
      role="group"
      aria-label={text.panelLabel}
      onKeyDown={onKeyDown}
    >
      <div className="timeline__filters-head">
        <h2 className="timeline__filters-title">{text.toggle}</h2>
        <div className="timeline__filters-actions">
          <button type="button" className="button" disabled={activeCount === 0} onClick={onClear}>
            {text.clear}
          </button>
          <button type="button" className="button button--primary" onClick={onClose}>
            {text.close}
          </button>
        </div>
      </div>

      <TimelineViews
        views={savedViews}
        activeId={activeViewId}
        controls={{ filter, selection, layout }}
        agendas={agendas}
        onApply={onApplyView}
        onActiveChange={onActiveViewChange}
      />

      {orderedAgendas.length > 1 && (
        <fieldset className="field field--group">
          <legend className="field__label">{text.agendasLegend}</legend>
          <p className="field__hint">{text.agendasHint}</p>
          {orderedGroups.map((group) => {
            const state = groupState(group, selection, agendas);
            return (
              <label key={group.id} className="check">
                <input
                  type="checkbox"
                  checked={state === 'all'}
                  ref={(input) => {
                    if (input) input.indeterminate = state === 'some';
                  }}
                  aria-label={text.groupLabel.replace('{name}', group.name)}
                  onChange={() => onSelectionChange(toggleGroup(selection, group, agendas))}
                />
                <span>
                  <strong>{group.name}</strong>
                </span>
              </label>
            );
          })}
          {orderedAgendas.map((agenda) => (
            <label key={agenda.id} className="check">
              <input
                type="checkbox"
                checked={shownAgendaIds.has(agenda.id)}
                onChange={() => onSelectionChange(toggleAgenda(selection, agenda.id, agendas))}
              />
              <span className="chip__dot" aria-hidden="true" style={{ background: agenda.color }} />
              <span>{agenda.name}</span>
            </label>
          ))}
          {droppedTagNames.length > 0 && (
            <p role="status" className="field__hint">
              {text.tagsDropped.replace('{names}', droppedTagNames.join(', '))}
            </p>
          )}
        </fieldset>
      )}

      {orderedAgendas.length > 1 && (
        <fieldset className="field field--group">
          <legend className="field__label">{text.layoutLegend}</legend>
          <p className="field__hint">{text.layoutHint}</p>
          {AGENDA_LAYOUTS.map((option) => (
            <label key={option} className="check">
              <input
                type="radio"
                name="timeline-layout"
                checked={layout === option}
                onChange={() => onLayoutChange(option)}
              />
              <span>{text.layouts[option]}</span>
            </label>
          ))}
        </fieldset>
      )}

      <div className="field">
        <label className="field__label" htmlFor="timeline-filter-text">
          {text.textLabel}
        </label>
        <input
          id="timeline-filter-text"
          type="search"
          className="field__input"
          value={filter.text}
          aria-describedby="timeline-filter-text-hint"
          onChange={(event) => update({ text: event.target.value })}
        />
        <p id="timeline-filter-text-hint" className="field__hint">
          {text.textHint}
        </p>
      </div>

      <fieldset className="field field--group field--inline">
        <legend className="field__label">{text.kindsLegend}</legend>
        {KINDS.map((kind) => (
          <label key={kind} className="check">
            <input
              type="checkbox"
              checked={filter.kinds.includes(kind)}
              onChange={(event) =>
                update({ kinds: toggleValue(filter.kinds, kind, event.target.checked) })
              }
            />
            <span>{t.items.kind[kind]}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="field field--group field--inline">
        <legend className="field__label">{text.periodsLegend}</legend>
        <p className="field__hint">{text.periodsHint}</p>
        {PERIOD_CHIPS.map((chip: PeriodFilter) => (
          <label key={chip} className="check">
            <input
              type="checkbox"
              checked={filter.periods.includes(chip)}
              onChange={(event) =>
                update({ periods: toggleValue(filter.periods, chip, event.target.checked) })
              }
            />
            <span>{text.periods[chip]}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="field field--group">
        <legend className="field__label">{text.tagsLegend}</legend>
        {rows.length === 0 ? (
          <p className="field__hint">{text.tagsNone}</p>
        ) : (
          <p className="field__hint">{text.tagsHint}</p>
        )}
        {rows.map(({ tag, depth }) => (
          <label
            key={tag.id}
            className="check"
            style={{ paddingInlineStart: `calc(${depth} * var(--space-4))` }}
          >
            <input
              type="checkbox"
              checked={filter.tagIds.includes(tag.id)}
              onChange={(event) =>
                update({ tagIds: toggleValue(filter.tagIds, tag.id, event.target.checked) })
              }
            />
            <span className="chip__dot" aria-hidden="true" style={{ background: tag.color }} />
            <span>{tag.name}</span>
            {partialIds.has(tag.id) && <span className="field__hint">({text.tagPartial})</span>}
          </label>
        ))}
      </fieldset>

      <div className="field">
        <label className="field__label" htmlFor="timeline-filter-due">
          {text.dueLabel}
        </label>
        <input
          id="timeline-filter-due"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          className="field__input"
          value={dueShown}
          aria-describedby="timeline-filter-due-hint"
          onChange={(event) => {
            setDueText(event.target.value);
            update({ dueWithinDays: parseDueWithin(event.target.value) });
          }}
        />
        <p id="timeline-filter-due-hint" className="field__hint">
          {text.dueHint}
        </p>
      </div>
    </div>
  );
}
