import { useState } from 'react';
import { createAgenda, moveStep, type Agenda, type Id } from '../core';
import { countAgendaItems, removeAgendaCascade } from '../storage';
import { AgendaForm, type AgendaFormValues } from './AgendaForm';
import { useData } from './data/useData';
import { useAgendas, useItems } from './data/useEntityList';
import { formatCount } from './format';
import { useI18n } from './i18n/useI18n';

type Mode =
  | { kind: 'idle' }
  | { kind: 'create' }
  | { kind: 'edit'; agenda: Agenda }
  | { kind: 'delete'; agenda: Agenda; count: number; failed: boolean };

/** List, create, edit and delete agendas. Deleting always goes through the cascade. */
export function AgendasSection() {
  const { t, locale } = useI18n();
  const { db, repos, notify } = useData();
  const agendas = useAgendas();
  const items = useItems();
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [deleting, setDeleting] = useState(false);
  const [orderFailed, setOrderFailed] = useState(false);

  const sorted = [...agendas.data].sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name, locale),
  );

  async function save(values: AgendaFormValues) {
    if (mode.kind === 'edit') {
      await repos.agendas.update(mode.agenda.id, values);
    } else {
      const order = agendas.data.reduce((max, agenda) => Math.max(max, agenda.order + 1), 0);
      await repos.agendas.put(createAgenda({ ...values, order }));
    }
    notify();
    setMode({ kind: 'idle' });
  }

  async function move(id: Id, step: -1 | 1) {
    setOrderFailed(false);
    try {
      const changes = moveStep(sorted, id, step);
      await Promise.all(
        changes.map((change) => repos.agendas.update(change.id, { order: change.order })),
      );
      notify();
    } catch {
      setOrderFailed(true);
    }
  }

  async function askToDelete(agenda: Agenda) {
    try {
      const count = await countAgendaItems(db, agenda.id);
      setMode({ kind: 'delete', agenda, count, failed: false });
    } catch {
      setMode({ kind: 'delete', agenda, count: 0, failed: true });
    }
  }

  async function confirmDelete(agenda: Agenda) {
    setDeleting(true);
    try {
      await removeAgendaCascade(db, agenda.id);
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
      {agendas.failed && (
        <p role="alert" className="field__error">
          {t.agendas.loadFailed}
        </p>
      )}

      {mode.kind === 'idle' && (
        <button
          type="button"
          className="button button--primary"
          onClick={() => setMode({ kind: 'create' })}
        >
          {t.agendas.add}
        </button>
      )}

      {mode.kind === 'create' && (
        <AgendaForm onSubmit={save} onCancel={() => setMode({ kind: 'idle' })} />
      )}
      {mode.kind === 'edit' && (
        <AgendaForm
          key={mode.agenda.id}
          initial={{ name: mode.agenda.name, color: mode.agenda.color }}
          onSubmit={save}
          onCancel={() => setMode({ kind: 'idle' })}
        />
      )}

      {mode.kind === 'delete' && (
        <div
          role="alertdialog"
          aria-labelledby="agenda-delete-text"
          className="panel panel--danger"
        >
          <p id="agenda-delete-text" className="panel__text">
            {formatCount(locale, mode.count, t.agendas.confirm).replace('{name}', mode.agenda.name)}
          </p>
          {mode.failed && (
            <p role="alert" className="field__error">
              {t.agendas.deleteFailed}
            </p>
          )}
          <div className="actions">
            <button
              type="button"
              className="button button--danger"
              disabled={deleting}
              onClick={() => confirmDelete(mode.agenda)}
            >
              {t.agendas.confirmAction}
            </button>
            <button
              type="button"
              className="button"
              disabled={deleting}
              onClick={() => setMode({ kind: 'idle' })}
            >
              {t.agendas.form.cancel}
            </button>
          </div>
        </div>
      )}

      {!agendas.loading && sorted.length === 0 && mode.kind === 'idle' && (
        <p className="placeholder">{t.agendas.empty}</p>
      )}

      {orderFailed && (
        <p role="alert" className="field__error">
          {t.agendas.orderFailed}
        </p>
      )}

      {sorted.length > 0 && (
        <ul className="list">
          {sorted.map((agenda, index) => {
            const total = items.data.filter((item) => item.agendaId === agenda.id).length;
            return (
              <li key={agenda.id} className="list__row">
                <span
                  className="list__swatch"
                  aria-hidden="true"
                  style={{ background: agenda.color }}
                />
                <span className="list__main">
                  <span className="list__name">{agenda.name}</span>
                  <span className="list__meta">{formatCount(locale, total, t.counts.items)}</span>
                </span>
                <button
                  type="button"
                  className="button"
                  disabled={index === 0}
                  aria-label={t.agendas.moveUp.replace('{name}', agenda.name)}
                  onClick={() => move(agenda.id, -1)}
                >
                  {t.agendas.up}
                </button>
                <button
                  type="button"
                  className="button"
                  disabled={index === sorted.length - 1}
                  aria-label={t.agendas.moveDown.replace('{name}', agenda.name)}
                  onClick={() => move(agenda.id, 1)}
                >
                  {t.agendas.down}
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => setMode({ kind: 'edit', agenda })}
                >
                  {t.agendas.edit.replace('{name}', agenda.name)}
                </button>
                <button type="button" className="button" onClick={() => askToDelete(agenda)}>
                  {t.agendas.remove.replace('{name}', agenda.name)}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
