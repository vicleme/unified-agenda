import { useI18n } from './i18n/useI18n';
import { LOCALES, LOCALE_NAMES, isLocaleMode } from './i18n/locale';

export function LanguageSelect() {
  const { t, mode, setMode } = useI18n();

  return (
    <label className="select">
      <span className="visually-hidden">{t.language.label}</span>
      <select
        className="select__control"
        value={mode}
        onChange={(event) => {
          if (isLocaleMode(event.target.value)) setMode(event.target.value);
        }}
      >
        <option value="auto">{t.language.auto}</option>
        {LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {LOCALE_NAMES[locale]}
          </option>
        ))}
      </select>
    </label>
  );
}
