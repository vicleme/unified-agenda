import type { LinkValues } from './eventValues';
import { useI18n } from './i18n/useI18n';

interface LinksFieldProps {
  /** Prefix for the ids, so two forms never share an id. */
  idPrefix: string;
  links: LinkValues[];
  /** The message to show, or null. */
  error: string | null;
  onChange: (links: LinkValues[]) => void;
}

/** The list of links (name and address) of an item. Shared by the event and task forms. */
export function LinksField({ idPrefix, links, error, onChange }: LinksFieldProps) {
  const { t } = useI18n();

  function change(index: number, changes: Partial<LinkValues>) {
    onChange(links.map((link, i) => (i === index ? { ...link, ...changes } : link)));
  }

  return (
    <fieldset className="field field--group">
      <legend className="field__label">{t.items.form.links}</legend>
      {links.map((link, index) => {
        const number = String(index + 1);
        return (
          <div key={index} className="link-row">
            <input
              className="field__input"
              type="text"
              value={link.label}
              aria-label={t.items.form.linkName.replace('{n}', number)}
              onChange={(event) => change(index, { label: event.target.value })}
            />
            <input
              className="field__input"
              type="url"
              inputMode="url"
              autoCapitalize="off"
              spellCheck={false}
              value={link.url}
              aria-label={t.items.form.linkAddress.replace('{n}', number)}
              aria-invalid={error !== null}
              onChange={(event) => change(index, { url: event.target.value })}
            />
            <button
              type="button"
              className="button"
              onClick={() => onChange(links.filter((_, i) => i !== index))}
            >
              {t.items.form.removeLink.replace('{n}', number)}
            </button>
          </div>
        );
      })}
      {error && (
        <p id={`${idPrefix}-links-error`} role="alert" className="field__error">
          {error}
        </p>
      )}
      <div className="actions">
        <button
          type="button"
          className="button"
          onClick={() => onChange([...links, { label: '', url: '' }])}
        >
          {t.items.form.addLink}
        </button>
      </div>
    </fieldset>
  );
}
