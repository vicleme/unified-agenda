import { useMemo, useState, type FormEvent } from 'react';
import {
  emptyEventValues,
  knownTimeZones,
  type EventFormValues,
  type FieldErrors,
  type FieldKey,
  type ScheduleMode,
} from './eventValues';
import { useI18n } from './i18n/useI18n';
import { LinksField } from './LinksField';
import { TagsField, type TagContext } from './TagsField';

const MODES: ScheduleMode[] = ['none', 'allDay', 'timed'];

interface EventFormProps {
  /** Empty for a new event, filled when editing. */
  initial?: EventFormValues;
  /** Overrides the title of the form, for example for a work block. */
  heading?: string;
  /** The zone dates are shown in, used to explain what an empty time zone means. */
  displayTimeZone: string;
  /** Where the tags and the inheritance switch come from. Without it the form has no tags. */
  tagContext?: TagContext;
  /** Returns the problems to show, or null when the event was saved. */
  onSubmit: (values: EventFormValues) => Promise<FieldErrors | null>;
  onCancel: () => void;
}

/** Create or edit one event: title, when, place, notes and links. */
export function EventForm({
  initial,
  heading,
  displayTimeZone,
  tagContext,
  onSubmit,
  onCancel,
}: EventFormProps) {
  const { t } = useI18n();
  const [values, setValues] = useState<EventFormValues>(initial ?? emptyEventValues());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const zones = useMemo(() => knownTimeZones(), []);

  const title = heading ?? (initial ? t.items.form.editTitle : t.items.form.createTitle);

  function change(changes: Partial<EventFormValues>, clear: FieldKey[] = []) {
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
      const problems = await onSubmit(values);
      if (problems) {
        setErrors(problems);
        setSaving(false);
      }
    } catch {
      setErrors({ form: 'saveFailed' });
      setSaving(false);
    }
  }

  function message(key: FieldKey): string | null {
    const issue = errors[key];
    if (!issue) return null;
    return t.items.issues[issue];
  }

  function fieldError(key: FieldKey, id: string) {
    const text = message(key);
    return text ? (
      <p id={id} role="alert" className="field__error">
        {text}
      </p>
    ) : null;
  }

  const timed = values.mode === 'timed';
  const scheduled = values.mode !== 'none';

  return (
    <form className="panel" onSubmit={handleSubmit} noValidate aria-label={title}>
      <h3 className="panel__title">{title}</h3>

      <div className="field">
        <label htmlFor="event-title" className="field__label">
          {t.items.form.title}
        </label>
        <input
          id="event-title"
          className="field__input"
          type="text"
          value={values.title}
          maxLength={200}
          autoFocus
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? 'event-title-error' : undefined}
          onChange={(event) => change({ title: event.target.value }, ['title'])}
        />
        {fieldError('title', 'event-title-error')}
      </div>

      <fieldset className="field field--group">
        <legend className="field__label">{t.items.form.when}</legend>
        <div className="choices">
          {MODES.map((mode) => (
            <label key={mode} className="choice">
              <input
                type="radio"
                name="event-mode"
                value={mode}
                checked={values.mode === mode}
                onChange={() => change({ mode }, ['start', 'end', 'timeZone'])}
              />
              {t.items.form.modes[mode]}
            </label>
          ))}
        </div>
      </fieldset>

      {scheduled && (
        <>
          <div className="field-pair">
            <div className="field">
              <label htmlFor="event-start-date" className="field__label">
                {t.items.form.startDate}
              </label>
              <input
                id="event-start-date"
                className="field__input"
                type="date"
                value={values.startDate}
                aria-invalid={Boolean(errors.start)}
                aria-describedby={errors.start ? 'event-start-error' : undefined}
                onChange={(event) => change({ startDate: event.target.value }, ['start', 'end'])}
              />
            </div>
            {timed && (
              <div className="field">
                <label htmlFor="event-start-time" className="field__label">
                  {t.items.form.startTime}
                </label>
                <input
                  id="event-start-time"
                  className="field__input"
                  type="time"
                  value={values.startTime}
                  aria-invalid={Boolean(errors.start)}
                  aria-describedby={errors.start ? 'event-start-error' : undefined}
                  onChange={(event) => change({ startTime: event.target.value }, ['start', 'end'])}
                />
              </div>
            )}
          </div>
          {fieldError('start', 'event-start-error')}

          <div className="field-pair">
            <div className="field">
              <label htmlFor="event-end-date" className="field__label">
                {t.items.form.endDate}
              </label>
              <input
                id="event-end-date"
                className="field__input"
                type="date"
                value={values.endDate}
                aria-invalid={Boolean(errors.end)}
                aria-describedby={errors.end ? 'event-end-error' : undefined}
                onChange={(event) => change({ endDate: event.target.value }, ['end'])}
              />
            </div>
            {timed && (
              <div className="field">
                <label htmlFor="event-end-time" className="field__label">
                  {t.items.form.endTime}
                </label>
                <input
                  id="event-end-time"
                  className="field__input"
                  type="time"
                  value={values.endTime}
                  aria-invalid={Boolean(errors.end)}
                  aria-describedby={errors.end ? 'event-end-error' : undefined}
                  onChange={(event) => change({ endTime: event.target.value }, ['end'])}
                />
              </div>
            )}
          </div>
          {fieldError('end', 'event-end-error')}
        </>
      )}

      {timed && (
        <div className="field">
          <label htmlFor="event-zone" className="field__label">
            {t.items.form.timeZone}
          </label>
          <input
            id="event-zone"
            className="field__input"
            type="text"
            list="event-zone-list"
            value={values.timeZone}
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={Boolean(errors.timeZone)}
            aria-describedby={`event-zone-hint${errors.timeZone ? ' event-zone-error' : ''}`}
            onChange={(event) => change({ timeZone: event.target.value }, ['timeZone'])}
          />
          <datalist id="event-zone-list">
            {zones.map((zone) => (
              <option key={zone} value={zone} />
            ))}
          </datalist>
          <p id="event-zone-hint" className="field__hint">
            {t.items.form.timeZoneHint.replace('{zone}', displayTimeZone)}
          </p>
          {fieldError('timeZone', 'event-zone-error')}
        </div>
      )}

      <div className="field">
        <label htmlFor="event-location" className="field__label">
          {t.items.form.location}
        </label>
        <input
          id="event-location"
          className="field__input"
          type="text"
          value={values.location}
          onChange={(event) => change({ location: event.target.value })}
        />
      </div>

      <div className="field">
        <label htmlFor="event-notes" className="field__label">
          {t.items.form.notes}
        </label>
        <textarea
          id="event-notes"
          className="field__input field__input--area"
          rows={4}
          value={values.notes}
          onChange={(event) => change({ notes: event.target.value })}
        />
      </div>

      {tagContext && (
        <TagsField
          idPrefix="event"
          context={tagContext}
          tagIds={values.tagIds}
          inheritTags={values.inheritTags}
          onChange={(changes) => change(changes)}
        />
      )}

      <LinksField
        idPrefix="event"
        links={values.links}
        error={message('links')}
        onChange={(links) => change({ links }, ['links'])}
      />

      {fieldError('form', 'event-form-error')}

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
