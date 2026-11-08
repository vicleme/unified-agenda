import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_SETTINGS, createAgenda, createItem, type Agenda, type Item } from '../../src/core';
import { ensureDefaultStatuses, saveSettings } from '../../src/storage';
import { en } from '../../src/ui/i18n/messages/en';
import { LOCALE_STORAGE_KEY } from '../../src/ui/i18n/locale';
import { TimelineView } from '../../src/ui/TimelineView';
import { renderApp } from '../helpers';
import { openTestDb } from '../storage/helpers';

/** Saturday, November 7, 2026, 12:00 in São Paulo (UTC-3, no clock change in November). */
const NOW = Date.UTC(2026, 10, 7, 15, 0, 0);
const ZONE = 'America/Sao_Paulo';
const CREATED = '2026-11-07T12:00:00.000Z';

/** Intl puts a narrow no-break space before AM and PM in newer versions. Compare with plain ones. */
const plain = (text: string | null) => (text ?? '').replace(/\s/g, ' ');

async function setup(build: (agenda: Agenda, status: { planned: string; done: string }) => Item[]) {
  const db = openTestDb();
  const agenda = createAgenda({ name: 'College', color: '#3b5bdb' });
  await db.agendas.put(agenda);
  await saveSettings(db, { ...DEFAULT_SETTINGS, displayTimeZone: ZONE });
  await ensureDefaultStatuses(db, (key) => en.defaults[key]);
  const groups = await db.statusGroups.toArray();
  const statuses = await db.statuses.toArray();
  const firstOf = (role: string) => {
    const group = groups.find((candidate) => candidate.role === role)!;
    return statuses.find((status) => status.groupId === group.id)!.id;
  };
  // A task with no start day begins on the day it was created, so the creation day is fixed to the day
  // of NOW. Without it these tests only pass on the day they were written.
  const built = build(agenda, { planned: firstOf('planned'), done: firstOf('done') });
  await db.items.bulkPut(built.map((item) => ({ ...item, createdAt: CREATED })));
  return db;
}

const day = (name: RegExp) => screen.getByRole('region', { name });

