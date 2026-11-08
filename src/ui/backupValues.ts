import type { ImportIssue, ImportSummary } from '../storage';
import type { Messages } from './i18n/messages/en';

/** How many problems the screen lists before saying "and N more". */
export const MAX_ISSUES_SHOWN = 20;

/**
 * One import problem as a sentence: where it is (for example `data.items[3].title`) and what is
 * wrong, in the active language. For an invalid item the reasons come from the same texts the
 * item form uses.
 */
export function formatIssue(issue: ImportIssue, t: Messages): string {
  const where = issue.path === '' ? '' : `${issue.path}: `;
  if (issue.code === 'invalidItem') {
    const reasons = (issue.detail ?? '')
      .split(',')
      .filter((code) => code !== '')
      .map((code) => (t.items.issues as Record<string, string>)[code] ?? code);
    return `${where}${[t.backup.issues.invalidItem, ...reasons].join(' ')}`;
  }
  return `${where}${t.backup.issues[issue.code]}`;
}

/** The totals of an import over every kind of record. */
export function totalSummary(summary: ImportSummary): {
  added: number;
  updated: number;
  skipped: number;
} {
  const total = { added: 0, updated: 0, skipped: 0 };
  for (const value of Object.values(summary)) {
    if (typeof value === 'boolean') continue;
    total.added += value.added;
    total.updated += value.updated;
    total.skipped += value.skipped;
  }
  return total;
}

/** Reads a file chosen by the person as text. */
export function readFileText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'));
    reader.readAsText(file);
  });
}

/** Starts a download of some text, through a temporary `<a download>` link. */
export function downloadText(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
