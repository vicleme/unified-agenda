import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { I18nContext } from './I18nContext';
import {
  MESSAGES,
  readStoredLocaleMode,
  resolveLocale,
  storeLocaleMode,
  type LocaleMode,
} from './locale';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<LocaleMode>(readStoredLocaleMode);
  const locale = resolveLocale(mode);

  // Keep the page language in sync, for screen readers and browser translation
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setMode = useCallback((next: LocaleMode) => {
    setModeState(next);
    storeLocaleMode(next);
  }, []);

  const value = useMemo(
    () => ({ t: MESSAGES[locale], locale, mode, setMode }),
    [locale, mode, setMode],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
