import { useState } from 'react';
import { createAgendaGroup, isActive, moveStep, type AgendaGroup, type Id } from '../core';
import { compareAgendas } from '../filters';
import { AgendaGroupForm, type AgendaGroupFormValues } from './AgendaGroupForm';
import { useData } from './data/useData';
import { useAgendaGroups, useAgendas } from './data/useEntityList';
import { useI18n } from './i18n/useI18n';

type Mode =
  | { kind: 'idle' }
  | { kind: 'create' }
  | { kind: 'edit'; group: AgendaGroup }
  | { kind: 'delete'; group: AgendaGroup; failed: boolean };

/**
 * List, create, edit, reorder and delete agenda groups. A group is only a named list of agendas, so
 * deleting one never touches the agendas or their items and needs no cascade.
 */
export function AgendaGroupsSection() {
  const { t, locale } = useI18n();
  const { repos, notify } = useData();
  const agendas = useAgendas();
  const groups = useAgendaGroups();
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [deleting, setDeleting] = useState(false);
  const [orderFailed, setOrderFailed] = useState(false);

  const sortedAgendas = [...agendas.data].sort(compareAgendas);
  const sorted = [...groups.data].sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name, locale),
  );

  /** The names of the agendas of a group that still exist, in the order of the agendas. */
  function memberNames(group: AgendaGroup): string[] {
    return sortedAgendas
      .filter((agenda) => isActive(agenda) && group.agendaIds.includes(agenda.id))
      .map((agenda) => agenda.name);
  }

  async function save(values: AgendaGroupFormValues) {
    if (mode.kind === 'edit') {
      await repos.agendaGroups.update(mode.group.id, values);
    } else {
      const order = groups.data.reduce((max, group) => Math.max(max, group.order + 1), 0);
      await repos.agendaGroups.put(createAgendaGroup({ ...values, order }));
    }
    notify();
    setMode({ kind: 'idle' });
  }

  async function move(id: Id, step: -1 | 1) {
    setOrderFailed(false);
    try {
      const changes = moveStep(sorted, id, step);
      await Promise.all(
        changes.map((change) => repos.agendaGroups.update(change.id, { order: change.order })),
      );
      notify();
    } catch {
      setOrderFailed(true);
    }
  }

  async function confirmDelete(group: AgendaGroup) {
    setDeleting(true);
    try {
      await repos.agendaGroups.remove(group.id);
      notify();
      setMode({ kind: 'idle' });
    } catch {
      setMode((current) => (current.kind === 'delete' ? { ...current, failed: true } : current));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      {(groups.failed || agendas.failed) && (
        <p role="alert" className="field__error">
          {t.groups.loadFailed}
        </p>
      )}

      {mode.kind === 'idle' && (
        <button
          type="button"
          className="button button--primary"
          onClick={() => setMode({ kind: 'create' })}
        >
          {t.groups.add}
        </button>
      )}

      {mode.kind === 'create' && (
        <AgendaGroupForm
          agendas={sortedAgendas}
          onSubmit={save}
          onCancel={() => setMode({ kind: 'idle' })}
        />
      )}
      {mode.kind === 'edit' && (
        <AgendaGroupForm
          key={mode.group.id}
          agendas={sortedAgendas}
          initial={{ name: mode.group.name, agendaIds: mode.group.agendaIds }}
          onSubmit={save}
          onCancel={() => setMode({ kind: 'idle' })}
        />
      )}

      {mode.kind === 'delete' && (
        <div role="alertdialog" aria-labelledby="group-delete-text" className="panel panel--danger">
          <p id="group-delete-text" className="panel__text">
            {t.groups.confirm.replace('{name}', mode.group.name)}
          </p>
          {mode.failed && (
            <p role="alert" className="field__error">
              {t.groups.deleteFailed}
            </p>
          )}
          <div className="actions">
            <button
              type="button"
              className="button button--danger"
              disabled={deleting}
              onClick={() => confirmDelete(mode.group)}
            >
              {t.groups.confirmAction}
            </button>
            <button
              type="button"
              className="button"
              disabled={deleting}
              onClick={() => setMode({ kind: 'idle' })}
            >
              {t.groups.form.cancel}
            </button>
          </div>
        </div>
      )}

      {orderFailed && (
        <p role="alert" className="field__error">
          {t.groups.orderFailed}
        </p>
      )}

      {!groups.loading && sorted.length === 0 && mode.kind === 'idle' && (
        <p className="placeholder">{t.groups.empty}</p>
      )}

      {sorted.length > 0 && (
        <ul className="list">
          {sorted.map((group, index) => {
            const names = memberNames(group);
            return (
              <li key={group.id} className="list__row">
                <span className="list__main">
                  <span className="list__name">{group.name}</span>
                  <span className="list__meta">
                    {names.length === 0 ? t.groups.noAgendas : names.join(', ')}
                  </span>
                </span>
                <button
                  type="button"
                  className="button"
                  disabled={index === 0}
                  aria-label={t.groups.moveUp.replace('{name}', group.name)}
                  onClick={() => move(group.id, -1)}
                >
                  {t.groups.up}
                </button>
                <button
                  type="button"
                  className="button"
                  disabled={index === sorted.length - 1}
                  aria-label={t.groups.moveDown.replace('{name}', group.name)}
                  onClick={() => move(group.id, 1)}
                >
                  {t.groups.down}
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => setMode({ kind: 'edit', group })}
                >
                  {t.groups.edit.replace('{name}', group.name)}
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => setMode({ kind: 'delete', group, failed: false })}
                >
                  {t.groups.remove.replace('{name}', group.name)}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
