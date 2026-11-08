import type { CSSProperties } from 'react';
import type { Id, Item, Progress, Tag } from '../core';
import { formatDate, formatDue, formatPercent, formatSchedule } from './format';
import { useI18n } from './i18n/useI18n';

/** What every row of the tree needs. Built once by the section and shared down the tree. */
export interface ItemTreeShared {
  /** The active children of an item, already in order. */
  childrenOf: (id: Id) => Item[];
  progress: ReadonlyMap<Id, Progress>;
  statusNames: ReadonlyMap<Id, string>;
  /** The tags of an item: its own and the inherited ones, each with the item it comes from. */
  tagsOf: (item: Item) => { own: Tag[]; inherited: { tag: Tag; from: Item }[] };
  /** The items whose children are showing. Everything starts folded. */
  expanded: ReadonlySet<Id>;
  zone: string;
  onToggle: (item: Item) => void;
  onEdit: (item: Item) => void;
  onAddTask: (parent: Item) => void;
  onAddBlock: (parent: Item) => void;
  onMove: (item: Item) => void;
  onDelete: (item: Item) => void;
}

interface ItemTreeProps {
  items: Item[];
  depth?: number;
  shared: ItemTreeShared;
}

/**
 * One level of the tree and, below each open item, the next level. A folded item draws none of
 * its children, so a big tree stays cheap to show. The depth only moves the row to the right.
 */
export function ItemTree({ items, depth = 0, shared }: ItemTreeProps) {
  const { t, locale } = useI18n();

  function meta(item: Item): string {
    const parts: string[] = [t.items.kind[item.kind]];

    if (item.kind === 'task') {
      parts.push(
        item.statusId !== null
          ? (shared.statusNames.get(item.statusId) ?? t.items.noStatus)
          : t.items.noStatus,
      );
      if (item.from !== null) {
        parts.push(t.items.from.replace('{date}', formatDate(locale, item.from)));
      }
      parts.push(
        item.due
          ? t.items.due.replace('{when}', formatDue(locale, item.due, shared.zone))
          : t.items.noDue,
      );
    } else {
      parts.push(
        item.schedule
          ? `${formatSchedule(locale, item.schedule, shared.zone, t.items.range)}${
              item.schedule.allDay ? ` (${t.items.allDay})` : ''
            }`
          : t.items.noSchedule,
      );
    }
    if (item.location !== '') parts.push(item.location);
    return parts.join(' · ');
  }

  return (
    <ul className={depth === 0 ? 'list' : 'list list--nested'}>
      {items.map((item) => {
        const kids = shared.childrenOf(item.id);
        const open = shared.expanded.has(item.id);
        // Only an item with a counted child shows progress. A task with just work blocks below it
        // is still a leaf for the count, and a bare leaf has nothing worth a bar.
        const hasCounted = kids.some((kid) => shared.progress.has(kid.id));
        const progress = hasCounted ? shared.progress.get(item.id) : undefined;
        const name = item.title;

        return (
          <li key={item.id}>
            <div className="list__row tree-row" style={{ '--depth': depth } as CSSProperties}>
              {kids.length > 0 ? (
                <button
                  type="button"
                  className="button tree-row__toggle"
                  aria-expanded={open}
                  aria-label={(open ? t.items.hideInside : t.items.showInside).replace(
                    '{name}',
                    name,
                  )}
                  onClick={() => shared.onToggle(item)}
                >
                  <span aria-hidden="true">{open ? '▾' : '▸'}</span>
                </button>
              ) : (
                <span className="tree-row__spacer" aria-hidden="true" />
              )}

              <span className="list__main">
                <span className="list__name">{name}</span>
                <span className="list__meta">{meta(item)}</span>
                <ItemTags item={item} shared={shared} />
                {progress && (
                  <span className="list__meta tree-row__progress">
                    <progress value={progress.completed} max={progress.total} aria-hidden="true" />
                    {t.items.progress
                      .replace('{completed}', String(progress.completed))
                      .replace('{total}', String(progress.total))
                      .replace('{percent}', formatPercent(locale, progress.ratio))}
                  </span>
                )}
              </span>

              <span className="actions tree-row__actions">
                <button
                  type="button"
                  className="button"
                  aria-label={t.items.edit.replace('{name}', name)}
                  onClick={() => shared.onEdit(item)}
                >
                  {t.items.short.edit}
                </button>
                <button
                  type="button"
                  className="button"
                  aria-label={t.items.addSubtask.replace('{name}', name)}
                  onClick={() => shared.onAddTask(item)}
                >
                  {t.items.short.addSubtask}
                </button>
                {item.kind === 'task' && (
                  <button
                    type="button"
                    className="button"
                    aria-label={t.items.addBlock.replace('{name}', name)}
                    onClick={() => shared.onAddBlock(item)}
                  >
                    {t.items.short.addBlock}
                  </button>
                )}
                <button
                  type="button"
                  className="button"
                  aria-label={t.items.move.replace('{name}', name)}
                  onClick={() => shared.onMove(item)}
                >
                  {t.items.short.move}
                </button>
                <button
                  type="button"
                  className="button"
                  aria-label={t.items.remove.replace('{name}', name)}
                  onClick={() => shared.onDelete(item)}
                >
                  {t.items.short.remove}
                </button>
              </span>
            </div>

            {open && kids.length > 0 && <ItemTree items={kids} depth={depth + 1} shared={shared} />}
          </li>
        );
      })}
    </ul>
  );
}

/** The tags of a row: own ones in full color, inherited ones dimmed and saying where from. */
function ItemTags({ item, shared }: { item: Item; shared: ItemTreeShared }) {
  const { t } = useI18n();
  const { own, inherited } = shared.tagsOf(item);
  if (own.length === 0 && inherited.length === 0) return null;
  return (
    <ul className="chips" aria-label={t.items.tagsField.legend}>
      {own.map((tag) => (
        <li key={tag.id} className="chip">
          <span className="chip__dot" aria-hidden="true" style={{ background: tag.color }} />
          {tag.name}
        </li>
      ))}
      {inherited.map(({ tag, from }) => (
        <li key={`inherited-${tag.id}`} className="chip chip--inherited">
          <span className="chip__dot" aria-hidden="true" style={{ background: tag.color }} />
          {t.items.tagChip.inherited.replace('{tag}', tag.name).replace('{item}', from.title)}
        </li>
      ))}
    </ul>
  );
}
