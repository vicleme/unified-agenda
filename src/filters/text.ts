/** Lower case, without accents, with single spaces: "Ação  Rápida" and "acao rapida" are equal. */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** The words of a search text, normalized. An empty or blank text has no words. */
export function searchWords(text: string): string[] {
  const normalized = normalizeText(text);
  return normalized === '' ? [] : normalized.split(' ');
}

/** True when every word is somewhere in the haystack (already normalized by the caller or not). */
export function containsAllWords(haystack: string, words: readonly string[]): boolean {
  const target = normalizeText(haystack);
  return words.every((word) => target.includes(word));
}
