import { useState, type ChangeEvent } from 'react';
import {
  backupFileName,
  exportBackup,
  importBackup,
  isPristine,
  parseBackup,
  serializeBackup,
  type BackupFile,
  type ImportIssue,
  type ImportMode,
  type ImportSummary,
} from '../storage';
import {
  downloadText,
  formatIssue,
  MAX_ISSUES_SHOWN,
  readFileText,
  totalSummary,
} from './backupValues';
import { useData } from './data/useData';
import { formatCount, formatDate } from './format';
import { useI18n } from './i18n/useI18n';

type Stage =
  | { kind: 'idle' }
  | { kind: 'issues'; fileName: string; issues: ImportIssue[] }
  | { kind: 'ready'; fileName: string; backup: BackupFile; pristine: boolean }
  | { kind: 'done'; summary: ImportSummary };

type Notice =
  | { kind: 'exported'; name: string }
  | { kind: 'error'; key: 'exportFailed' | 'readFailed' | 'importFailed' };

/** Saves everything to a file and brings it back, merging or replacing. */
export function BackupSection() {
  const { t, locale } = useI18n();
  const { db, notify } = useData();
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const [notice, setNotice] = useState<Notice | null>(null);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setNotice(null);
    try {
      const backup = await exportBackup(db);
      const name = backupFileName(backup.exportedAt);
      downloadText(name, serializeBackup(backup));
      setNotice({ kind: 'exported', name });
    } catch {
      setNotice({ kind: 'error', key: 'exportFailed' });
    }
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // Clear the field so choosing the same file again still counts as a change
    input.value = '';
    if (!file) return;
    setNotice(null);
    setConfirming(false);

    let text: string;
    try {
      text = await readFileText(file);
    } catch {
      setStage({ kind: 'idle' });
      setNotice({ kind: 'error', key: 'readFailed' });
      return;
    }
    const parsed = parseBackup(text);
    if (!parsed.ok) {
      setStage({ kind: 'issues', fileName: file.name, issues: parsed.issues });
      return;
    }
    const pristine = await isPristine(db).catch(() => false);
    setMode(pristine ? 'replace' : 'merge');
    setStage({ kind: 'ready', fileName: file.name, backup: parsed.backup, pristine });
  }

  async function runImport(current: Extract<Stage, { kind: 'ready' }>) {
    setBusy(true);
    setNotice(null);
    try {
      const result = await importBackup(db, current.backup, mode);
      if (result.ok) {
        setStage({ kind: 'done', summary: result.summary });
        notify();
      } else {
        setStage({ kind: 'issues', fileName: current.fileName, issues: result.issues });
      }
      setConfirming(false);
    } catch {
      setNotice({ kind: 'error', key: 'importFailed' });
    }
    setBusy(false);
  }

  function handleImportClick(current: Extract<Stage, { kind: 'ready' }>) {
    if (mode === 'replace' && !current.pristine) setConfirming(true);
    else void runImport(current);
  }

  const noticeText =
    notice === null
      ? null
      : notice.kind === 'exported'
        ? t.backup.exported.replace('{name}', notice.name)
        : t.backup[notice.key];

  return (
    <div>
      <section className="panel" aria-labelledby="backup-export-title">
        <h3 id="backup-export-title" className="panel__title">
          {t.backup.exportTitle}
        </h3>
        <p className="panel__text">{t.backup.exportHint}</p>
        <div className="actions">
          <button type="button" className="button button--primary" onClick={handleExport}>
            {t.backup.exportAction}
          </button>
        </div>
      </section>

      <section className="panel" aria-labelledby="backup-import-title">
        <h3 id="backup-import-title" className="panel__title">
          {t.backup.importTitle}
        </h3>
        <p className="panel__text">{t.backup.importHint}</p>
        <div className="field">
          <label htmlFor="backup-file" className="field__label">
            {t.backup.fileLabel}
          </label>
          <input
            id="backup-file"
            className="field__input"
            type="file"
            accept=".json,application/json"
            onChange={handleFile}
          />
        </div>

        {stage.kind === 'issues' && (
          <div role="alert">
            <p className="field__error">
              {t.backup.problemsTitle.replace('{name}', stage.fileName)}
            </p>
            <ul className="issue-list">
              {stage.issues.slice(0, MAX_ISSUES_SHOWN).map((issue, index) => (
                <li key={`${issue.path}-${index}`}>{formatIssue(issue, t)}</li>
              ))}
            </ul>
            {stage.issues.length > MAX_ISSUES_SHOWN && (
              <p className="field__hint">
                {formatCount(locale, stage.issues.length - MAX_ISSUES_SHOWN, t.backup.moreProblems)}
              </p>
            )}
          </div>
        )}

        {stage.kind === 'ready' && (
          <ReadyPanel
            stage={stage}
            mode={mode}
            busy={busy}
            onMode={(next) => {
              setMode(next);
              setConfirming(false);
            }}
            onImport={() => handleImportClick(stage)}
          />
        )}

        {stage.kind === 'ready' && confirming && (
          <div
            role="alertdialog"
            aria-labelledby="backup-confirm-text"
            className="panel panel--danger"
          >
            <p id="backup-confirm-text" className="panel__text">
              {t.backup.confirmReplace}
            </p>
            <div className="actions">
              <button
                type="button"
                className="button button--danger"
                disabled={busy}
                onClick={() => void runImport(stage)}
              >
                {t.backup.confirmReplaceAction}
              </button>
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() => setConfirming(false)}
              >
                {t.backup.cancel}
              </button>
            </div>
          </div>
        )}

        {stage.kind === 'done' && <DonePanel summary={stage.summary} />}
      </section>

      {noticeText && (
        <p
          role={notice?.kind === 'error' ? 'alert' : 'status'}
          className={notice?.kind === 'error' ? 'field__error' : 'field__status'}
        >
          {noticeText}
        </p>
      )}
    </div>
  );
}

