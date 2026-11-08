import { useMemo, useState } from 'react';
import { indexById, pathFromRoot, wouldCreateCycle, type Id, type Item } from '../core';
import { useI18n } from './i18n/useI18n';

interface MovePanelProps {
  /** The item to move. */
  item: Item;
  /** Every active item of the same agenda. */
  items: Item[];
  /** Resolves when the move is saved. A rejection shows the failure message. */
  onMove: (parentId: Id | null) => Promise<void>;
  onCancel: () => void;
}

/**
 * The touch alternative to dragging: choose the new parent from a list. The item itself and
 * everything inside it are not offered, because an item cannot go inside its own subtree.
 */
export function MovePanel({ item, items, onMove, onCancel }: MovePanelProps) {
  const { t, locale } = useI18n();
  const [target, setTarget] = useState<string>(item.parentId ?? '');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const options = useMemo(() => {
    const byId = indexById(items);
    return items
      .filter((candidate) => !wouldCreateCycle(item.id, candidate.id, items))
      .map((candidate) => ({
        id: candidate.id,
        label: pathFromRoot(candidate.id, byId)
          .map((step) => step.title)
          .join(' / '),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, locale));
  }, [item.id, items, locale]);

  async function submit() {
    setSaving(true);
    setFailed(false);
    try {
      await onMove(target === '' ? null : target);
    } catch {
      setFailed(true);
      setSaving(false);
    }
  }

  const unchanged = target === (item.parentId ?? '');

  return (
    <div role="group" aria-label={t.items.movePanel.title} className="panel">
      <h3 className="panel__title">{t.items.movePanel.title.replace('{name}', item.title)}</h3>
      <div className="field">
        <label htmlFor="move-target" className="field__label">
          {t.items.movePanel.target}
        </label>
        <select
          id="move-target"
          className="field__input"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
        >
          <option value="">{t.items.movePanel.topLevel}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {failed && (
        <p role="alert" className="field__error">
          {t.items.movePanel.failed}
        </p>
      )}
      <div className="actions">
        <button
          type="button"
          className="button button--primary"
          disabled={saving || unchanged}
          onClick={submit}
        >
          {t.items.movePanel.action}
        </button>
        <button type="button" className="button" disabled={saving} onClick={onCancel}>
          {t.items.form.cancel}
        </button>
      </div>
    </div>
  );
}
