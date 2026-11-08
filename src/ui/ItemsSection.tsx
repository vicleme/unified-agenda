import { useState } from 'react';
import {
  childrenIndex,
  computeProgress,
  createItem,
  doneStatusIds,
  indexById,
  inheritedTags,
  pathFromRoot,
  type Id,
  type Item,
} from '../core';
import { countItemSubtree, removeItemCascade } from '../storage';
import { EventForm } from './EventForm';
import {
  buildEventFields,
  emptyEventValues,
  valuesFromItem,
  type EventFormValues,
} from './eventValues';
import { ItemTree, type ItemTreeShared } from './ItemTree';
import { MovePanel } from './MovePanel';
import { TaskForm, type StatusChoice } from './TaskForm';
import { buildTaskFields, valuesFromTask, type TaskFormValues } from './taskValues';
import { useData } from './data/useData';
import { useDisplayTimeZone } from './data/useDisplayTimeZone';
import { useAgendas, useItems, useStatusGroups, useStatuses, useTags } from './data/useEntityList';
import { formatCount } from './format';
import { useI18n } from './i18n/useI18n';

type Mode =
  | { kind: 'idle' }
  /** `parent` is the item the new one goes inside, or null for the top level of the agenda. */
  | { kind: 'create'; what: 'event' | 'task' | 'block'; parent: Item | null }
  | { kind: 'edit'; item: Item }
  | { kind: 'move'; item: Item }
  | { kind: 'delete'; item: Item; count: number; failed: boolean };

/**
 * The items of one agenda, one agenda at a time, as a tree. Events and tasks can be created,
 * edited, moved and deleted. A task can hold sub-items and work blocks, and shows its progress.
 */
