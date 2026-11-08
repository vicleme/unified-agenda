import { useState, type FormEvent } from 'react';
import { COLOR_PRESETS } from './colorPresets';
import { ColorField } from './ColorField';
import { useI18n } from './i18n/useI18n';

export interface AgendaFormValues {
  name: string;
  color: string;
}

interface AgendaFormProps {
  /** Empty for a new agenda, filled when editing. */
  initial?: AgendaFormValues;
  onSubmit: (values: AgendaFormValues) => Promise<void>;
  onCancel: () => void;
}

/** Name and base color of one agenda. The color is user data, so it is the one place a raw hex is used. */
export function AgendaForm({ initial, onSubmit, onCancel }: AgendaFormProps) {
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? COLOR_PRESETS[0].hex);
  const [error, setError] = useState<'nameRequired' | 'saveFailed' | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed === '') {
      setError('nameRequired');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ name: trimmed, color });
    } catch {
      setError('saveFailed');
      setSaving(false);
    }
  }

  const title = initial ? t.agendas.form.editTitle : t.agendas.form.createTitle;

  return (
    <form className="panel" onSubmit={handleSubmit} noValidate aria-label={title}>
      <h3 className="panel__title">{title}</h3>

      <div className="field">
        <label htmlFor="agenda-name" className="field__label">
          {t.agendas.form.name}
        </label>
        <input
          id="agenda-name"
          className="field__input"
          type="text"
          value={name}
          maxLength={80}
          autoFocus
          aria-invalid={error === 'nameRequired'}
          aria-describedby={error === 'nameRequired' ? 'agenda-name-error' : undefined}
          onChange={(event) => {
            setName(event.target.value);
            if (error === 'nameRequired') setError(null);
          }}
        />
        {error === 'nameRequired' && (
          <p id="agenda-name-error" role="alert" className="field__error">
            {t.agendas.form.nameRequired}
          </p>
        )}
      </div>

      <ColorField
        idPrefix="agenda"
        label={t.agendas.form.color}
        customLabel={t.agendas.form.customColor}
        value={color}
        onChange={setColor}
      />

      {error === 'saveFailed' && (
        <p role="alert" className="field__error">
          {t.agendas.form.saveFailed}
        </p>
      )}

      <div className="actions">
        <button type="submit" className="button button--primary" disabled={saving}>
          {t.agendas.form.save}
        </button>
        <button type="button" className="button" onClick={onCancel} disabled={saving}>
          {t.agendas.form.cancel}
        </button>
      </div>
    </form>
  );
}
