import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createRepositories, ensureDefaultStatuses, type AgendaDatabase } from '../../storage';
import { useI18n } from '../i18n/useI18n';
import { DataContext } from './DataContext';

/**
 * Gives the screens the database and tells them when to read again. On the first open it creates
 * the starting Kanban groups, named in the active language, and asks the browser not to erase the
 * data when the device runs low on space.
 */
export function DataProvider({ db, children }: { db: AgendaDatabase; children: ReactNode }) {
  const { t } = useI18n();
  const [revision, setRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const repos = useMemo(() => createRepositories(db), [db]);
  const notify = useCallback(() => setRevision((current) => current + 1), []);

  useEffect(() => {
    let cancelled = false;
    ensureDefaultStatuses(db, (key) => t.defaults[key])
      .then((created) => {
        if (cancelled) return;
        if (created) notify();
        setReady(true);
      })
      .catch(() => {
        // The screens still open. Each one shows its own error if a read or write fails.
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [db, t.defaults, notify]);

  useEffect(() => {
    // Best effort: the browser may refuse, and that is fine
    navigator.storage?.persist?.().catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({ db, repos, revision, ready, notify }),
    [db, repos, revision, ready, notify],
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
