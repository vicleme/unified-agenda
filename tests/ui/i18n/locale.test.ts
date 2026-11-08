import {
  LOCALE_STORAGE_KEY,
  parseLocaleMode,
  readStoredLocaleMode,
  resolveLocale,
  storeLocaleMode,
} from '../../../src/ui/i18n/locale';

describe('resolveLocale', () => {
  it('uses an explicit choice over the browser', () => {
    expect(resolveLocale('en', ['pt-BR'])).toBe('en');
    expect(resolveLocale('pt-BR', ['en-US'])).toBe('pt-BR');
  });

  it('maps any Portuguese variant to pt-BR in auto mode', () => {
    expect(resolveLocale('auto', ['pt'])).toBe('pt-BR');
    expect(resolveLocale('auto', ['pt-PT'])).toBe('pt-BR');
  });

  it('follows the order of the browser preferences', () => {
    expect(resolveLocale('auto', ['fr-FR', 'pt-BR', 'en'])).toBe('pt-BR');
    expect(resolveLocale('auto', ['en-GB', 'pt-BR'])).toBe('en');
  });

  it('falls back to English when no preference is supported', () => {
    expect(resolveLocale('auto', ['fr-FR', 'ja'])).toBe('en');
    expect(resolveLocale('auto', [])).toBe('en');
  });
});

describe('stored locale mode', () => {
  it('round-trips and rejects garbage', () => {
    storeLocaleMode('pt-BR');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('pt-BR');
    expect(readStoredLocaleMode()).toBe('pt-BR');
    expect(parseLocaleMode('klingon')).toBe('auto');
  });
});
