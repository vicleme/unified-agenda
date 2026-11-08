import { createContext } from 'react';
import type { AgendaDatabase, Repositories } from '../../storage';

export interface DataContextValue {
  db: AgendaDatabase;
  repos: Repositories;
  /** Goes up after every write, so lists know when to read again. */
  revision: number;
  /** False until the first-open setup (starting Kanban groups) has finished. */
  ready: boolean;
  /** Call after any write to the database. */
  notify: () => void;
}

export const DataContext = createContext<DataContextValue | null>(null);
