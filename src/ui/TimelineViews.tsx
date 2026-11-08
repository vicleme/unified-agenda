import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { createSavedView, moveStep, type Agenda, type Id, type SavedView } from '../core';
import {
  VIEW_NAME_MAX,
  isViewCurrent,
  nextViewOrder,
  snapshotControls,
  sortSavedViews,
  viewNameProblem,
  type TimelineControls,
} from '../filters';
import { useData } from './data/useData';
import { useI18n } from './i18n/useI18n';

type Mode =
  { kind: 'idle' } | { kind: 'create' } | { kind: 'rename' } | { kind: 'delete'; failed: boolean };

type Failure = 'update' | 'order' | null;

interface TimelineViewsProps {
  views: readonly SavedView[];
  /** The view the controls came from, or null. */
  activeId: Id | null;
  /** What is on screen now, to save or to compare with the active view. */
  controls: TimelineControls;
  agendas: readonly Agenda[];
  /** Sets the controls to the view and makes it the active one. */
  onApply: (view: SavedView) => void;
  /** Changes only which view counts as active (a new view, or none), leaving the controls. */
  onActiveChange: (id: Id | null) => void;
}

/**
 * Saved views, inside the filter panel. Analogy: presets on a radio. Pick one and the controls
 * jump to it. The buttons act on the view that is picked: update it with what is on screen,
 * restore it, rename, delete or move it in the list. "Save as view" takes a photo of the controls
 * under a new name. The saving itself is here, and the screen above only learns which view is
 * active.
 */
