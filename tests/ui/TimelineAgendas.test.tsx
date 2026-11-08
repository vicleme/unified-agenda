import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  DEFAULT_SETTINGS,
  createAgenda,
  createAgendaGroup,
  createItem,
  createTag,
} from '../../src/core';
import { ensureDefaultStatuses, saveSettings } from '../../src/storage';
import { LOCALE_STORAGE_KEY } from '../../src/ui/i18n/locale';
import { en } from '../../src/ui/i18n/messages/en';
import { TimelineView } from '../../src/ui/TimelineView';
import { renderApp } from '../helpers';
import { openTestDb } from '../storage/helpers';

/** Saturday, November 7, 2026, 12:00 in São Paulo (UTC-3). */
const NOW = Date.UTC(2026, 10, 7, 15, 0, 0);

const school = createAgenda({ name: 'School', color: '#3b5bdb', order: 0 });
const home = createAgenda({ name: 'Home', color: '#2f9e44', order: 1 });
const health = createAgenda({ name: 'Health', color: '#e03131', order: 2 });
const personal = createAgendaGroup({ name: 'Personal', agendaIds: [home.id, health.id] });
const exams = createTag({ name: 'Exams', color: '#e8590c', agendaIds: [school.id] });
const chores = createTag({ name: 'Chores', color: '#2f9e44' });

const today = (title: string, agendaId: string, tagIds: string[] = []) =>
  createItem({
    kind: 'event',
    title,
    agendaId,
    tagIds,
    schedule: { allDay: true, start: '2026-11-07' },
  });

async function setup() {
  const db = openTestDb();
  await db.agendas.bulkPut([school, home, health]);
  await db.agendaGroups.put(personal);
  await db.tags.bulkPut([exams, chores]);
  await db.items.bulkPut([
    today('Exam', school.id, [exams.id]),
    today('Dishes', home.id, [chores.id]),
    today('Dentist', health.id),
  ]);
  await saveSettings(db, { ...DEFAULT_SETTINGS, displayTimeZone: 'America/Sao_Paulo' });
  await ensureDefaultStatuses(db, (key) => en.defaults[key]);
  return db;
}

const titles = () =>
  within(screen.getByRole('region', { name: /November 7/ }))
    .queryAllByRole('listitem')
    .map((row) => row.querySelector('.entry__title')?.textContent);

async function openPanel(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('region', { name: /November 7/ });
  await user.click(screen.getByRole('button', { name: /^Filters/ }));
  return screen.getByRole('group', { name: 'Timeline filters' });
}

