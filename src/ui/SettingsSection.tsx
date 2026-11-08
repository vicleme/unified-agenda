import { useEffect, useState, type FormEvent } from 'react';
import { deviceTimeZone, type Settings } from '../core';
import { loadSettings, saveSettings } from '../storage';
import { useData } from './data/useData';
import { knownTimeZones } from './eventValues';
import { useI18n } from './i18n/useI18n';
import {
  buildSettings,
  settingsToValues,
  type SettingsErrors,
  type SettingsFormValues,
} from './settingsValues';

type Loaded =
  { status: 'loading' } | { status: 'failed' } | { status: 'ready'; settings: Settings };

const HOUR_FIELDS = ['morningStart', 'afternoonStart', 'eveningStart'] as const;

/** Display time zone and the three hours that split the day into periods. */
export function SettingsSection() {
  const { t } = useI18n();
  const { db } = useData();
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    loadSettings(db)
      .then((settings) => {
        if (!cancelled) setLoaded({ status: 'ready', settings });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ status: 'failed' });
      });
    return () => {
      cancelled = true;
    };
  }, [db]);

  if (loaded.status === 'loading') return null;
  if (loaded.status === 'failed') {
    return (
      <p role="alert" className="field__error">
        {t.settings.loadFailed}
      </p>
    );
  }
  // Read once per open: this form is the only place that writes settings. Another section that
  // changes them (the backup import) is a different tab, so this one opens again afterwards.
  return <SettingsForm settings={loaded.settings} />;
}

function SettingsForm({ settings }: { settings: Settings }) {
  const { t } = useI18n();
  const { db, notify } = useData();
  const [values, setValues] = useState<SettingsFormValues>(() => settingsToValues(settings));
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [status, setStatus] = useState<'idle' | 'saved' | 'failed'>('idle');
  const [saving, setSaving] = useState(false);

  function change(patch: Partial<SettingsFormValues>) {
    setValues((current) => ({ ...current, ...patch }));
    setErrors({});
    setStatus('idle');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = buildSettings(values);
    if (!result.ok) {
      setErrors(result.errors);
      setStatus('idle');
      return;
    }
    setSaving(true);
    try {
      await saveSettings(db, result.settings);
      setStatus('saved');
      notify();
    } catch {
      setStatus('failed');
    }
    setSaving(false);
  }

  const zoneError = errors.timeZone ? t.settings.issues[errors.timeZone] : null;
  const periodsError = errors.periods ? t.settings.issues[errors.periods] : null;

  return (
    <form className="panel" onSubmit={handleSubmit} noValidate aria-label={t.settings.title}>
      <fieldset className="field field--group">
        <legend className="field__label">{t.settings.zoneLegend}</legend>
        <div className="choices">
          {(['auto', 'custom'] as const).map((mode) => (
            <label key={mode} className="choice">
              <input
                type="radio"
                name="zone-mode"
                checked={values.zoneMode === mode}
                onChange={() => change({ zoneMode: mode })}
              />
              {t.settings.zoneModes[mode]}
            </label>
          ))}
        </div>
        {values.zoneMode === 'auto' ? (
          <p className="field__hint">{t.settings.autoHint.replace('{zone}', deviceTimeZone())}</p>
        ) : (
          <>
            <label htmlFor="settings-zone" className="field__label">
              {t.settings.zoneLabel}
            </label>
            <input
              id="settings-zone"
              className="field__input"
              type="text"
              list="settings-zone-list"
              value={values.timeZone}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-invalid={Boolean(zoneError)}
              aria-describedby={`settings-zone-hint${zoneError ? ' settings-zone-error' : ''}`}
              onChange={(event) => change({ timeZone: event.target.value })}
            />
            <datalist id="settings-zone-list">
              {knownTimeZones().map((zone) => (
                <option key={zone} value={zone} />
              ))}
            </datalist>
            <p id="settings-zone-hint" className="field__hint">
              {t.settings.zoneHint}
            </p>
            {zoneError && (
              <p id="settings-zone-error" role="alert" className="field__error">
                {zoneError}
              </p>
            )}
          </>
        )}
      </fieldset>

      <fieldset className="field field--group">
        <legend className="field__label">{t.settings.periodsLegend}</legend>
        <p className="field__hint">{t.settings.periodsHint}</p>
        <div className="field-pair">
          {HOUR_FIELDS.map((field) => {
            const message = errors[field] ? t.settings.issues[errors[field]] : null;
            return (
              <div key={field} className="field">
                <label htmlFor={`settings-${field}`} className="field__label">
                  {t.settings[field]}
                </label>
                <input
                  id={`settings-${field}`}
                  className="field__input"
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={values[field]}
                  aria-invalid={Boolean(message || periodsError)}
                  aria-describedby={message ? `settings-${field}-error` : undefined}
                  onChange={(event) => change({ [field]: event.target.value })}
                />
                {message && (
                  <p id={`settings-${field}-error`} role="alert" className="field__error">
                    {message}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {periodsError && (
          <p role="alert" className="field__error">
            {periodsError}
          </p>
        )}
      </fieldset>

      {status === 'failed' && (
        <p role="alert" className="field__error">
          {t.settings.saveFailed}
        </p>
      )}
      {status === 'saved' && (
        <p role="status" className="field__status">
          {t.settings.saved}
        </p>
      )}

      <div className="actions">
        <button type="submit" className="button button--primary" disabled={saving}>
          {t.settings.save}
        </button>
      </div>
    </form>
  );
}
