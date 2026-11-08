import { useEffect, useState } from 'react';
import type { SyncFields } from '../../core';
import type { Repositories, Repository } from '../../storage';
import { useData } from './useData';

type ListOf<K extends keyof Repositories> =
  Repositories[K] extends Repository<infer T> ? T[] : never;

export interface EntityList<K extends keyof Repositories> {
  /** The active (not deleted) entities, in no particular order. */
  data: ListOf<K>;
  /** True until the first read finishes. */
  loading: boolean;
  /** True if the last read failed. */
  failed: boolean;
}

/** Reads all active entities of one kind and reads again after every write (`notify`). */
export function useEntityList<K extends keyof Repositories>(kind: K): EntityList<K> {
  const { repos, revision } = useData();
  const [state, setState] = useState<EntityList<K>>({
    data: [] as unknown as ListOf<K>,
    loading: true,
    failed: false,
  });

  useEffect(() => {
    let cancelled = false;
    (repos[kind] as Repository<SyncFields>)
      .list()
      .then((data) => {
        if (!cancelled)
          setState({ data: data as unknown as ListOf<K>, loading: false, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState((current) => ({ ...current, loading: false, failed: true }));
      });
    return () => {
      cancelled = true;
    };
  }, [repos, kind, revision]);

  return state;
}

export const useAgendas = () => useEntityList('agendas');
export const useAgendaGroups = () => useEntityList('agendaGroups');
export const useItems = () => useEntityList('items');
export const useTags = () => useEntityList('tags');
export const useSavedViews = () => useEntityList('savedViews');
export const useStatuses = () => useEntityList('statuses');
export const useStatusGroups = () => useEntityList('statusGroups');
