export const THEME_MODES = ['auto', 'light', 'dark'] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

export const THEME_STORAGE_KEY = 'unified-agenda:theme';

export const DEFAULT_THEME_MODE: ThemeMode = 'auto';

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && (THEME_MODES as readonly string[]).includes(value);
}

export function parseThemeMode(value: unknown): ThemeMode {
  return isThemeMode(value) ? value : DEFAULT_THEME_MODE;
}

// Auto follows the device. Light and dark are explicit choices that win over the device.
export function applyThemeMode(mode: ThemeMode, root: HTMLElement = document.documentElement) {
  if (mode === 'auto') {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = mode;
  }
}

export function readStoredThemeMode(): ThemeMode {
  try {
    return parseThemeMode(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME_MODE;
  }
}

export function storeThemeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Storage can be blocked. The choice then lasts only for this visit.
  }
}
