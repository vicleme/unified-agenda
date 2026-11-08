import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  DEFAULT_SETTINGS,
  createAgenda,
  createItem,
  createTag,
  type Item,
  type Tag,
} from '../../src/core';
import { ensureDefaultStatuses, saveSettings } from '../../src/storage';
import { LOCALE_STORAGE_KEY } from '../../src/ui/i18n/locale';
import { en } from '../../src/ui/i18n/messages/en';
import { TimelineView } from '../../src/ui/TimelineView';
import { renderApp } from '../helpers';
import { openTestDb } from '../storage/helpers';

/** Saturday, November 7, 2026, 12:00 in São Paulo (UTC-3). */
const NOW = Date.UTC(2026, 10, 7, 15, 0, 0);
const ZONE = 'America/Sao_Paulo';

interface Built {
  tags: Tag[];
  items: Item[];
}

async function setup(
  build: (ctx: {
    agendaId: string;
    planned: string;
    done: string;
    school: Tag;
    math: Tag;
  }) => Built,
) {
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
  const school = createTag({ name: 'School', color: '#2f9e44' });
  const math = createTag({ name: 'Math', color: '#e8590c', parentId: school.id });
  const built = build({
    agendaId: agenda.id,
    planned: firstOf('planned'),
    done: firstOf('done'),
    school,
    math,
  });
  await db.tags.bulkPut([school, math, ...built.tags]);
  // Fixed creation day, so a task with no start day does not depend on today's real date
  await db.items.bulkPut(
    built.items.map((item) => ({ ...item, createdAt: '2026-11-07T12:00:00.000Z' })),
  );
  return db;
}

const titles = (scope: ReturnType<typeof within> | typeof screen = screen) =>
  scope
    .queryAllByRole('listitem')
    .map((row: HTMLElement) => row.querySelector('.entry__title')?.textContent);

async function openFilters(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Filters' }));
  return screen.getByRole('group', { name: 'Timeline filters' });
}

