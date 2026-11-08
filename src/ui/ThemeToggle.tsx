import { THEME_MODES, type ThemeMode } from './theme';
import { useI18n } from './i18n/useI18n';

type Props = {
  mode: ThemeMode;
  onChange: (mode: ThemeMode) => void;
};

export function ThemeToggle({ mode, onChange }: Props) {
  const { t } = useI18n();

  return (
    <div className="segmented" role="radiogroup" aria-label={t.theme.label}>
      {THEME_MODES.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={mode === option}
          className="segmented__option"
          onClick={() => onChange(option)}
        >
          {t.theme[option]}
        </button>
      ))}
    </div>
  );
}