export function TimelineViews({
  views,
  activeId,
  controls,
  agendas,
  onApply,
  onActiveChange,
}: TimelineViewsProps) {
  const { t, locale } = useI18n();
  const text = t.timeline.filters.views;
  const { repos, notify } = useData();
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [failure, setFailure] = useState<Failure>(null);
  const [busy, setBusy] = useState(false);

  const sorted = sortSavedViews(views, locale);
  const active = sorted.find((view) => view.id === activeId) ?? null;
  const current = active === null || isViewCurrent(active, controls, agendas);
  const position = active ? sorted.findIndex((view) => view.id === active.id) : -1;

  function pick(id: string) {
    setMode({ kind: 'idle' });
    setFailure(null);
    const view = sorted.find((entry) => entry.id === id);
    if (view) onApply(view);
    else onActiveChange(null);
  }

  async function create(name: string) {
    const view = createSavedView({
      name,
      order: nextViewOrder(views),
      ...snapshotControls(controls),
    });
    await repos.savedViews.put(view);
    notify();
    onActiveChange(view.id);
    setMode({ kind: 'idle' });
  }

  async function rename(name: string) {
    if (!active) return;
    await repos.savedViews.update(active.id, { name });
    notify();
    setMode({ kind: 'idle' });
  }

  async function update() {
    if (!active) return;
    setFailure(null);
    setBusy(true);
    try {
      await repos.savedViews.update(active.id, snapshotControls(controls));
      notify();
    } catch {
      setFailure('update');
    } finally {
      setBusy(false);
    }
  }

  async function move(step: -1 | 1) {
    if (!active) return;
    setFailure(null);
    try {
      const changes = moveStep(sorted, active.id, step);
      await Promise.all(
        changes.map((change) => repos.savedViews.update(change.id, { order: change.order })),
      );
      notify();
    } catch {
      setFailure('order');
    }
  }

  async function confirmDelete() {
    if (!active) return;
    setBusy(true);
    try {
      await repos.savedViews.remove(active.id);
      notify();
      onActiveChange(null);
      setMode({ kind: 'idle' });
    } catch {
      setMode({ kind: 'delete', failed: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className="field field--group views">
      <legend className="field__label">{text.legend}</legend>
      <p className="field__hint">{sorted.length === 0 ? text.empty : text.hint}</p>

      {sorted.length > 0 && (
        <div className="field">
          <label className="field__label" htmlFor="timeline-view-select">
            {text.select}
          </label>
          <select
            id="timeline-view-select"
            className="field__input"
            value={active?.id ?? ''}
            onChange={(event) => pick(event.target.value)}
          >
            <option value="">{text.none}</option>
            {sorted.map((view) => (
              <option key={view.id} value={view.id}>
                {view.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {mode.kind === 'idle' && (
        <div className="actions">
          <button type="button" className="button" onClick={() => setMode({ kind: 'create' })}>
            {sorted.length === 0 ? text.saveFirst : text.saveNew}
          </button>
          {active && (
            <>
              <button
                type="button"
                className="button"
                disabled={current || busy}
                aria-label={text.updateNamed.replace('{name}', active.name)}
                onClick={() => void update()}
              >
                {text.update}
              </button>
              <button
                type="button"
                className="button"
                disabled={current}
                aria-label={text.restoreNamed.replace('{name}', active.name)}
                onClick={() => onApply(active)}
              >
                {text.restore}
              </button>
              <button
                type="button"
                className="button"
                aria-label={text.renameNamed.replace('{name}', active.name)}
                onClick={() => setMode({ kind: 'rename' })}
              >
                {text.rename}
              </button>
              <button
                type="button"
                className="button"
                disabled={position <= 0}
                aria-label={text.moveUp.replace('{name}', active.name)}
                onClick={() => void move(-1)}
              >
                {text.up}
              </button>
              <button
                type="button"
                className="button"
                disabled={position === sorted.length - 1}
                aria-label={text.moveDown.replace('{name}', active.name)}
                onClick={() => void move(1)}
              >
                {text.down}
              </button>
              <button
                type="button"
                className="button button--danger"
                aria-label={text.removeNamed.replace('{name}', active.name)}
                onClick={() => setMode({ kind: 'delete', failed: false })}
              >
                {text.remove}
              </button>
            </>
          )}
        </div>
      )}

      {failure === 'update' && (
        <p role="alert" className="field__error">
          {text.updateFailed}
        </p>
      )}
      {failure === 'order' && (
        <p role="alert" className="field__error">
          {text.orderFailed}
        </p>
      )}

      {mode.kind === 'create' && (
        <ViewNameForm
          title={text.form.createTitle}
          views={views}
          onSubmit={create}
          onCancel={() => setMode({ kind: 'idle' })}
        />
      )}
      {mode.kind === 'rename' && active && (
        <ViewNameForm
          key={active.id}
          title={text.form.renameTitle}
          initialName={active.name}
          ignoreId={active.id}
          views={views}
          onSubmit={rename}
          onCancel={() => setMode({ kind: 'idle' })}
        />
      )}

      {mode.kind === 'delete' && active && (
        <div role="alertdialog" aria-labelledby="view-delete-text" className="panel panel--danger">
          <p id="view-delete-text" className="panel__text">
            {text.confirm.replace('{name}', active.name)}
          </p>
          {mode.failed && (
            <p role="alert" className="field__error">
              {text.deleteFailed}
            </p>
          )}
          <div className="actions">
            <button
              type="button"
              className="button button--danger"
              disabled={busy}
              onClick={() => void confirmDelete()}
            >
              {text.confirmAction}
            </button>
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => setMode({ kind: 'idle' })}
            >
              {text.cancel}
            </button>
          </div>
        </div>
      )}
    </fieldset>
  );
}

interface ViewNameFormProps {
  title: string;
  initialName?: string;
  /** The view being renamed, so it does not clash with its own name. */
  ignoreId?: Id;
  views: readonly SavedView[];
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
}

/** The name field for a new or renamed view. Escape closes only this form, not the whole panel. */
function ViewNameForm({
  title,
  initialName = '',
  ignoreId,
  views,
  onSubmit,
  onCancel,
}: ViewNameFormProps) {
  const { t } = useI18n();
  const text = t.timeline.filters.views.form;
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<'empty' | 'duplicate' | 'saveFailed' | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = viewNameProblem(name, views, ignoreId);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    try {
      await onSubmit(name.trim());
    } catch {
      setError('saveFailed');
      setSaving(false);
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    onCancel();
  }

  const nameError = error === 'empty' || error === 'duplicate';
  return (
    <form
      className="panel"
      onSubmit={(event) => void handleSubmit(event)}
      onKeyDown={onKeyDown}
      noValidate
      aria-label={title}
    >
      <h3 className="panel__title">{title}</h3>
      <div className="field">
        <label htmlFor="view-name" className="field__label">
          {text.name}
        </label>
        <input
          id="view-name"
          className="field__input"
          type="text"
          value={name}
          maxLength={VIEW_NAME_MAX}
          autoFocus
          aria-invalid={nameError}
          aria-describedby={nameError ? 'view-name-error' : undefined}
          onChange={(event) => {
            setName(event.target.value);
            if (nameError) setError(null);
          }}
        />
        {nameError && (
          <p id="view-name-error" role="alert" className="field__error">
            {error === 'empty' ? text.nameRequired : text.nameTaken}
          </p>
        )}
      </div>
      {error === 'saveFailed' && (
        <p role="alert" className="field__error">
          {text.saveFailed}
        </p>
      )}
      <div className="actions">
        <button type="submit" className="button button--primary" disabled={saving}>
          {text.save}
        </button>
        <button type="button" className="button" onClick={onCancel} disabled={saving}>
          {text.cancel}
        </button>
      </div>
    </form>
  );
}