function ReadyPanel(props: {
  stage: Extract<Stage, { kind: 'ready' }>;
  mode: ImportMode;
  busy: boolean;
  onMode: (mode: ImportMode) => void;
  onImport: () => void;
}) {
  const { stage, mode, busy, onMode, onImport } = props;
  const { t, locale } = useI18n();
  const { backup } = stage;
  const agendas = backup.data.agendas.filter((agenda) => agenda.deletedAt === null).length;
  const items = backup.data.items.filter((item) => item.deletedAt === null).length;
  const summary = t.backup.fileSummary
    .replace('{date}', formatDate(locale, backup.exportedAt.slice(0, 10)))
    .replace('{agendas}', formatCount(locale, agendas, t.counts.agendas))
    .replace('{items}', formatCount(locale, items, t.counts.items));

  return (
    <div>
      <p className="panel__text">{summary}</p>
      <fieldset className="field field--group">
        <legend className="field__label">{t.backup.modeLegend}</legend>
        <div className="choices">
          {(['merge', 'replace'] as const).map((option) => (
            <label key={option} className="choice">
              <input
                type="radio"
                name="import-mode"
                checked={mode === option}
                onChange={() => onMode(option)}
              />
              {t.backup.modes[option]}
            </label>
          ))}
        </div>
        <p className="field__hint">{t.backup.modeHints[mode]}</p>
        {stage.pristine && <p className="field__hint">{t.backup.emptySuggestion}</p>}
      </fieldset>
      <div className="actions">
        <button type="button" className="button button--primary" disabled={busy} onClick={onImport}>
          {t.backup.importAction}
        </button>
      </div>
    </div>
  );
}

function DonePanel({ summary }: { summary: ImportSummary }) {
  const { t, locale } = useI18n();
  const total = totalSummary(summary);
  const format = (n: number) => n.toLocaleString(locale);
  return (
    <div role="status">
      <p className="field__status">
        {t.backup.done
          .replace('{added}', format(total.added))
          .replace('{updated}', format(total.updated))
          .replace('{skipped}', format(total.skipped))}
      </p>
      {summary.settingsApplied && <p className="field__status">{t.backup.settingsApplied}</p>}
    </div>
  );
}
