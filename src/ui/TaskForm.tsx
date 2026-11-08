import { useMemo, useState, type FormEvent } from 'react';
import type { Status, StatusGroup } from '../core';
import { knownTimeZones } from './eventValues';
import { useI18n } from './i18n/useI18n';
import { LinksField } from './LinksField';
import { TagsField, type TagContext } from './TagsField';
import {
  emptyTaskValues,
  type DueMode,
  type TaskFieldErrors,
  type TaskFieldKey,
  type TaskFormValues,
} from './taskValues';

const DUE_MODES: DueMode[] = ['none', 'allDay', 'timed'];

/** The statuses to choose from, in their groups, in the order of the Kanban board. */
export interface StatusChoice {
  group: StatusGroup;
  statuses: Status[];
}

interface TaskFormProps {
  /** Empty for a new task, filled when editing. */
  initial?: TaskFormValues;
  /** The status chosen for a new task. */
  defaultStatusId: string;
  statusChoices: StatusChoice[];
  /** The zone dates are shown in, used to explain what an empty time zone means. */
  displayTimeZone: string;
  /** Where the tags and the inheritance switch come from. Without it the form has no tags. */
  tagContext?: TagContext;
  /** Returns the problems to show, or null when the task was saved. */
  onSubmit: (values: TaskFormValues) => Promise<TaskFieldErrors | null>;
  onCancel: () => void;
}

