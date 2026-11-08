import { totalSummary, formatIssue } from '../../src/ui/backupValues';
import { MESSAGES } from '../../src/ui/i18n/locale';
import type { ImportSummary } from '../../src/storage';

const en = MESSAGES.en;
const pt = MESSAGES['pt-BR'];

describe('formatIssue', () => {
  it('says where the problem is and what it is, in the active language', () => {
    const issue = { path: 'data.items[3].title', code: 'invalidField' } as const;
    expect(formatIssue(issue, en)).toBe('data.items[3].title: This value is missing or not valid.');
    expect(formatIssue(issue, pt)).toBe(
      'data.items[3].title: Este valor está faltando ou não é válido.',
    );
  });

  it('leaves out the place when the problem is the whole file', () => {
    expect(formatIssue({ path: '', code: 'notJson' }, en)).toBe('This is not a JSON file.');
  });

  it('adds the reasons of an invalid item with the texts of the item form', () => {
    const text = formatIssue(
      { path: 'data.items[0].item', code: 'invalidItem', detail: 'titleRequired,fromNeedsDue' },
      en,
    );
    expect(text).toBe(
      'data.items[0].item: This item is not valid. Enter a title. Add a due date to use a start day.',
    );
  });

  it('keeps an unknown reason as it came', () => {
    const text = formatIssue({ path: 'x', code: 'invalidItem', detail: 'somethingNew' }, en);
    expect(text).toBe('x: This item is not valid. somethingNew');
  });

  it('has a text for every import problem in both languages', () => {
    for (const code of [
      'notJson',
      'notBackup',
      'unsupportedVersion',
      'invalidField',
      'invalidItem',
      'duplicateId',
      'danglingReference',
    ] as const) {
      expect(formatIssue({ path: '', code }, en)).not.toBe('');
      expect(formatIssue({ path: '', code }, pt)).not.toBe('');
    }
  });
});

describe('totalSummary', () => {
  it('adds up every kind of record', () => {
    const kind = (added: number, updated: number, skipped: number) => ({ added, updated, skipped });
    const summary: ImportSummary = {
      agendas: kind(1, 0, 2),
      agendaGroups: kind(0, 0, 0),
      items: kind(5, 3, 1),
      tags: kind(0, 1, 0),
      statusGroups: kind(3, 0, 0),
      statuses: kind(7, 0, 0),
      savedViews: kind(0, 0, 0),
      settingsApplied: true,
    };
    expect(totalSummary(summary)).toEqual({ added: 16, updated: 4, skipped: 3 });
  });
});
