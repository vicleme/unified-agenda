import { useCallback, useState } from 'react';
import { applyThemeMode, readStoredThemeMode, storeThemeMode, type ThemeMode } from './theme';

export function useThemeMode() {
  const [mode, setModeState] = useState<ThemeMode>(readStoredThemeMode);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    applyThemeMode(next);
    storeThemeMode(next);
  }, []);

  return { mode, setMode };
}
