import { LOCALES, MESSAGES } from '../../../src/ui/i18n/locale';

function collect(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) =>
      collect(child, path ? `${path}.${key}` : key),
    );
  }
  return [];
}

const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

describe('interface messages', () => {
  it.each(LOCALES)('%s has no em dash or en dash', (locale) => {
    const offenders = collect(MESSAGES[locale]).filter(([, text]) => DASHES.test(text));
    expect(offenders).toEqual([]);
  });

  it.each(LOCALES)('%s has the same keys as English and no empty text', (locale) => {
    const reference = collect(MESSAGES.en).map(([key]) => key);
    const entries = collect(MESSAGES[locale]);
    expect(entries.map(([key]) => key)).toEqual(reference);
    expect(entries.filter(([, text]) => text.trim() === '')).toEqual([]);
  });
});
