import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createDatabase } from './storage';
import { AppShell } from './ui/AppShell';
import { DataProvider } from './ui/data/DataProvider';
import { I18nProvider } from './ui/i18n/I18nProvider';
import './ui/tokens.css';
import './ui/app.css';

const db = createDatabase();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <DataProvider db={db}>
        <AppShell />
      </DataProvider>
    </I18nProvider>
  </StrictMode>,
);
