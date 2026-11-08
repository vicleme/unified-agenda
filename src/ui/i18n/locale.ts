import { en, type Messages } from './messages/en';
import { ptBR } from './messages/pt-BR';

export const LOCALES = ['pt-BR', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_MODES = ['auto', ...LOCALES] as const;
export type LocaleMode = (typeof LOCALE_MODES)[number];

export const LOCALE_STORAGE_KEY = 'unified-agenda:locale';
export const DEFAULT_LOCALE_MODE: LocaleMode = 'auto';
export const FALLBACK_LOCALE: Locale = 'en';

// Each language is written in its own name, so it is always recognizable
export const LOCALE_NAMES: Record<Locale, string> = {
  'pt-BR': 'Português',
  en: 'English',
};

export const MESSAGES: Record<Locale, Messages> = {
  'pt-BR': ptBR,
  en,
};

export function isLocaleMode(value: unknown): value is LocaleMode {
  return typeof value === 'string' && (LOCALE_MODES as readonly string[]).includes(value);
}

export function parseLocaleMode(value: unknown): LocaleMode {
  return isLocaleMode(value) ? value : DEFAULT_LOCALE_MODE;
}

// Any Portuguese variant (pt, pt-PT, pt-BR) maps to the pt-BR texts, the only Portuguese we have.
export function resolveLocale(
  mode: LocaleMode,
  preferred: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages,
): Locale {
  if (mode !== 'auto') return mode;
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0];
    if (base === 'pt') return 'pt-BR';
    if (base === 'en') return 'en';
  }
  return FALLBACK_LOCALE;
}

export function readStoredLocaleMode(): LocaleMode {
  try {
    return parseLocaleMode(localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return DEFAULT_LOCALE_MODE;
  }
}

export function storeLocaleMode(mode: LocaleMode) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, mode);
  } catch {
    // Storage can be blocked. The choice then lasts only for this visit.
  }
}