/** Create or edit one task: title, status, the window (start day and delivery), place and notes. */
export function TaskForm({
  initial,
  defaultStatusId,
  statusChoices,
  displayTimeZone,
  tagContext,
  onSubmit,
  onCancel,
}: TaskFormProps) {
  const { t } = useI18n();
  const [values, setValues] = useState<TaskFormValues>(initial ?? emptyTaskValues(defaultStatusId));
  const [errors, setErrors] = useState<TaskFieldErrors>({});
  const [saving, setSaving] = useState(false);
  // A new task starts on the default status, even when the statuses finish loading after the
  // form opened. Once the person chooses (or clears) the status, their choice is kept.
  const [statusTouched, setStatusTouched] = useState(false);
  const statusId = initial || statusTouched ? values.statusId : defaultStatusId;
  const zones = useMemo(() => knownTimeZones(), []);

  const title = initial ? t.items.taskForm.editTitle : t.items.taskForm.createTitle;

  function change(changes: Partial<TaskFormValues>, clear: TaskFieldKey[] = []) {
    setValues((current) => ({ ...current, ...changes }));
    if (clear.length > 0) {
      setErrors((current) => {
        const next = { ...current };
        for (const key of clear) delete next[key];
        return next;
      });
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const problems = await onSubmit({ ...values, statusId });
      if (problems) {
        setErrors(problems);
        setSaving(false);
      }
    } catch {
      setErrors({ form: 'saveFailed' });
      setSaving(false);
    }
  }

  function message(key: TaskFieldKey): string | null {
    const issue = errors[key];
    return issue ? t.items.issues[issue] : null;
  }

  function fieldError(key: TaskFieldKey, id: string) {
    const text = message(key);
    return text ? (
      <p id={id} role="alert" className="field__error">
        {text}
      </p>
    ) : null;
  }

  const hasDue = values.dueMode !== 'none';
  const timed = values.dueMode === 'timed';

  return (
    <form className="panel" onSubmit={handleSubmit} noValidate aria-label={title}>
      <h3 className="panel__title">{title}</h3>

      <div className="field">
        <label htmlFor="task-title" className="field__label">
          {t.items.form.title}
        </label>
        <input
          id="task-title"
          className="field__input"
          type="text"
          value={values.title}
          maxLength={200}
          autoFocus
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? 'task-title-error' : undefined}
          onChange={(event) => change({ title: event.target.value }, ['title'])}
        />
        {fieldError('title', 'task-title-error')}
      </div>

      <div className="field">
        <label htmlFor="task-status" className="field__label">
          {t.items.taskForm.status}
        </label>
        <select
          id="task-status"
          className="field__input"
          value={statusId}
          aria-invalid={Boolean(errors.status)}
          aria-describedby={errors.status ? 'task-status-error' : undefined}
          onChange={(event) => {
            setStatusTouched(true);
            change({ statusId: event.target.value }, ['status']);
          }}
        >
          <option value="">{t.items.taskForm.chooseStatus}</option>
          {statusChoices.map((choice) => (
            <optgroup key={choice.group.id} label={choice.group.name}>
              {choice.statuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {fieldError('status', 'task-status-error')}
      </div>

      <fieldset className="field field--group">
        <legend className="field__label">{t.items.taskForm.dueLegend}</legend>
        <div className="choices">
          {DUE_MODES.map((mode) => (
            <label key={mode} className="choice">
              <input
                type="radio"
                name="task-due-mode"
                value={mode}
                checked={values.dueMode === mode}
                onChange={() => change({ dueMode: mode }, ['due', 'from', 'timeZone'])}
              />
              {t.items.taskForm.dueModes[mode]}
            </label>
          ))}
        </div>
      </fieldset>

      {hasDue && (
        <>
          <div className="field-pair">
            <div className="field">
              <label htmlFor="task-due-date" className="field__label">
                {t.items.taskForm.dueDate}
              </label>
              <input
                id="task-due-date"
                className="field__input"
                type="date"
                value={values.dueDate}
                aria-invalid={Boolean(errors.due)}
                aria-describedby={errors.due ? 'task-due-error' : undefined}
                onChange={(event) => change({ dueDate: event.target.value }, ['due', 'from'])}
              />
            </div>
            {timed && (
              <div className="field">
                <label htmlFor="task-due-time" className="field__label">
                  {t.items.taskForm.dueTime}
                </label>
                <input
                  id="task-due-time"
                  className="field__input"
                  type="time"
                  value={values.dueTime}
                  aria-invalid={Boolean(errors.due)}
                  aria-describedby={errors.due ? 'task-due-error' : undefined}
                  onChange={(event) => change({ dueTime: event.target.value }, ['due', 'from'])}
                />
              </div>
            )}
          </div>
          {fieldError('due', 'task-due-error')}
        </>
      )}

      {timed && (
        <div className="field">
          <label htmlFor="task-zone" className="field__label">
            {t.items.form.timeZone}
          </label>
          <input
            id="task-zone"
            className="field__input"
            type="text"
            list="task-zone-list"
            value={values.timeZone}
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={Boolean(errors.timeZone)}
            aria-describedby={`task-zone-hint${errors.timeZone ? ' task-zone-error' : ''}`}
            onChange={(event) => change({ timeZone: event.target.value }, ['timeZone'])}
          />
          <datalist id="task-zone-list">
            {zones.map((zone) => (
              <option key={zone} value={zone} />
            ))}
          </datalist>
          <p id="task-zone-hint" className="field__hint">
            {t.items.form.timeZoneHint.replace('{zone}', displayTimeZone)}
          </p>
          {fieldError('timeZone', 'task-zone-error')}
        </div>
      )}

      <div className="field">
        <label htmlFor="task-from" className="field__label">
          {t.items.taskForm.from}
        </label>
        <input
          id="task-from"
          className="field__input"
          type="date"
          value={values.from}
          aria-invalid={Boolean(errors.from)}
          aria-describedby={`task-from-hint${errors.from ? ' task-from-error' : ''}`}
          onChange={(event) => change({ from: event.target.value }, ['from'])}
        />
        <p id="task-from-hint" className="field__hint">
          {t.items.taskForm.fromHint}
        </p>
        {fieldError('from', 'task-from-error')}
      </div>

      <div className="field">
        <label htmlFor="task-location" className="field__label">
          {t.items.form.location}
        </label>
        <input
          id="task-location"
          className="field__input"
          type="text"
          value={values.location}
          onChange={(event) => change({ location: event.target.value })}
        />
      </div>

      <div className="field">
        <label htmlFor="task-notes" className="field__label">
          {t.items.form.notes}
        </label>
        <textarea
          id="task-notes"
          className="field__input field__input--area"
          rows={4}
          value={values.notes}
          onChange={(event) => change({ notes: event.target.value })}
        />
      </div>

      {tagContext && (
        <TagsField
          idPrefix="task"
          context={tagContext}
          tagIds={values.tagIds}
          inheritTags={values.inheritTags}
          onChange={(changes) => change(changes)}
        />
      )}

      <LinksField
        idPrefix="task"
        links={values.links}
        error={message('links')}
        onChange={(links) => change({ links }, ['links'])}
      />

      {fieldError('form', 'task-form-error')}

      <div className="actions">
        <button type="submit" className="button button--primary" disabled={saving}>
          {t.items.form.save}
        </button>
        <button type="button" className="button" onClick={onCancel} disabled={saving}>
          {t.items.form.cancel}
        </button>
      </div>
    </form>
  );
}