describe('Timeline filters', () => {
  afterEach(() => localStorage.removeItem(LOCALE_STORAGE_KEY));

  it('starts closed and opens and closes from the bar, giving the focus back', async () => {
    const user = userEvent.setup();
    const db = await setup(() => ({ tags: [], items: [] }));
    renderApp(<TimelineView now={NOW} />, db);

    const toggle = await screen.findByRole('button', { name: 'Filters' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('group', { name: 'Timeline filters' })).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('group', { name: 'Timeline filters' });

    await user.click(within(panel).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('group', { name: 'Timeline filters' })).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
  });

  it('closes with Escape', async () => {
    const user = userEvent.setup();
    const db = await setup(() => ({ tags: [], items: [] }));
    renderApp(<TimelineView now={NOW} />, db);

    const panel = await openFilters(user);
    await user.click(within(panel).getByLabelText('Search text'));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: 'Timeline filters' })).not.toBeInTheDocument();
  });

  it('filters by text, shows the count and the notice, and clears everything', async () => {
    const user = userEvent.setup();
    const db = await setup(({ agendaId }) => ({
      tags: [],
      items: [
        createItem({
          kind: 'event',
          title: 'Statistics class',
          agendaId,
          schedule: { allDay: true, start: '2026-11-07' },
        }),
        createItem({
          kind: 'event',
          title: 'Dentist',
          agendaId,
          schedule: { allDay: true, start: '2026-11-07' },
        }),
      ],
    }));
    renderApp(<TimelineView now={NOW} />, db);

    const today = () => within(screen.getByRole('region', { name: /November 7/ }));
    await screen.findByRole('region', { name: /November 7/ });
    expect(titles(today())).toEqual(['Dentist', 'Statistics class']);
    expect(screen.queryByText(en.timeline.filters.activeNotice)).not.toBeInTheDocument();

    const panel = await openFilters(user);
    await user.type(within(panel).getByLabelText('Search text'), 'STATIS');

    expect(titles(today())).toEqual(['Statistics class']);
    expect(screen.getByRole('button', { name: 'Filters (1)' })).toBeInTheDocument();
    expect(screen.getByText(en.timeline.filters.activeNotice)).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'Clear filters' }));
    expect(titles(today())).toEqual(['Dentist', 'Statistics class']);
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();
    expect(within(panel).getByLabelText('Search text')).toHaveValue('');
    expect(screen.queryByText(en.timeline.filters.activeNotice)).not.toBeInTheDocument();
  });

  it('filters by type', async () => {
    const user = userEvent.setup();
    const db = await setup(({ agendaId, planned }) => ({
      tags: [],
      items: [
        createItem({
          kind: 'event',
          title: 'Class',
          agendaId,
          schedule: { allDay: true, start: '2026-11-07' },
        }),
        createItem({
          kind: 'task',
          title: 'Report',
          agendaId,
          statusId: planned,
          due: { allDay: true, date: '2026-11-07' },
        }),
      ],
    }));
    renderApp(<TimelineView now={NOW} />, db);

    const panel = await openFilters(user);
    const today = () => within(screen.getByRole('region', { name: /November 7/ }));
    expect(titles(today()).sort()).toEqual(['Class', 'Report']);

    await user.click(within(panel).getByRole('checkbox', { name: 'Task' }));
    expect(titles(today())).toEqual(['Report']);

    await user.click(within(panel).getByRole('checkbox', { name: 'Task' }));
    await user.click(within(panel).getByRole('checkbox', { name: 'Event' }));
    expect(titles(today())).toEqual(['Class']);
  });

  it('filters by tag, and a parent tag also shows what is tagged with the tags inside it', async () => {
    const user = userEvent.setup();
    const db = await setup(({ agendaId, school, math }) => ({
      tags: [],
      items: [
        createItem({
          kind: 'event',
          title: 'Algebra',
          agendaId,
          tagIds: [math.id],
          schedule: { allDay: true, start: '2026-11-07' },
        }),
        createItem({
          kind: 'event',
          title: 'Assembly',
          agendaId,
          tagIds: [school.id],
          schedule: { allDay: true, start: '2026-11-07' },
        }),
        createItem({
          kind: 'event',
          title: 'Dentist',
          agendaId,
          schedule: { allDay: true, start: '2026-11-07' },
        }),
      ],
    }));
    renderApp(<TimelineView now={NOW} />, db);

    const panel = await openFilters(user);
    const today = () => within(screen.getByRole('region', { name: /November 7/ }));

    // The tags are listed as a tree: School, then Math inside it
    const boxes = within(panel)
      .getAllByRole('checkbox')
      .map((box) => box.closest('label')?.textContent);
    expect(boxes.slice(-2)).toEqual(['School', 'Math']);

    await user.click(within(panel).getByRole('checkbox', { name: 'Math' }));
    expect(titles(today())).toEqual(['Algebra']);

    await user.click(within(panel).getByRole('checkbox', { name: 'Math' }));
    await user.click(within(panel).getByRole('checkbox', { name: 'School' }));
    expect(titles(today()).sort()).toEqual(['Algebra', 'Assembly']);
  });

  it('keeps whole-day items and tasks with "No set time", and timed events with a period', async () => {
    const user = userEvent.setup();
    const db = await setup(({ agendaId, planned }) => ({
      tags: [],
      items: [
        createItem({
          kind: 'event',
          title: 'Holiday',
          agendaId,
          schedule: { allDay: true, start: '2026-11-07' },
        }),
        createItem({
          kind: 'event',
          title: 'Morning class',
          agendaId,
          // 08:00 to 09:00 in São Paulo
          schedule: {
            allDay: false,
            start: '2026-11-07T11:00:00.000Z',
            end: '2026-11-07T12:00:00.000Z',
          },
        }),
        createItem({
          kind: 'event',
          title: 'Night class',
          agendaId,
          // 20:00 to 21:00 in São Paulo
          schedule: {
            allDay: false,
            start: '2026-11-07T23:00:00.000Z',
            end: '2026-11-08T00:00:00.000Z',
          },
        }),
        createItem({
          kind: 'task',
          title: 'Report',
          agendaId,
          statusId: planned,
          due: { allDay: true, date: '2026-11-07' },
        }),
      ],
    }));
    renderApp(<TimelineView now={NOW} />, db);

    const panel = await openFilters(user);
    const today = () => within(screen.getByRole('region', { name: /November 7/ }));
    expect(titles(today())).toHaveLength(4);

    await user.click(within(panel).getByRole('checkbox', { name: 'Morning' }));
    expect(titles(today())).toEqual(['Morning class']);

    await user.click(within(panel).getByRole('checkbox', { name: 'No set time' }));
    expect(titles(today()).sort()).toEqual(['Holiday', 'Morning class', 'Report']);

    await user.click(within(panel).getByRole('checkbox', { name: 'Morning' }));
    expect(titles(today()).sort()).toEqual(['Holiday', 'Report']);
  });

  it('shows a task only when its delivery is near, and never hides an overdue one', async () => {
    const user = userEvent.setup();
    const db = await setup(({ agendaId, planned }) => ({
      tags: [],
      items: [
        createItem({
          kind: 'task',
          title: 'Thesis',
          agendaId,
          statusId: planned,
          from: '2026-11-07',
          due: { allDay: true, date: '2027-02-01' },
        }),
        createItem({
          kind: 'task',
          title: 'Lab report',
          agendaId,
          statusId: planned,
          from: '2026-11-07',
          due: { allDay: true, date: '2026-11-09' },
        }),
        createItem({
          kind: 'task',
          title: 'Old form',
          agendaId,
          statusId: planned,
          due: { allDay: true, date: '2026-11-03' },
        }),
      ],
    }));
    renderApp(<TimelineView now={NOW} />, db);

    const panel = await openFilters(user);
    const today = () => within(screen.getByRole('region', { name: /November 7/ }));
    expect(titles(today()).sort()).toEqual(['Lab report', 'Old form', 'Thesis']);

    await user.type(within(panel).getByLabelText(/due within/i), '3');
    expect(titles(today()).sort()).toEqual(['Lab report', 'Old form']);
    expect(screen.getByRole('button', { name: 'Filters (1)' })).toBeInTheDocument();

    // Zero is a real limit: only on the delivery day, and overdue still shows
    await user.clear(within(panel).getByLabelText(/due within/i));
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();
    await user.type(within(panel).getByLabelText(/due within/i), '0');
    expect(titles(today())).toEqual(['Old form']);
  });

  it('says when nothing matches and offers to clear', async () => {
    const user = userEvent.setup();
    const db = await setup(({ agendaId }) => ({
      tags: [],
      items: [
        createItem({
          kind: 'event',
          title: 'Dentist',
          agendaId,
          schedule: { allDay: true, start: '2026-11-07' },
        }),
      ],
    }));
    renderApp(<TimelineView now={NOW} />, db);

    const panel = await openFilters(user);
    await user.type(within(panel).getByLabelText('Search text'), 'zebra');
    expect(screen.getByText('No item matches the filters.')).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'Close' }));
    const [clear] = screen.getAllByRole('button', { name: 'Clear filters' });
    await user.click(clear!);
    expect(screen.queryByText('No item matches the filters.')).not.toBeInTheDocument();
    expect(titles()).toEqual(['Dentist']);
  });

  it('uses the day period hours from the settings', async () => {
    const user = userEvent.setup();
    const db = await setup(({ agendaId }) => ({
      tags: [],
      items: [
        createItem({
          kind: 'event',
          title: 'Class at 8',
          agendaId,
          schedule: {
            allDay: false,
            start: '2026-11-07T11:00:00.000Z',
            end: '2026-11-07T12:00:00.000Z',
          },
        }),
      ],
    }));
    // Morning only starts at 9, so an 08:00 class is still dawn
    await saveSettings(db, {
      displayTimeZone: ZONE,
      periodBounds: { morningStart: 9, afternoonStart: 13, eveningStart: 19 },
    });
    renderApp(<TimelineView now={NOW} />, db);

    const panel = await openFilters(user);
    await user.click(within(panel).getByRole('checkbox', { name: 'Morning' }));
    expect(screen.getByText('No item matches the filters.')).toBeInTheDocument();
    await user.click(within(panel).getByRole('checkbox', { name: 'Morning' }));
    await user.click(within(panel).getByRole('checkbox', { name: 'Dawn' }));
    expect(titles()).toEqual(['Class at 8']);
  });

  it('speaks Portuguese', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'pt-BR');
    const user = userEvent.setup();
    const db = await setup(() => ({ tags: [], items: [] }));
    renderApp(<TimelineView now={NOW} />, db);

    await user.click(await screen.findByRole('button', { name: 'Filtros' }));
    const panel = screen.getByRole('group', { name: 'Filtros da Linha do Tempo' });
    for (const name of ['Madrugada', 'Manhã', 'Tarde', 'Noite', 'Sem hora marcada', 'Tarefa']) {
      expect(within(panel).getByRole('checkbox', { name })).toBeInTheDocument();
    }
    await user.type(within(panel).getByLabelText('Buscar texto'), 'xyz');
    expect(screen.getByText('Nenhum item combina com os filtros.')).toBeInTheDocument();
  });
});
