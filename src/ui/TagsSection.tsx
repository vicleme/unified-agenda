import { useMemo, useState } from 'react';
import {
  createTag,
  effectiveScope,
  indexById,
  normalizeTagScopes,
  shouldOfferGlobal,
  type Tag,
} from '../core';
import { countTagUsage, removeTagCascade, type TagUsage } from '../storage';
import { useData } from './data/useData';
import { useAgendas, useTags } from './data/useEntityList';
import { formatCount } from './format';
import { useI18n } from './i18n/useI18n';
import { TagForm, type TagFormValues } from './TagForm';
import { flattenTagTree } from './tagValues';

type Mode =
  | { kind: 'idle' }
  | { kind: 'create' }
  | { kind: 'edit'; tag: Tag }
  | { kind: 'delete'; tag: Tag; usage: TagUsage; failed: boolean };

/** The tag tree: create, edit, move, restrict to agendas and delete. */
export function TagsSection() {
  const { t, locale } = useI18n();
  const { db, repos, notify } = useData();
  const tags = useTags();
  const agendas = useAgendas();
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionFailed, setActionFailed] = useState(false);

  const sortedAgendas = useMemo(
    () =>
      [...agendas.data].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, locale)),
    [agendas.data, locale],
  );
  const rows = useMemo(() => flattenTagTree(tags.data, locale), [tags.data, locale]);
  const byId = useMemo(() => indexById(tags.data), [tags.data]);
  const agendaName = useMemo(
    () => new Map(agendas.data.map((agenda) => [agenda.id, agenda.name])),
    [agendas.data],
  );
  const allAgendaIds = agendas.data.map((agenda) => agenda.id);

  async function save(values: TagFormValues) {
    let savedId: string;
    if (mode.kind === 'edit') {
      await repos.tags.update(mode.tag.id, values);
      savedId = mode.tag.id;
    } else {
      const tag = createTag(values);
      await repos.tags.put(tag);
      savedId = tag.id;
    }

    // A child can never be wider than its parent, so fix whatever this save broke
    const { changed, changes } = normalizeTagScopes(await repos.tags.list());
    if (changed.length > 0) await repos.tags.putMany(changed);
    const names = changes.map((change) =>
      change.tagId === savedId ? values.name : (byId.get(change.tagId)?.name ?? ''),
    );
    setNotice(
      changes.length > 0
        ? t.tags.scopeAdjusted.replace('{names}', names.filter(Boolean).join(', '))
        : null,
    );
    notify();
    setMode({ kind: 'idle' });
  }

  async function makeGlobal(tag: Tag) {
    setActionFailed(false);
    try {
      await repos.tags.update(tag.id, { agendaIds: [] });
      setNotice(null);
      notify();
    } catch {
      setActionFailed(true);
    }
  }

  async function askToDelete(tag: Tag) {
    setNotice(null);
    try {
      setMode({ kind: 'delete', tag, usage: await countTagUsage(db, tag.id), failed: false });
    } catch {
      setMode({ kind: 'delete', tag, usage: { subTags: 0, items: 0 }, failed: true });
    }
  }

  async function confirmDelete(tag: Tag) {
    setDeleting(true);
    try {
      await removeTagCascade(db, tag.id);
      notify();
      setMode({ kind: 'idle' });
    } catch {
      setMode((current) => (current.kind === 'delete' ? { ...current, failed: true } : current));
    } finally {
      setDeleting(false);
    }
  }

  function scopeText(tag: Tag): string {
    const scope = effectiveScope(tag.id, byId);
    if (scope === null) return t.tags.scopeAll;
    const names = scope.map((id) => agendaName.get(id)).filter(Boolean);
    return t.tags.scopeSome.replace('{agendas}', names.join(', '));
  }

  const formProps = {
    tags: tags.data,
    agendas: sortedAgendas,
    onSubmit: save,
    onCancel: () => setMode({ kind: 'idle' }),
  };

  return (
    <div>
      {tags.failed && (
        <p role="alert" className="field__error">
          {t.tags.loadFailed}
        </p>
      )}
      {actionFailed && (
        <p role="alert" className="field__error">
          {t.tags.saveFailed}
        </p>
      )}

      {mode.kind === 'idle' && (
        <button
          type="button"
          className="button button--primary"
          onClick={() => {
            setNotice(null);
            setMode({ kind: 'create' });
          }}
        >
          {t.tags.add}
        </button>
      )}

      {mode.kind === 'create' && <TagForm editing={null} {...formProps} />}
      {mode.kind === 'edit' && <TagForm key={mode.tag.id} editing={mode.tag} {...formProps} />}

      {notice !== null && (
        <p role="status" className="manage__notice">
          {notice}
        </p>
      )}

      {mode.kind === 'delete' && (
        <div role="alertdialog" aria-labelledby="tag-delete-text" className="panel panel--danger">
          <p id="tag-delete-text" className="panel__text">
            {formatCount(locale, mode.usage.items, t.tags.confirm).replace('{name}', mode.tag.name)}
            {mode.usage.subTags > 0 &&
              ` ${formatCount(locale, mode.usage.subTags, t.tags.confirmChildren)}`}
          </p>
          {mode.failed && (
            <p role="alert" className="field__error">
              {t.tags.deleteFailed}
            </p>
          )}
          <div className="actions">
            <button
              type="button"
              className="button button--danger"
              disabled={deleting}
              onClick={() => confirmDelete(mode.tag)}
            >
              {t.tags.confirmAction}
            </button>
            <button
              type="button"
              className="button"
              disabled={deleting}
              onClick={() => setMode({ kind: 'idle' })}
            >
              {t.tags.form.cancel}
            </button>
          </div>
        </div>
      )}

      {!tags.loading && rows.length === 0 && mode.kind === 'idle' && (
        <p className="placeholder">{t.tags.empty}</p>
      )}

      {rows.length > 0 && (
        <ul className="list">
          {rows.map(({ tag, depth }) => (
            <li
              key={tag.id}
              className="list__row tree-row"
              style={{ '--depth': depth } as React.CSSProperties}
            >
              <span className="list__swatch" aria-hidden="true" style={{ background: tag.color }} />
              <span className="list__main">
                <span className="list__name">{tag.name}</span>
                <span className="list__meta">{scopeText(tag)}</span>
              </span>
              {shouldOfferGlobal(tag, tags.data, allAgendaIds) && (
                <button
                  type="button"
                  className="button"
                  aria-label={t.tags.makeGlobal.replace('{name}', tag.name)}
                  onClick={() => makeGlobal(tag)}
                >
                  {t.tags.short.makeGlobal}
                </button>
              )}
              <button
                type="button"
                className="button"
                aria-label={t.tags.edit.replace('{name}', tag.name)}
                onClick={() => {
                  setNotice(null);
                  setMode({ kind: 'edit', tag });
                }}
              >
                {t.tags.short.edit}
              </button>
              <button
                type="button"
                className="button"
                aria-label={t.tags.remove.replace('{name}', tag.name)}
                onClick={() => askToDelete(tag)}
              >
                {t.tags.short.remove}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
