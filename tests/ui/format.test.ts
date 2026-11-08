import {
  formatCount,
  formatDate,
  formatDateTime,
  formatDayHeading,
  formatDue,
  formatPercent,
  formatSchedule,
  formatTime,
} from '../../src/ui/format';

const pt = { zero: 'Nenhum item', one: '{count} item', other: '{count} itens' };
const en = { zero: 'No items', one: '{count} item', other: '{count} items' };

describe('formatCount', () => {
  it('uses the text for zero even where the language treats 0 as singular', () => {
    expect(formatCount('pt-BR', 0, pt)).toBe('Nenhum item');
    expect(formatCount('en', 0, en)).toBe('No items');
  });

  it('picks singular and plural', () => {
    expect(formatCount('pt-BR', 1, pt)).toBe('1 item');
    expect(formatCount('pt-BR', 2, pt)).toBe('2 itens');
    expect(formatCount('en', 1, en)).toBe('1 item');
    expect(formatCount('en', 5, en)).toBe('5 items');
  });

  it('formats big numbers for the language', () => {
    expect(formatCount('en', 1200, en)).toBe('1,200 items');
  });
});

describe('dates and times', () => {
  it('shows a plain date on the same day in any time zone', () => {
    expect(formatDate('en', '2026-11-07')).toContain('7');
    expect(formatDate('en', '2026-11-07')).toContain('2026');
    expect(formatDate('pt-BR', '2026-01-01')).toContain('1');
  });

  it('shows an instant in the chosen time zone', () => {
    expect(formatTime('pt-BR', '2026-11-10T17:00:00.000Z', 'America/Sao_Paulo')).toBe('14:00');
    expect(formatTime('pt-BR', '2026-11-10T17:00:00.000Z', 'UTC')).toBe('17:00');
    expect(formatDateTime('pt-BR', '2026-11-10T17:00:00.000Z', 'America/Sao_Paulo')).toContain(
      '14:00',
    );
  });

  it('follows the device when the zone is auto', () => {
    expect(formatTime('en', '2026-11-10T17:00:00.000Z', 'auto')).toMatch(/\d/);
  });
});

describe('formatSchedule', () => {
  const range = '{start} to {end}';

  it('shows a single whole day, and a range of days with the template', () => {
    expect(formatSchedule('en', { allDay: true, start: '2026-11-12' }, 'UTC', range)).toBe(
      formatDate('en', '2026-11-12'),
    );
    expect(
      formatSchedule('en', { allDay: true, start: '2026-11-12', end: '2026-11-14' }, 'UTC', range),
    ).toBe(`${formatDate('en', '2026-11-12')} to ${formatDate('en', '2026-11-14')}`);
  });

  it('shows only the hour for an end on the same day, in the display zone', () => {
    const text = formatSchedule(
      'pt-BR',
      { allDay: false, start: '2026-11-10T17:00:00.000Z', end: '2026-11-10T19:30:00.000Z' },
      'America/Sao_Paulo',
      '{start} até {end}',
    );
    expect(text).toContain('14:00');
    expect(text).toContain(' até 16:30');
  });

  it('shows the full date for an end on another day', () => {
    const text = formatSchedule(
      'en',
      { allDay: false, start: '2026-11-10T22:00:00.000Z', end: '2026-11-12T02:00:00.000Z' },
      'UTC',
      range,
    );
    expect(text).toContain('Nov 10');
    expect(text).toContain('Nov 12');
  });

  it('keeps the same calendar day when the display zone moves the end to another day', () => {
    const text = formatSchedule(
      'en',
      { allDay: false, start: '2026-11-10T22:00:00.000Z', end: '2026-11-11T02:00:00.000Z' },
      'America/Sao_Paulo',
      range,
    );
    // 19:00 to 23:00 on the 10th in São Paulo, so the end shows only the hour
    expect(text).toContain('Nov 10');
    expect(text).not.toContain('Nov 11');
  });
});

describe('formatDue and formatPercent', () => {
  it('shows a whole-day delivery as a date, in any zone', () => {
    expect(formatDue('en', { allDay: true, date: '2026-11-24' }, 'Asia/Tokyo')).toBe(
      'Nov 24, 2026',
    );
  });

  it('shows a timed delivery in the display zone', () => {
    const text = formatDue(
      'en',
      { allDay: false, at: '2026-11-25T02:59:00.000Z' },
      'America/Sao_Paulo',
    );
    expect(text).toContain('Nov 24, 2026');
    expect(text).toContain('11:59');
  });

  it('writes a ratio as a percentage for the language', () => {
    expect(formatPercent('en', 0.6)).toBe('60%');
    expect(formatPercent('en', 1)).toBe('100%');
    expect(formatPercent('pt-BR', 0.5)).toBe('50%');
  });
});

describe('formatDayHeading', () => {
  it('writes the weekday, day and month in the language, without shifting the day', () => {
    expect(formatDayHeading('en', '2026-11-07')).toBe('Saturday, November 7');
    expect(formatDayHeading('pt-BR', '2026-11-07')).toBe('sábado, 7 de novembro');
    expect(formatDayHeading('en', '2026-03-01')).toBe('Sunday, March 1');
  });
});
