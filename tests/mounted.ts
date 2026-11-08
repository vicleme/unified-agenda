import type { AgendaDatabase } from '../src/storage';

/** Databases that a rendered data provider is using, so the test cleanup can let it settle first. */
export const mountedDbs = new WeakSet<AgendaDatabase>();
