import { act, render, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import type { AgendaDatabase } from '../src/storage';
import { DataProvider } from '../src/ui/data/DataProvider';
import { mountedDbs } from './mounted';
import { I18nProvider } from '../src/ui/i18n/I18nProvider';

export function renderWithI18n(ui: ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

/** Renders with the language and data providers, over the given (test) database. */
export function renderApp(ui: ReactElement, db: AgendaDatabase) {
  mountedDbs.add(db);
  return render(
    <I18nProvider>
      <DataProvider db={db}>{ui}</DataProvider>
    </I18nProvider>,
  );
}

/**
 * Waits for the data provider to finish its first-open setup (the starting status groups), so a
 * test that ends right after rendering does not leave the provider updating after the test.
 * A database that never gets status groups (a test that empties them on purpose) just times out
 * quickly, and the remaining updates are still flushed.
 */
export async function settleApp(db: AgendaDatabase) {
  try {
    await waitFor(async () => expect(await db.statusGroups.count()).toBeGreaterThan(0), {
      timeout: 500,
    });
  } catch {
    // Nothing to wait for
  }
  // Lets the screens' own reads finish too, which land a little after the provider's setup
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}