describe('Timeline: agenda selection', () => {
  afterEach(() => localStorage.removeItem(LOCALE_STORAGE_KEY));

  it('lists the groups and the agendas, all shown at first', async () => {
    const user = userEvent.setup();
    renderApp(<TimelineView now={NOW} />, await setup());
    const panel = await openPanel(user);

    for (const name of ['School', 'Home', 'Health']) {
      expect(within(panel).getByRole('checkbox', { name })).toBeChecked();
    }
    expect(within(panel).getByRole('checkbox', { name: 'Group Personal' })).toBeChecked();
    expect(titles()).toEqual(['Dentist', 'Dishes', 'Exam']);
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();
  });

  it('hides an agenda, counts it as a filter, and shows it again', async () => {
    const user = userEvent.setup();
    renderApp(<TimelineView now={NOW} />, await setup());
    const panel = await openPanel(user);

    await user.click(within(panel).getByRole('checkbox', { name: 'Home' }));
    expect(titles()).toEqual(['Dentist', 'Exam']);
    expect(screen.getByRole('button', { name: 'Filters (1)' })).toBeInTheDocument();
    expect(screen.getByText(en.timeline.filters.activeNotice)).toBeInTheDocument();

    await user.click(within(panel).getByRole('checkbox', { name: 'Home' }));
    expect(titles()).toEqual(['Dentist', 'Dishes', 'Exam']);
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();
  });

  it('turns a whole group off and on, with a half state in between', async () => {
    const user = userEvent.setup();
    renderApp(<TimelineView now={NOW} />, await setup());
    const panel = await openPanel(user);
    const group = () => within(panel).getByRole('checkbox', { name: 'Group Personal' });

    await user.click(group());
    expect(titles()).toEqual(['Exam']);
    expect(group()).not.toBeChecked();

    await user.click(within(panel).getByRole('checkbox', { name: 'Health' }));
    expect(group()).not.toBeChecked();
    expect((group() as HTMLInputElement).indeterminate).toBe(true);

    await user.click(group());
    expect(titles()).toEqual(['Dentist', 'Dishes', 'Exam']);
    expect(group()).toBeChecked();
  });

  it('says nothing matches when every agenda is hidden, and clearing brings them back', async () => {
    const user = userEvent.setup();
    renderApp(<TimelineView now={NOW} />, await setup());
    const panel = await openPanel(user);

    for (const name of ['School', 'Home', 'Health']) {
      await user.click(within(panel).getByRole('checkbox', { name }));
    }
    expect(screen.getByText(en.timeline.filters.noMatch)).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'Clear filters' }));
    expect(titles()).toEqual(['Dentist', 'Dishes', 'Exam']);
    expect(within(panel).getByRole('checkbox', { name: 'School' })).toBeChecked();
    expect(screen.queryByText(en.timeline.filters.noMatch)).not.toBeInTheDocument();
  });

  it('offers only the tags valid in the shown agendas, and marks the partial ones', async () => {
    const user = userEvent.setup();
    renderApp(<TimelineView now={NOW} />, await setup());
    const panel = await openPanel(user);

    // All shown: Exams exists only in School, so it is marked. Chores is global.
    expect(within(panel).getByRole('checkbox', { name: /Exams/ })).toBeInTheDocument();
    expect(within(panel).getByText('(only in some agendas)')).toBeInTheDocument();

    await user.click(within(panel).getByRole('checkbox', { name: 'School' }));
    expect(within(panel).queryByRole('checkbox', { name: /Exams/ })).not.toBeInTheDocument();
    expect(within(panel).getByRole('checkbox', { name: /Chores/ })).toBeInTheDocument();
  });

  it('takes a ticked tag out of the filter when its agenda is hidden, and says so', async () => {
    const user = userEvent.setup();
    renderApp(<TimelineView now={NOW} />, await setup());
    const panel = await openPanel(user);

    await user.click(within(panel).getByRole('checkbox', { name: /Exams/ }));
    expect(titles()).toEqual(['Exam']);

    await user.click(within(panel).getByRole('checkbox', { name: 'School' }));
    expect(within(panel).getByRole('status')).toHaveTextContent(
      'Taken out of the tag filter because they do not exist in the shown agendas: Exams.',
    );
    // The tag filter is off now, so the other agendas show everything again
    expect(titles()).toEqual(['Dentist', 'Dishes']);
    expect(screen.getByRole('button', { name: 'Filters (1)' })).toBeInTheDocument();
  });

  it('does not show the agenda choice when there is a single agenda', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    await db.agendas.put(school);
    await db.items.put(today('Exam', school.id));
    await saveSettings(db, { ...DEFAULT_SETTINGS, displayTimeZone: 'America/Sao_Paulo' });
    await ensureDefaultStatuses(db, (key) => en.defaults[key]);
    renderApp(<TimelineView now={NOW} />, db);

    const panel = await openPanel(user);
    expect(within(panel).queryByText('Agendas')).not.toBeInTheDocument();
  });

  it('speaks Portuguese', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'pt-BR');
    const user = userEvent.setup();
    renderApp(<TimelineView now={NOW} />, await setup());
    await screen.findByRole('region', { name: /7 de novembro/ });
    await user.click(screen.getByRole('button', { name: /^Filtros/ }));
    const panel = screen.getByRole('group', { name: /filtros/i });
    expect(within(panel).getByRole('checkbox', { name: 'Grupo Personal' })).toBeInTheDocument();
    expect(within(panel).getByText('Agendas')).toBeInTheDocument();
  });
});
