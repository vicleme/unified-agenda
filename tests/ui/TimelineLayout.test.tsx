import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_SETTINGS, createAgenda, createAgendaGroup, createItem } from '../../src/core';
import { ensureDefaultStatuses, saveSettings } from '../../src/storage';
import { LOCALE_STORAGE_KEY } from '../../src/ui/i18n/locale';
import { en } from '../../src/ui/i18n/messages/en';
import { ptBR } from '../../src/ui/i18n/messages/pt-BR';
import { TimelineView } from '../../src/ui/TimelineView';
import { renderApp } from '../helpers';
import { openTestDb } from '../storage/helpers';

/** Saturday, November 7, 2026, 12:00 in São Paulo (UTC-3). */
const NOW = Date.UTC(2026, 10, 7, 15, 0, 0);

const school = createAgenda({ name: 'School', color: '#3b5bdb', order: 0 });
const home = createAgenda({ name: 'Home', color: '#2f9e44', order: 1 });
const health = createAgenda({ name: 'Health', color: '#e03131', order: 2 });
const personal = createAgendaGroup({ name: 'Personal', agendaIds: [home.id, health.id] });

const today = (title: string, agendaId: string) =>
  createItem({
    kind: 'event',
    title,
    agendaId,
    schedule: { allDay: true, start: '2026-11-07' },
  });

async function setup(withLateTask = false) {
  const db = openTestDb();
  await db.agendas.bulkPut([school, home, health]);
  await db.agendaGroups.put(personal);
  await db.items.bulkPut([
    today('Exam', school.id),
    today('Dishes', home.id),
    today('Dentist', health.id),
  ]);
  await saveSettings(db, { ...DEFAULT_SETTINGS, displayTimeZone: 'America/Sao_Paulo' });
  await ensureDefaultStatuses(db, (key) => en.defaults[key]);
  if (withLateTask) {
    const planned = (await db.statusGroups.toArray()).find((group) => group.role === 'planned')!;
    const status = (await db.statuses.toArray()).find((s) => s.groupId === planned.id)!;
    await db.items.put(
      createItem({
        kind: 'task',
        title: 'Late paper',
        agendaId: home.id,
        from: '2026-11-01',
        due: { allDay: true, date: '2026-11-03' },
        statusId: status.id,
      }),
    );
  }
  return db;
}

const dayRegion = () => screen.getByRole('region', { name: /November 7/ });

/** The section titles of today, in order. */
const sectionTitles = () =>
  within(dayRegion())
    .queryAllByRole('group')
    .map((section) => section.querySelector('.day__section-title')?.textContent);

/** The titles of the rows inside one section. */
const rowsIn = (name: string) =>
  within(within(dayRegion()).getByRole('group', { name }))
    .queryAllByRole('listitem')
    .map((row) => row.querySelector('.entry__title')?.textContent);

async function openPanel(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('region', { name: /November 7/ });
  await user.click(screen.getByRole('button', { name: /^Filters/ }));
  return screen.getByRole('group', { name: 'Timeline filters' });
}

const choose = async (
  user: ReturnType<typeof userEvent.setup>,
  panel: HTMLElement,
  label: string,
) => user.click(within(panel).getByRole('radio', { name: label }));

describe('Timeline: layout', () => {
  afterEach(() => localStorage.removeItem(LOCALE_STORAGE_KEY));

  it('starts mixed: one list, no section titles', async () => {
    const user = userEvent.setup();
    renderApp(<TimelineView now={NOW} />, await setup());
    const panel = await openPanel(user);

    expect(
      within(panel).getByRole('radio', { name: en.timeline.filters.layouts.mixed }),
    ).toBeChecked();
    expect(sectionTitles()).toEqual([]);
  });

  it('separates by agenda, in the order of the agendas', async () => {
    const user = userEvent.setup();
    renderApp(<TimelineView now={NOW} />, await setup());
    const panel = await openPanel(user);

    await choose(user, panel, en.timeline.filters.layouts.separate);
    expect(sectionTitles()).toEqual(['School', 'Home', 'Health']);
    expect(rowsIn('School')).toEqual(['Exam']);
    expect(rowsIn('Home')).toEqual(['Dishes']);
    expect(rowsIn('Health')).toEqual(['Dentist']);
  });

  it('groups by group, with a last section for the agendas in no group', async () => {
    const user = userEvent.setup();
    renderApp(<TimelineView now={NOW} />, await setup());
    const panel = await openPanel(user);

    await choose(user, panel, en.timeline.filters.layouts.grouped);
    expect(sectionTitles()).toEqual(['Personal', 'No group']);
    expect(rowsIn('Personal')).toEqual(['Dentist', 'Dishes']);
    expect(rowsIn('No group')).toEqual(['Exam']);
  });

  it('goes back to mixed and never counts as a filter', async () => {
    const user = userEvent.setup();
    renderApp(<TimelineView now={NOW} />, await setup());
    const panel = await openPanel(user);

    await choose(user, panel, en.timeline.filters.layouts.separate);
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();
    expect(screen.queryByText(en.timeline.filters.activeNotice)).not.toBeInTheDocument();

    await choose(user, panel, en.timeline.filters.layouts.mixed);
    expect(sectionTitles()).toEqual([]);
  });

  it('does not make a section for a hidden agenda', async () => {
    const user = userEvent.setup();
    renderApp(<TimelineView now={NOW} />, await setup());
    const panel = await openPanel(user);

    await choose(user, panel, en.timeline.filters.layouts.separate);
    await user.click(within(panel).getByRole('checkbox', { name: 'Home' }));
    expect(sectionTitles()).toEqual(['School', 'Health']);
  });

  it('deals the overdue strip into the same sections as the day', async () => {
    const user = userEvent.setup();
    const db = await setup(true);
    renderApp(<TimelineView now={NOW} />, db);
    const panel = await openPanel(user);

    await choose(user, panel, en.timeline.filters.layouts.separate);
    expect(rowsIn('Home')).toEqual(['Late paper', 'Dishes']);
    const homeSection = within(dayRegion()).getByRole('group', { name: 'Home' });
    expect(
      within(homeSection).getByRole('heading', { name: en.timeline.overdue }),
    ).toBeInTheDocument();
    expect(rowsIn('School')).toEqual(['Exam']);
  });

  it('is not offered with a single agenda', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    await db.agendas.put(school);
    await db.items.put(today('Exam', school.id));
    await saveSettings(db, { ...DEFAULT_SETTINGS, displayTimeZone: 'America/Sao_Paulo' });
    await ensureDefaultStatuses(db, (key) => en.defaults[key]);
    renderApp(<TimelineView now={NOW} />, db);
    const panel = await openPanel(user);

    expect(within(panel).queryByRole('radio')).not.toBeInTheDocument();
  });

  it('speaks Portuguese', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'pt-BR');
    const user = userEvent.setup();
    renderApp(<TimelineView now={NOW} />, await setup());
    await screen.findByRole('region', { name: /7 de novembro/ });
    await user.click(screen.getByRole('button', { name: /^Filtros/ }));
    const panel = screen.getByRole('group', { name: ptBR.timeline.filters.panelLabel });

    await user.click(
      within(panel).getByRole('radio', { name: ptBR.timeline.filters.layouts.grouped }),
    );
    const region = screen.getByRole('region', { name: /7 de novembro/ });
    const titles = within(region)
      .getAllByRole('group')
      .map((section) => section.querySelector('.day__section-title')?.textContent);
    expect(titles).toEqual(['Personal', ptBR.timeline.ungrouped]);
  });
});
