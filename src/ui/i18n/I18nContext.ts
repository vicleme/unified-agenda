import { createContext } from 'react';
import type { Locale, LocaleMode } from './locale';
import type { Messages } from './messages/en';

export type I18nValue = {
  t: Messages;
  locale: Locale;
  mode: LocaleMode;
  setMode: (mode: LocaleMode) => void;
};

export const I18nContext = createContext<I18nValue | null>(null);