describe('TimelineView', () => {
  it('opens a week before today to three weeks ahead, folding empty days in a row', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    renderApp(<TimelineView now={NOW} />, db);

    // Only today is a full block, even when it is empty
    expect(await screen.findAllByRole('region')).toHaveLength(1);
    expect(
      within(day(/Saturday, November 7/)).getByText('Nothing on this day.'),
    ).toBeInTheDocument();

    const before = screen.getByRole('button', { name: /7 empty days/ });
    const after = screen.getByRole('button', { name: /20 empty days/ });
    expect(plain(before.textContent)).toBe('Oct 31, 2026 to Nov 6, 2026 · 7 empty days');
    expect(plain(after.textContent)).toBe('Nov 8, 2026 to Nov 27, 2026 · 20 empty days');
    expect(before).toHaveAttribute('aria-expanded', 'false');

    await user.click(before);
    expect(screen.getAllByRole('region')).toHaveLength(8);
    expect(day(/Saturday, October 31/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hide empty days/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    await user.click(screen.getByRole('button', { name: /Hide empty days/ }));
    expect(screen.getAllByRole('region')).toHaveLength(1);
  });

  it('badges today and tomorrow', async () => {
    const db = await setup((agenda) => [
      createItem({
        kind: 'event',
        title: 'Class',
        agendaId: agenda.id,
        schedule: { allDay: true, start: '2026-11-08', end: '2026-11-09' },
      }),
    ]);
    renderApp(<TimelineView now={NOW} />, db);
    await screen.findAllByRole('region');

    expect(within(day(/November 7/)).getByText('Today')).toBeInTheDocument();
    expect(within(day(/November 8/)).getByText('Tomorrow')).toBeInTheDocument();
    expect(within(day(/November 9/)).queryByText(/Today|Tomorrow/)).not.toBeInTheDocument();
  });

  it('puts whole-day items first, then timed items in time order, with the agenda name', async () => {
    const db = await setup((agenda) => [
      createItem({
        kind: 'event',
        title: 'Late class',
        agendaId: agenda.id,
        location: 'Room 4',
        schedule: {
          allDay: false,
          start: '2026-11-07T21:00:00.000Z',
          end: '2026-11-07T22:30:00.000Z',
        },
      }),
      createItem({
        kind: 'event',
        title: 'Early class',
        agendaId: agenda.id,
        schedule: {
          allDay: false,
          start: '2026-11-07T11:00:00.000Z',
          end: '2026-11-07T12:00:00.000Z',
        },
      }),
      createItem({
        kind: 'event',
        title: 'Holiday',
        agendaId: agenda.id,
        schedule: { allDay: true, start: '2026-11-07' },
      }),
    ]);
    renderApp(<TimelineView now={NOW} />, db);

    const today = within(await screen.findByRole('region', { name: /November 7/ }));
    const rows = today.getAllByRole('listitem');
    expect(rows.map((row) => row.querySelector('.entry__title')?.textContent)).toEqual([
      'Holiday',
      'Early class',
      'Late class',
    ]);
    expect(
      rows.map((row) => plain(row.querySelector('.entry__time')?.textContent ?? null)),
    ).toEqual(['All day', '8:00 AM to 9:00 AM', '6:00 PM to 7:30 PM']);
    expect(within(rows[2]!).getByText('College')).toBeInTheDocument();
    expect(within(rows[2]!).getByText('Room 4')).toBeInTheDocument();
    expect(today.queryByText('Nothing on this day.')).not.toBeInTheDocument();
  });

  it('marks an item that crosses midnight on both days, with the hours inside each day', async () => {
    const db = await setup((agenda) => [
      createItem({
        kind: 'event',
        title: 'Night shift',
        agendaId: agenda.id,
        schedule: {
          allDay: false,
          start: '2026-11-08T01:00:00.000Z',
          end: '2026-11-08T05:00:00.000Z',
        },
      }),
    ]);
    renderApp(<TimelineView now={NOW} />, db);

    const first = within(await screen.findByRole('region', { name: /November 7/ }));
    expect(plain(first.getByText(/^From/).textContent)).toBe('From 10:00 PM');
    expect(first.getByText('Continues on the next day')).toBeInTheDocument();
    expect(first.queryByText('Continues from the day before')).not.toBeInTheDocument();

    const second = within(screen.getByRole('region', { name: /November 8/ }));
    expect(plain(second.getByText(/^Until/).textContent)).toBe('Until 2:00 AM');
    expect(second.getByText('Continues from the day before')).toBeInTheDocument();
  });

  it('shows a multi-day whole-day item on every day it touches', async () => {
    const db = await setup((agenda) => [
      createItem({
        kind: 'event',
        title: 'Trip',
        agendaId: agenda.id,
        schedule: { allDay: true, start: '2026-11-08', end: '2026-11-10' },
      }),
    ]);
    renderApp(<TimelineView now={NOW} />, db);
    await screen.findAllByRole('region');

    expect(within(day(/November 7/)).queryByText('Trip')).not.toBeInTheDocument();
    for (const name of [/November 8/, /November 9/, /November 10/]) {
      expect(within(day(name)).getByText('Trip')).toBeInTheDocument();
    }
    // The day after the trip is empty, so it is folded and has no block
    expect(screen.queryByRole('region', { name: /November 11/ })).not.toBeInTheDocument();
    expect(within(day(/November 9/)).getAllByText(/^Continues/)).toHaveLength(2);
  });

  it('shows open tasks on every day of the window, highlighting the delivery day', async () => {
    const db = await setup((agenda, status) => [
      createItem({
        kind: 'task',
        title: 'Paper',
        agendaId: agenda.id,
        statusId: status.planned,
        from: '2026-11-03',
        due: { allDay: false, at: '2026-11-10T01:59:00.000Z' },
      }),
      createItem({
        kind: 'task',
        title: 'Reading',
        agendaId: agenda.id,
        statusId: status.planned,
        due: { allDay: true, date: '2026-11-09' },
      }),
      createItem({
        kind: 'task',
        title: 'Aardvark',
        agendaId: agenda.id,
        statusId: status.planned,
        from: '2026-11-01',
        due: { allDay: true, date: '2026-11-12' },
      }),
    ]);
    renderApp(<TimelineView now={NOW} />, db);
    await screen.findAllByRole('region');

    const today = within(day(/November 7/));
    expect(today.getByRole('heading', { name: 'Open tasks' })).toBeInTheDocument();
    expect(today.getByText('Paper')).toBeInTheDocument();
    const paperRow = today.getByText('Paper').closest('li')!;
    expect(within(paperRow).getByText('Due Nov 9, 2026')).toBeInTheDocument();

    // The delivery day comes first and says so, in the display zone (10 Nov 01:59Z is 9 Nov 22:59)
    const delivery = within(day(/November 9/)).getAllByRole('listitem');
    expect(delivery.map((row) => row.querySelector('.entry__title')?.textContent)).toEqual([
      'Paper',
      'Reading',
      'Aardvark',
    ]);
    expect(plain(within(delivery[0]!).getByText(/^Due at/).textContent)).toBe('Due at 10:59 PM');
    expect(within(delivery[1]!).getByText('Due this day')).toBeInTheDocument();
    expect(within(delivery[2]!).getByText('Due Nov 12, 2026')).toBeInTheDocument();

    // After the delivery day the task leaves the strip
    expect(within(day(/November 10/)).queryByText('Paper')).not.toBeInTheDocument();
  });

  it('shows the overdue strip only at the top of today, and leaves done tasks out', async () => {
    const db = await setup((agenda, status) => [
      createItem({
        kind: 'task',
        title: 'Report',
        agendaId: agenda.id,
        statusId: status.planned,
        due: { allDay: true, date: '2026-11-04' },
      }),
      createItem({
        kind: 'task',
        title: 'Old homework',
        agendaId: agenda.id,
        statusId: status.done,
        due: { allDay: true, date: '2026-11-04' },
      }),
      createItem({
        kind: 'task',
        title: 'Yesterday',
        agendaId: agenda.id,
        statusId: status.planned,
        due: { allDay: true, date: '2026-11-06' },
      }),
    ]);
    renderApp(<TimelineView now={NOW} />, db);
    await screen.findAllByRole('region');

    const today = within(day(/November 7/));
    expect(today.getByRole('heading', { name: 'Overdue' })).toBeInTheDocument();
    expect(today.getByText('3 days late')).toBeInTheDocument();
    expect(today.getByText('1 day late')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Overdue' })).toHaveLength(1);
    expect(screen.queryByText('Old homework')).not.toBeInTheDocument();
    // An overdue task is not an empty day
    expect(today.queryByText('Nothing on this day.')).not.toBeInTheDocument();
  });

  it('lists a timed delivery that passed today only as overdue, saying it is late today', async () => {
    const db = await setup((agenda, status) => [
      // 10:00 in São Paulo, already passed at the fixed "now" of 12:00
      createItem({
        kind: 'task',
        title: 'Morning portal',
        agendaId: agenda.id,
        statusId: status.planned,
        from: '2026-11-06',
        due: { allDay: false, at: '2026-11-07T13:00:00.000Z' },
      }),
      // 18:00 in São Paulo, still ahead
      createItem({
        kind: 'task',
        title: 'Evening portal',
        agendaId: agenda.id,
        statusId: status.planned,
        from: '2026-11-06',
        due: { allDay: false, at: '2026-11-07T21:00:00.000Z' },
      }),
    ]);
    renderApp(<TimelineView now={NOW} />, db);
    await screen.findAllByRole('region');

    const today = within(day(/November 7/));
    // Exactly once for each task in today's block
    expect(today.getAllByText('Morning portal')).toHaveLength(1);
    expect(today.getAllByText('Evening portal')).toHaveLength(1);

    const lateRow = today.getByText('Morning portal').closest('li')!;
    expect(lateRow.closest('.strip')).toHaveClass('strip--overdue');
    expect(within(lateRow).getByText('Late today')).toBeInTheDocument();
    expect(plain(within(lateRow).getByText(/^Due at/).textContent)).toBe('Due at 10:00 AM');
    expect(within(lateRow).queryByText(/days? late/)).not.toBeInTheDocument();

    const openRow = today.getByText('Evening portal').closest('li')!;
    expect(openRow.closest('.strip')).not.toHaveClass('strip--overdue');
    expect(within(openRow).queryByText('Late today')).not.toBeInTheDocument();
  });

  it('drops the open strip of today when its only task is already overdue', async () => {
    const db = await setup((agenda, status) => [
      createItem({
        kind: 'task',
        title: 'Morning portal',
        agendaId: agenda.id,
        statusId: status.planned,
        from: '2026-11-06',
        due: { allDay: false, at: '2026-11-07T13:00:00.000Z' },
      }),
    ]);
    renderApp(<TimelineView now={NOW} />, db);
    await screen.findAllByRole('region');

    const today = within(day(/November 7/));
    expect(today.getByRole('heading', { name: 'Overdue' })).toBeInTheDocument();
    expect(today.queryByRole('heading', { name: 'Open tasks' })).not.toBeInTheDocument();
  });

  it('names the task that holds a work block', async () => {
    const task = createItem({
      kind: 'task',
      title: 'Paper',
      agendaId: 'placeholder',
      due: { allDay: true, date: '2026-11-12' },
    });
    const db = await setup((agenda, status) => {
      const parent = { ...task, agendaId: agenda.id, statusId: status.planned };
      return [
        parent,
        createItem({
          kind: 'event',
          title: 'Work on paper',
          agendaId: agenda.id,
          parentId: parent.id,
          schedule: {
            allDay: false,
            start: '2026-11-08T17:00:00.000Z',
            end: '2026-11-08T19:00:00.000Z',
          },
        }),
      ];
    });
    renderApp(<TimelineView now={NOW} />, db);

    const tomorrow = within(await screen.findByRole('region', { name: /November 8/ }));
    expect(tomorrow.getByText('Inside "Paper"')).toBeInTheDocument();
  });

  it('ignores deleted items and items with no date', async () => {
    const db = await setup((agenda) => [
      {
        ...createItem({
          kind: 'event',
          title: 'Cancelled',
          agendaId: agenda.id,
          schedule: { allDay: true, start: '2026-11-07' },
        }),
        deletedAt: '2026-11-06T10:00:00.000Z',
      },
      createItem({ kind: 'event', title: 'Someday', agendaId: agenda.id }),
    ]);
    renderApp(<TimelineView now={NOW} />, db);
    await screen.findAllByRole('region');

    expect(screen.queryByText('Cancelled')).not.toBeInTheDocument();
    expect(screen.queryByText('Someday')).not.toBeInTheDocument();
  });

  it('cuts the days in the display zone, not in UTC', async () => {
    // 01:00 UTC on the 8th is still the 7th at 22:00 in São Paulo
    const db = await setup((agenda) => [
      createItem({
        kind: 'event',
        title: 'Dinner',
        agendaId: agenda.id,
        schedule: { allDay: false, start: '2026-11-08T01:00:00.000Z' },
      }),
    ]);
    renderApp(<TimelineView now={NOW} />, db);
    await screen.findAllByRole('region');

    expect(within(day(/November 7/)).getByText('Dinner')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /November 8/ })).not.toBeInTheDocument();
  });

  it('speaks Portuguese, with day names and delivery texts in the language', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'pt-BR');
    const db = await setup((agenda, status) => [
      createItem({
        kind: 'task',
        title: 'Relatório',
        agendaId: agenda.id,
        statusId: status.planned,
        due: { allDay: true, date: '2026-11-04' },
      }),
      createItem({
        kind: 'event',
        title: 'Prova',
        agendaId: agenda.id,
        schedule: { allDay: true, start: '2026-11-08' },
      }),
    ]);
    renderApp(<TimelineView now={NOW} />, db);

    const today = within(await screen.findByRole('region', { name: /sábado, 7 de novembro/ }));
    expect(today.getByText('Hoje')).toBeInTheDocument();
    expect(today.getByRole('heading', { name: 'Atrasadas' })).toBeInTheDocument();
    expect(today.getByText('3 dias de atraso')).toBeInTheDocument();
    expect(within(day(/domingo, 8 de novembro/)).getByText('Amanhã')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /4 dias vazios/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ir para hoje' })).toBeInTheDocument();
  });
});

