import { useMemo } from 'react';
import {
  indexById,
  inheritedTags,
  isActive,
  isTagValidInAgenda,
  type Id,
  type Item,
  type Tag,
} from '../core';
import { useI18n } from './i18n/useI18n';
import { flattenTagTree } from './tagValues';

/** What the item forms need to offer tags: all the tags, the agenda's items and the item itself. */
export interface TagContext {
  /** Every active tag. The field keeps the ones valid in the item's agenda. */
  tags: readonly Tag[];
  /** The active items of the same agenda, where the parents are found. */
  items: readonly Item[];
  /** The item being edited, or a blank draft that already has its agenda and parent. */
  base: Item;
}

interface TagsFieldProps {
  idPrefix: string;
  context: TagContext;
  tagIds: Id[];
  inheritTags: boolean;
  onChange: (changes: { tagIds?: Id[]; inheritTags?: boolean }) => void;
}

/**
 * The tags of one item. A checkbox per tag that is valid in the item's agenda (plus any tag the
 * item already carries that stopped being valid, so it can be taken off). For an item inside
 * another, a switch decides whether it also counts as having its parent's tags, and the inherited
 * ones are listed dimmed with where they come from, so nobody wonders why the item shows up.
 */
export function TagsField({ idPrefix, context, tagIds, inheritTags, onChange }: TagsFieldProps) {
  const { t, locale } = useI18n();
  const { tags, items, base } = context;

  const byItem = useMemo(() => indexById(items.filter(isActive)), [items]);
  const byTag = useMemo(() => indexById(tags.filter(isActive)), [tags]);
  const parent = base.parentId === null ? undefined : byItem.get(base.parentId);

  const rows = useMemo(() => {
    const options = [...byTag.values()].filter(
      (tag) => tagIds.includes(tag.id) || isTagValidInAgenda(tag.id, base.agendaId, byTag),
    );
    return flattenTagTree(options, locale);
  }, [byTag, tagIds, base.agendaId, locale]);

  const inherited = inheritedTags({ ...base, tagIds, inheritTags }, byItem).flatMap((entry) => {
    const tag = byTag.get(entry.tagId);
    const from = byItem.get(entry.fromItemId);
    return tag && from ? [{ tag, from }] : [];
  });

  function toggle(id: Id, checked: boolean) {
    onChange({ tagIds: checked ? [...tagIds, id] : tagIds.filter((existing) => existing !== id) });
  }

  return (
    <>
      <fieldset className="field field--group">
        <legend className="field__label">{t.items.tagsField.legend}</legend>
        {rows.length === 0 && <p className="field__hint">{t.items.tagsField.none}</p>}
        {rows.map(({ tag, depth }) => (
          <label
            key={tag.id}
            className="check"
            style={{ paddingInlineStart: `calc(${depth} * var(--space-4))` }}
          >
            <input
              type="checkbox"
              checked={tagIds.includes(tag.id)}
              onChange={(event) => toggle(tag.id, event.target.checked)}
            />
            <span className="chip__dot" aria-hidden="true" style={{ background: tag.color }} />
            <span>
              {tag.name}
              {!isTagValidInAgenda(tag.id, base.agendaId, byTag) && (
                <span className="field__hint"> {t.items.tagsField.outsideScope}</span>
              )}
            </span>
          </label>
        ))}
      </fieldset>

      {parent && (
        <div className="field">
          <label className="check" htmlFor={`${idPrefix}-inherit`}>
            <input
              id={`${idPrefix}-inherit`}
              type="checkbox"
              role="switch"
              checked={inheritTags}
              aria-describedby={`${idPrefix}-inherit-hint`}
              onChange={(event) => onChange({ inheritTags: event.target.checked })}
            />
            <span>{t.items.tagsField.inherit.replace('{name}', parent.title)}</span>
          </label>
          <p id={`${idPrefix}-inherit-hint`} className="field__hint">
            {t.items.tagsField.inheritHint}
          </p>
          {inheritTags && (
            <ul className="chips" aria-label={t.items.tagsField.inheritedList}>
              {inherited.length === 0 && (
                <li className="field__hint">{t.items.tagsField.nothingToInherit}</li>
              )}
              {inherited.map(({ tag, from }) => (
                <li key={tag.id} className="chip chip--inherited">
                  <span
                    className="chip__dot"
                    aria-hidden="true"
                    style={{ background: tag.color }}
                  />
                  {t.items.tagChip.inherited
                    .replace('{tag}', tag.name)
                    .replace('{item}', from.title)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
