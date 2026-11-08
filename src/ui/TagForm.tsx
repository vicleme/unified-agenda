import { useId, useState, type FormEvent } from 'react';
import { effectiveScope, indexById, isActive, type Agenda, type Id, type Tag } from '../core';
import { COLOR_PRESETS } from './colorPresets';
import { ColorField } from './ColorField';
import { useI18n } from './i18n/useI18n';
import { flattenTagTree, possibleParents } from './tagValues';

export interface TagFormValues {
  name: string;
  color: string;
  parentId: Id | null;
  /** Empty means global. */
  agendaIds: Id[];
}

interface TagFormProps {
  /** The tag being edited, or null for a new one. */
  editing: Tag | null;
  tags: readonly Tag[];
  agendas: readonly Agenda[];
  onSubmit: (values: TagFormValues) => Promise<void>;
  onCancel: () => void;
}

/** Name, color, parent and the agendas where one tag is valid. */
export function TagForm({ editing, tags, agendas, onSubmit, onCancel }: TagFormProps) {
  const { t, locale } = useI18n();
  const uid = useId();
  const [name, setName] = useState(editing?.name ?? '');
  const [color, setColor] = useState(editing?.color ?? COLOR_PRESETS[0].hex);
  const [parentId, setParentId] = useState<Id | null>(editing?.parentId ?? null);
  const [agendaIds, setAgendaIds] = useState<Id[]>(editing?.agendaIds ?? []);
  const [error, setError] = useState<'nameRequired' | 'saveFailed' | null>(null);
  const [saving, setSaving] = useState(false);

  const active = tags.filter(isActive);
  const parentRows = flattenTagTree(possibleParents(editing, active), locale);
  const parentScope = parentId === null ? null : effectiveScope(parentId, indexById(active));
  const nameErrorId = `${uid}-name-error`;

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
      // Keep the order of the agenda list, so the same choice always saves the same way
      const ordered = agendas.map((agenda) => agenda.id).filter((id) => agendaIds.includes(id));
      await onSubmit({ name: trimmed, color, parentId, agendaIds: ordered });
    } catch {
      setError('saveFailed');
      setSaving(false);
    }
  }

  const title = editing ? t.tags.form.editTitle : t.tags.form.createTitle;

  return (
    <form className="panel" onSubmit={handleSubmit} noValidate aria-label={title}>
      <h3 className="panel__title">{title}</h3>

      <div className="field">
        <label htmlFor={`${uid}-name`} className="field__label">
          {t.tags.form.name}
        </label>
        <input
          id={`${uid}-name`}
          className="field__input"
          type="text"
          value={name}
          maxLength={80}
          autoFocus
          aria-invalid={error === 'nameRequired'}
          aria-describedby={error === 'nameRequired' ? nameErrorId : undefined}
          onChange={(event) => {
            setName(event.target.value);
            if (error === 'nameRequired') setError(null);
          }}
        />
        {error === 'nameRequired' && (
          <p id={nameErrorId} role="alert" className="field__error">
            {t.tags.form.nameRequired}
          </p>
        )}
      </div>

      <ColorField
        idPrefix={uid}
        label={t.tags.form.color}
        customLabel={t.tags.form.customColor}
        value={color}
        onChange={setColor}
      />

      <div className="field">
        <label htmlFor={`${uid}-parent`} className="field__label">
          {t.tags.form.parent}
        </label>
        <select
          id={`${uid}-parent`}
          className="field__input"
          value={parentId ?? ''}
          onChange={(event) => setParentId(event.target.value === '' ? null : event.target.value)}
        >
          <option value="">{t.tags.form.noParent}</option>
          {parentRows.map(({ tag, depth }) => (
            <option key={tag.id} value={tag.id}>
              {'  '.repeat(depth) + tag.name}
            </option>
          ))}
        </select>
      </div>

      {agendas.length > 0 && (
        <fieldset className="field field--group">
          <legend className="field__label">{t.tags.form.scope}</legend>
          <p className="field__hint">
            {parentScope === null ? t.tags.form.scopeHint : t.tags.form.scopeParentHint}
          </p>
          {agendas.map((agenda) => {
            const outside = parentScope !== null && !parentScope.includes(agenda.id);
            return (
              <label key={agenda.id} className="check">
                <input
                  type="checkbox"
                  checked={agendaIds.includes(agenda.id)}
                  disabled={outside}
                  onChange={(event) => toggle(agenda.id, event.target.checked)}
                />
                <span>{agenda.name}</span>
              </label>
            );
          })}
        </fieldset>
      )}

      {error === 'saveFailed' && (
        <p role="alert" className="field__error">
          {t.tags.form.saveFailed}
        </p>
      )}

      <div className="actions">
        <button type="submit" className="button button--primary" disabled={saving}>
          {t.tags.form.save}
        </button>
        <button type="button" className="button" onClick={onCancel} disabled={saving}>
          {t.tags.form.cancel}
        </button>
      </div>
    </form>
  );
}