describe('TimelineView scrolling', () => {
  const scrollIntoView = vi.fn();
  const scrollTo = vi.fn();
  // jsdom's own scroll position and window height, put back after a test fakes them
  const originals = (['scrollY', 'innerHeight'] as const).map(
    (name) => [name, Object.getOwnPropertyDescriptor(window, name)!] as const,
  );

  beforeEach(() => {
    scrollIntoView.mockClear();
    scrollTo.mockClear();
    Element.prototype.scrollIntoView = scrollIntoView;
    vi.spyOn(window, 'scrollTo').mockImplementation(scrollTo);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const [name, descriptor] of originals) {
      Object.defineProperty(window, name, descriptor);
    }
  });

  /** Fakes the page size and scroll position, which jsdom does not compute. */
  function mockPage(scrollY: number, scrollHeight: () => number, innerHeight = 800) {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: scrollY });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: innerHeight });
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockImplementation(scrollHeight);
  }

  const allDayEvent = (agenda: Agenda, title: string, date: string) =>
    createItem({
      kind: 'event',
      title,
      agendaId: agenda.id,
      schedule: { allDay: true, start: date },
    });

  it('opens on today when it starts far down, and the button goes back to it', async () => {
    const user = userEvent.setup();
    // Days with content above today push it down the page
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top: 900 } as DOMRect);
    renderApp(<TimelineView now={NOW} />, openTestDb());
    await screen.findAllByRole('region');

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(day(/November 7/));

    scrollIntoView.mockClear();
    await user.click(screen.getByRole('button', { name: 'Go to today' }));
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    expect(scrollIntoView.mock.contexts[0]).toBe(day(/November 7/));
  });

  it('stays at the top of the page when today is already near it, and the button still goes to today', async () => {
    const user = userEvent.setup();
    // jsdom puts every block at 0, which is near the top
    renderApp(<TimelineView now={NOW} />, openTestDb());
    await screen.findAllByRole('region');
    expect(scrollIntoView).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Go to today' }));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('loads later days with the button at the end, and earlier days with the one at the top', async () => {
    const user = userEvent.setup();
    const db = await setup((agenda) => [
      allDayEvent(agenda, 'Far ahead', '2026-11-30'),
      allDayEvent(agenda, 'Long ago', '2026-10-25'),
    ]);
    renderApp(<TimelineView now={NOW} />, db);
    await screen.findAllByRole('region');
    expect(screen.queryByText('Far ahead')).not.toBeInTheDocument();
    expect(screen.queryByText('Long ago')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show later days' }));
    expect(day(/November 30/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show earlier days' }));
    expect(day(/October 25/)).toBeInTheDocument();
  });

  it('loads later days by itself when the scroll gets near the bottom', async () => {
    const db = await setup((agenda) => [allDayEvent(agenda, 'Far ahead', '2026-12-05')]);
    renderApp(<TimelineView now={NOW} />, db);
    await screen.findAllByRole('region');

    // 2000 high page, 800 shown, scrolled to 700: 500 pixels left, inside the 600 margin
    mockPage(700, () => 2000);
    fireEvent.scroll(window);

    expect(await screen.findByRole('region', { name: /December 5/ })).toBeInTheDocument();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('keeps the page in place when days load above', async () => {
    const db = await setup((agenda) => [allDayEvent(agenda, 'Long ago', '2026-10-20')]);
    renderApp(<TimelineView now={NOW} />, db);
    await screen.findAllByRole('region');

    // The page grows by 600 pixels once the days above are in, so the scroll moves down by 600
    mockPage(100, () => (document.getElementById('timeline-day-2026-10-20') ? 5600 : 5000));
    fireEvent.scroll(window);

    expect(await screen.findByRole('region', { name: /October 20/ })).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledWith(0, 700);
  });

  it('does not load by itself when the person did not scroll', async () => {
    renderApp(<TimelineView now={NOW} />, openTestDb());
    await screen.findAllByRole('region');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(screen.getByRole('button', { name: /20 empty days/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /7 empty days/ })).toBeInTheDocument();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('goes to a date inside the loaded range, opening the folded days around it', async () => {
    renderApp(<TimelineView now={NOW} />, openTestDb());
    await screen.findAllByRole('region');
    scrollIntoView.mockClear();

    fireEvent.change(screen.getByLabelText('Go to date'), { target: { value: '2026-11-15' } });

    const target = await screen.findByRole('region', { name: /November 15/ });
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    expect(scrollIntoView.mock.contexts[0]).toBe(target);
  });

  it('goes to a far date by replacing the range, and back to today the same way', async () => {
    const user = userEvent.setup();
    const db = await setup((agenda) => [allDayEvent(agenda, 'Exam', '2027-03-10')]);
    renderApp(<TimelineView now={NOW} />, db);
    await screen.findAllByRole('region');
    scrollIntoView.mockClear();

    fireEvent.change(screen.getByLabelText('Go to date'), { target: { value: '2027-03-10' } });
    const target = await screen.findByRole('region', {
      name: /March 10, 2027|Wednesday, March 10/,
    });
    expect(within(target).getByText('Exam')).toBeInTheDocument();
    expect(scrollIntoView.mock.contexts[0]).toBe(target);
    // The old range is gone, so today is not on the page now
    expect(screen.queryByRole('region', { name: /November 7/ })).not.toBeInTheDocument();

    scrollIntoView.mockClear();
    await user.click(screen.getByRole('button', { name: 'Go to today' }));
    const today = await screen.findByRole('region', { name: /November 7/ });
    expect(scrollIntoView.mock.contexts[0]).toBe(today);
  });

  it('ignores a date outside the accepted span', async () => {
    renderApp(<TimelineView now={NOW} />, openTestDb());
    await screen.findAllByRole('region');
    scrollIntoView.mockClear();

    fireEvent.change(screen.getByLabelText('Go to date'), { target: { value: '1800-01-01' } });
    fireEvent.change(screen.getByLabelText('Go to date'), { target: { value: '2300-06-01' } });

    expect(screen.getAllByRole('region')).toHaveLength(1);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('shows the back to top button only after scrolling, and goes to the top', async () => {
    const user = userEvent.setup();
    renderApp(<TimelineView now={NOW} />, openTestDb());
    await screen.findAllByRole('region');
    expect(screen.queryByRole('button', { name: 'Back to top' })).not.toBeInTheDocument();

    mockPage(700, () => 5000);
    fireEvent.scroll(window);
    await user.click(await screen.findByRole('button', { name: 'Back to top' }));
    expect(scrollTo).toHaveBeenLastCalledWith(0, 0);

    // The page is at the top now, and the button leaves
    mockPage(0, () => 5000);
    fireEvent.scroll(window);
    expect(screen.queryByRole('button', { name: 'Back to top' })).not.toBeInTheDocument();
  });
});

describe('TimelineView marking a task as done', () => {
  it('marks an open task as done from its row, and Undo brings it back', async () => {
    const user = userEvent.setup();
    let plannedId = '';
    const db = await setup((agenda, status) => {
      plannedId = status.planned;
      return [
        createItem({
          kind: 'task',
          title: 'Paper',
          agendaId: agenda.id,
          statusId: status.planned,
          due: { allDay: true, date: '2026-11-09' },
        }),
      ];
    });
    // The done group has two statuses. A finished task gets the first one, "Done".
    const doneId = (await db.statuses.toArray()).find((status) => status.name === 'Done')!.id;
    renderApp(<TimelineView now={NOW} />, db);
    await screen.findAllByRole('region');

    const today = within(day(/November 7/));
    await user.click(today.getByRole('button', { name: 'Mark Paper as done' }));

    // It leaves the strip, the message says so, and the database has the done status
    expect(await screen.findByText('"Paper" marked as done.')).toBeInTheDocument();
    // The list reads the database again after the save, a moment after the message shows up
    await waitFor(() => expect(today.queryByText('Paper')).not.toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'Open tasks' })).not.toBeInTheDocument();
    const [saved] = await db.items.toArray();
    expect(saved!.statusId).toBe(doneId);

    await user.click(screen.getByRole('button', { name: 'Undo: Paper is done' }));
    expect(await within(day(/November 7/)).findByText('Paper')).toBeInTheDocument();
    expect(screen.queryByText('"Paper" marked as done.')).not.toBeInTheDocument();
    const [restored] = await db.items.toArray();
    expect(restored!.statusId).toBe(plannedId);
  });

  it('marks an overdue task as done from the overdue strip', async () => {
    const user = userEvent.setup();
    const db = await setup((agenda, status) => [
      createItem({
        kind: 'task',
        title: 'Report',
        agendaId: agenda.id,
        statusId: status.planned,
        due: { allDay: true, date: '2026-11-04' },
      }),
    ]);
    renderApp(<TimelineView now={NOW} />, db);
    await screen.findAllByRole('region');

    const today = within(day(/November 7/));
    expect(today.getByRole('heading', { name: 'Overdue' })).toBeInTheDocument();
    await user.click(today.getByRole('button', { name: 'Mark Report as done' }));

    expect(await screen.findByText('"Report" marked as done.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Overdue' })).not.toBeInTheDocument();
  });

  it('has no Done button on events', async () => {
    const db = await setup((agenda) => [
      createItem({
        kind: 'event',
        title: 'Class',
        agendaId: agenda.id,
        schedule: { allDay: true, start: '2026-11-07' },
      }),
    ]);
    renderApp(<TimelineView now={NOW} />, db);
    await screen.findAllByRole('region');

    expect(within(day(/November 7/)).getByText('Class')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /as done/ })).not.toBeInTheDocument();
  });

  it('draws no Done button when there is no done status', async () => {
    const db = await setup((agenda, status) => [
      createItem({
        kind: 'task',
        title: 'Paper',
        agendaId: agenda.id,
        statusId: status.planned,
        due: { allDay: true, date: '2026-11-09' },
      }),
    ]);
    const doneGroup = (await db.statusGroups.toArray()).find((group) => group.role === 'done')!;
    await db.statuses.where('groupId').equals(doneGroup.id).delete();
    renderApp(<TimelineView now={NOW} />, db);
    await screen.findAllByRole('region');

    expect(within(day(/November 7/)).getByText('Paper')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /as done/ })).not.toBeInTheDocument();
  });

  it('speaks Portuguese', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'pt-BR');
    const user = userEvent.setup();
    const db = await setup((agenda, status) => [
      createItem({
        kind: 'task',
        title: 'Relatório',
        agendaId: agenda.id,
        statusId: status.planned,
        due: { allDay: true, date: '2026-11-09' },
      }),
    ]);
    renderApp(<TimelineView now={NOW} />, db);
    await screen.findAllByRole('region');

    await user.click(
      within(day(/sábado, 7 de novembro/)).getByRole('button', {
        name: 'Marcar Relatório como feita',
      }),
    );
    expect(await screen.findByText('"Relatório" marcada como feita.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desfazer: Relatório está feita' })).toBeVisible();
  });
});
