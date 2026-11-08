import { COLOR_PRESETS } from './colorPresets';
import { useI18n } from './i18n/useI18n';

interface ColorFieldProps {
  /** Makes the ids unique when two forms use the field. */
  idPrefix: string;
  label: string;
  customLabel: string;
  value: string;
  onChange: (hex: string) => void;
}

/** Eight ready tones plus the browser color picker. Shared by the agenda and tag forms. */
export function ColorField({ idPrefix, label, customLabel, value, onChange }: ColorFieldProps) {
  const { t } = useI18n();
  const labelId = `${idPrefix}-color-label`;
  return (
    <div className="field">
      <span id={labelId} className="field__label">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="swatches">
        {COLOR_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            role="radio"
            aria-checked={value === preset.hex}
            aria-label={t.agendas.colors[preset.key]}
            className="swatch"
            style={{ background: preset.hex }}
            onClick={() => onChange(preset.hex)}
          />
        ))}
        <input
          type="color"
          className="swatch-input"
          aria-label={customLabel}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  );
}