export function ItemsSection() {
  const { t, locale } = useI18n();
  const { db, repos, notify } = useData();
  const agendas = useAgendas();
  const items = useItems();
  const statuses = useStatuses();
  const statusGroups = useStatusGroups();
  const tags = useTags();
  const zone = useDisplayTimeZone();
  const [chosenId, setChosenId] = useState<Id | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<Id>>(new Set());

  // The zone is read from the settings first, so a time is never shown in the wrong zone
  if (zone === null || agendas.loading) return null;

  const sortedAgendas = [...agendas.data].sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name, locale),
  );
  // If the chosen agenda was deleted, fall back to the first one
  const agenda = sortedAgendas.find((candidate) => candidate.id === chosenId) ?? sortedAgendas[0];

  if (!agenda) {
    return (
      <>
        {agendas.failed && (
          <p role="alert" className="field__error">
            {t.agendas.loadFailed}
          </p>
        )}
        <p className="placeholder">{t.items.noAgendas}</p>
      </>
    );
  }

  const agendaItems = items.data.filter((item) => item.agendaId === agenda.id);
  const byOrder = (a: Item, b: Item) => a.order - b.order || a.title.localeCompare(b.title, locale);
  const children = childrenIndex(agendaItems);
  for (const list of children.values()) list.sort(byOrder);
  const topLevel = agendaItems.filter((item) => item.parentId === null).sort(byOrder);
  const childrenOf = (id: Id): Item[] => children.get(id) ?? [];

  const progress = computeProgress(agendaItems, doneStatusIds(statuses.data, statusGroups.data));

  // The statuses in the order of the board: groups by order, columns by order inside each group
  const statusChoices: StatusChoice[] = [...statusGroups.data]
    .sort((a, b) => a.order - b.order)
    .map((group) => ({
      group,
      statuses: statuses.data
        .filter((s) => s.groupId === group.id)
        .sort((a, b) => a.order - b.order),
    }))
    .filter((choice) => choice.statuses.length > 0);
  const plannedFirst = statusChoices.find((choice) => choice.group.role === 'planned');
  const defaultStatusId = (plannedFirst ?? statusChoices[0])?.statuses[0]?.id ?? '';
  const statusNames = new Map(statuses.data.map((status) => [status.id, status.name]));

  const itemById = indexById(agendaItems);
  const tagById = new Map(tags.data.map((tag) => [tag.id, tag]));
  /** The tags a row shows: its own, and the ones it inherits with the item they come from. */
  function tagsOf(item: Item) {
    const own = item.tagIds.flatMap((id) => tagById.get(id) ?? []);
    const inherited = inheritedTags(item, itemById).flatMap((entry) => {
      const tag = tagById.get(entry.tagId);
      const from = itemById.get(entry.fromItemId);
      return tag && from ? [{ tag, from }] : [];
    });
    return { own, inherited };
  }

  /** What the tags field of a form needs. A new item is a blank draft inside its parent. */
  function tagContext(parent: Item | null, existing?: Item) {
    const base =
      existing ??
      createItem({ kind: 'task', title: '', agendaId: agenda!.id, parentId: parent?.id ?? null });
    return { tags: tags.data, items: agendaItems, base };
  }

  /** The next free position among the children of a parent (or of the top level). */
  function nextOrder(parentId: Id | null, ignoreId?: Id): number {
    return agendaItems
      .filter((item) => item.parentId === parentId && item.id !== ignoreId)
      .reduce((max, item) => Math.max(max, item.order + 1), 0);
  }

  /** Opens an item and everything above it, so a new or moved item is not hidden in a fold. */
  function reveal(id: Id | null) {
    if (id === null) return;
    const path = pathFromRoot(id, indexById(agendaItems)).map((step) => step.id);
    setExpanded((current) => new Set([...current, ...path]));
  }

  function pickAgenda(id: Id) {
    setChosenId(id);
    setMode({ kind: 'idle' });
  }

  function toggle(item: Item) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  }

  async function saveEvent(values: EventFormValues) {
    const existing = mode.kind === 'edit' ? mode.item : undefined;
    const parent = mode.kind === 'create' ? mode.parent : null;
    const result = buildEventFields(values, zone!, { agendaId: agenda!.id, existing });
    if (!result.fields) return result.errors;

    if (existing) {
      await repos.items.update(existing.id, result.fields);
    } else {
      const parentId = parent?.id ?? null;
      await repos.items.put(
        createItem({
          kind: 'event',
          agendaId: agenda!.id,
          parentId,
          order: nextOrder(parentId),
          ...result.fields,
        }),
      );
      reveal(parentId);
    }
    notify();
    setMode({ kind: 'idle' });
    return null;
  }

  async function saveTask(values: TaskFormValues) {
    const existing = mode.kind === 'edit' ? mode.item : undefined;
    const parent = mode.kind === 'create' ? mode.parent : null;
    const result = buildTaskFields(values, zone!, {
      agendaId: agenda!.id,
      parentId: parent?.id ?? null,
      existing,
    });
    if (!result.fields) return result.errors;

    if (existing) {
      await repos.items.update(existing.id, result.fields);
    } else {
      const parentId = parent?.id ?? null;
      await repos.items.put(
        createItem({
          kind: 'task',
          agendaId: agenda!.id,
          parentId,
          order: nextOrder(parentId),
          ...result.fields,
        }),
      );
      reveal(parentId);
    }
    notify();
    setMode({ kind: 'idle' });
    return null;
  }

  async function move(item: Item, parentId: Id | null) {
    await repos.items.update(item.id, { parentId, order: nextOrder(parentId, item.id) });
    reveal(parentId);
    notify();
    setMode({ kind: 'idle' });
  }

  async function askToDelete(item: Item) {
    try {
      const count = await countItemSubtree(db, item.id);
      setMode({ kind: 'delete', item, count, failed: false });
    } catch {
      setMode({ kind: 'delete', item, count: 1, failed: true });
    }
  }

  async function confirmDelete(item: Item) {
    setDeleting(true);
    try {
      await removeItemCascade(db, item.id);
      notify();
      setMode({ kind: 'idle' });
    } catch {
      setMode((current) => (current.kind === 'delete' ? { ...current, failed: true } : current));
    } finally {
      setDeleting(false);
    }
  }

  const shared: ItemTreeShared = {
    childrenOf,
    progress,
    statusNames,
    tagsOf,
    expanded,
    zone,
    onToggle: toggle,
    onEdit: (item) => setMode({ kind: 'edit', item }),
    onAddTask: (parent) => setMode({ kind: 'create', what: 'task', parent }),
    onAddBlock: (parent) => setMode({ kind: 'create', what: 'block', parent }),
    onMove: (item) => setMode({ kind: 'move', item }),
    onDelete: askToDelete,
  };

  const cancel = () => setMode({ kind: 'idle' });
  const parentOfCreate = mode.kind === 'create' ? mode.parent : null;

  return (
    <div>
      {(agendas.failed || items.failed) && (
        <p role="alert" className="field__error">
          {items.failed ? t.items.loadFailed : t.agendas.loadFailed}
        </p>
      )}

      <div className="field">
        <label htmlFor="items-agenda" className="field__label">
          {t.items.agendaLabel}
        </label>
        <select
          id="items-agenda"
          className="field__input"
          value={agenda.id}
          onChange={(event) => pickAgenda(event.target.value)}
        >
          {sortedAgendas.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
        </select>
      </div>

      {mode.kind === 'idle' && (
        <div className="actions">
          <button
            type="button"
            className="button button--primary"
            onClick={() => setMode({ kind: 'create', what: 'event', parent: null })}
          >
            {t.items.addEvent}
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={() => setMode({ kind: 'create', what: 'task', parent: null })}
          >
            {t.items.addTask}
          </button>
        </div>
      )}

      {mode.kind === 'create' && parentOfCreate && (
        <p className="field__hint">{t.items.insideOf.replace('{name}', parentOfCreate.title)}</p>
      )}

      {mode.kind === 'create' && mode.what === 'event' && (
        <EventForm
          displayTimeZone={zone}
          tagContext={tagContext(parentOfCreate)}
          onSubmit={saveEvent}
          onCancel={cancel}
        />
      )}
      {mode.kind === 'create' && mode.what === 'block' && (
        <EventForm
          initial={{ ...emptyEventValues(), mode: 'timed' }}
          heading={t.items.form.blockTitle}
          displayTimeZone={zone}
          tagContext={tagContext(parentOfCreate)}
          onSubmit={saveEvent}
          onCancel={cancel}
        />
      )}
      {mode.kind === 'create' && mode.what === 'task' && (
        <TaskForm
          defaultStatusId={defaultStatusId}
          statusChoices={statusChoices}
          displayTimeZone={zone}
          tagContext={tagContext(parentOfCreate)}
          onSubmit={saveTask}
          onCancel={cancel}
        />
      )}

      {mode.kind === 'edit' && mode.item.kind === 'event' && (
        <EventForm
          key={mode.item.id}
          initial={valuesFromItem(mode.item, zone)}
          displayTimeZone={zone}
          tagContext={tagContext(null, mode.item)}
          onSubmit={saveEvent}
          onCancel={cancel}
        />
      )}
      {mode.kind === 'edit' && mode.item.kind === 'task' && (
        <TaskForm
          key={mode.item.id}
          initial={valuesFromTask(mode.item, zone)}
          defaultStatusId={defaultStatusId}
          statusChoices={statusChoices}
          displayTimeZone={zone}
          tagContext={tagContext(null, mode.item)}
          onSubmit={saveTask}
          onCancel={cancel}
        />
      )}

      {mode.kind === 'move' && (
        <MovePanel
          key={mode.item.id}
          item={mode.item}
          items={agendaItems}
          onMove={(parentId) => move(mode.item, parentId)}
          onCancel={cancel}
        />
      )}

      {mode.kind === 'delete' && (
        <div role="alertdialog" aria-labelledby="item-delete-text" className="panel panel--danger">
          <p id="item-delete-text" className="panel__text">
            {formatCount(locale, mode.count, t.items.confirm).replace('{name}', mode.item.title)}
          </p>
          {mode.failed && (
            <p role="alert" className="field__error">
              {t.items.deleteFailed}
            </p>
          )}
          <div className="actions">
            <button
              type="button"
              className="button button--danger"
              disabled={deleting}
              onClick={() => confirmDelete(mode.item)}
            >
              {t.items.confirmAction}
            </button>
            <button type="button" className="button" disabled={deleting} onClick={cancel}>
              {t.items.form.cancel}
            </button>
          </div>
        </div>
      )}

      {!items.loading && topLevel.length === 0 && mode.kind === 'idle' && (
        <p className="placeholder">{t.items.empty}</p>
      )}

      {topLevel.length > 0 && <ItemTree items={topLevel} shared={shared} />}
    </div>
  );
}
