import { useState, type FormEvent } from 'react';
import type { Agenda, Id } from '../core';
import { useI18n } from './i18n/useI18n';

export interface AgendaGroupFormValues {
  name: string;
  agendaIds: Id[];
}

interface AgendaGroupFormProps {
  /** Empty for a new group, filled when editing. */
  initial?: AgendaGroupFormValues;
  /** Every agenda, in the order they are shown. */
  agendas: Agenda[];
  onSubmit: (values: AgendaGroupFormValues) => Promise<void>;
  onCancel: () => void;
}

/** Name and member agendas of one group. */
export function AgendaGroupForm({ initial, agendas, onSubmit, onCancel }: AgendaGroupFormProps) {
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name ?? '');
  const [agendaIds, setAgendaIds] = useState<Id[]>(initial?.agendaIds ?? []);
  const [error, setError] = useState<'nameRequired' | 'saveFailed' | null>(null);
  const [saving, setSaving] = useState(false);

  function toggle(id: Id, checked: boolean) {
    setAgendaIds((current) =>
      checked ? [...current, id] : current.filter((existing) => existing !== id),
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed === '') {
      setError('nameRequired');
      return;
    }
    setSaving(true);
    try {
      // Saved in the order of the agendas, whatever order the boxes were ticked in
      await onSubmit({
        name: trimmed,
        agendaIds: agendas.filter((agenda) => agendaIds.includes(agenda.id)).map((a) => a.id),
      });
    } catch {
      setError('saveFailed');
      setSaving(false);
    }
  }

  const title = initial ? t.groups.form.editTitle : t.groups.form.createTitle;

  return (
    <form className="panel" onSubmit={handleSubmit} noValidate aria-label={title}>
      <h3 className="panel__title">{title}</h3>

      <div className="field">
        <label htmlFor="group-name" className="field__label">
          {t.groups.form.name}
        </label>
        <input
          id="group-name"
          className="field__input"
          type="text"
          value={name}
          maxLength={80}
          autoFocus
          aria-invalid={error === 'nameRequired'}
          aria-describedby={error === 'nameRequired' ? 'group-name-error' : undefined}
          onChange={(event) => {
            setName(event.target.value);
            if (error === 'nameRequired') setError(null);
          }}
        />
        {error === 'nameRequired' && (
          <p id="group-name-error" role="alert" className="field__error">
            {t.groups.form.nameRequired}
          </p>
        )}
      </div>

      <fieldset className="field field--group">
        <legend className="field__label">{t.groups.form.agendas}</legend>
        {agendas.length === 0 ? (
          <p className="field__hint">{t.groups.form.createAgendaFirst}</p>
        ) : (
          <>
            <p className="field__hint">{t.groups.form.agendasHint}</p>
            {agendas.map((agenda) => (
              <label key={agenda.id} className="check">
                <input
                  type="checkbox"
                  checked={agendaIds.includes(agenda.id)}
                  onChange={(event) => toggle(agenda.id, event.target.checked)}
                />
                <span>{agenda.name}</span>
              </label>
            ))}
          </>
        )}
      </fieldset>

      {error === 'saveFailed' && (
        <p role="alert" className="field__error">
          {t.groups.form.saveFailed}
        </p>
      )}

      <div className="actions">
        <button type="submit" className="button button--primary" disabled={saving}>
          {t.groups.form.save}
        </button>
        <button type="button" className="button" onClick={onCancel} disabled={saving}>
          {t.groups.form.cancel}
        </button>
      </div>
    </form>
  );
}
