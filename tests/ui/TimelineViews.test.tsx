import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  DEFAULT_SETTINGS,
  createAgenda,
  createItem,
  createSavedView,
  createTag,
} from '../../src/core';
import { ensureDefaultStatuses, saveSettings } from '../../src/storage';
import { AppShell } from '../../src/ui/AppShell';
import { LOCALE_STORAGE_KEY } from '../../src/ui/i18n/locale';
import { en } from '../../src/ui/i18n/messages/en';
import { TimelineView } from '../../src/ui/TimelineView';
import { renderApp } from '../helpers';
import { openTestDb } from '../storage/helpers';

/** Saturday, November 7, 2026, 12:00 in São Paulo (UTC-3). */
const NOW = Date.UTC(2026, 10, 7, 15, 0, 0);
const text = en.timeline.filters.views;

const school = createAgenda({ name: 'School', color: '#3b5bdb', order: 0 });
const home = createAgenda({ name: 'Home', color: '#2f9e44', order: 1 });
const study = createTag({ name: 'Study', color: '#3b5bdb' });

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
  await db.agendas.bulkPut([school, home]);
  await db.tags.put(study);
  await db.items.bulkPut([today('Exam', school.id, [study.id]), today('Dishes', home.id)]);
  await saveSettings(db, { ...DEFAULT_SETTINGS, displayTimeZone: 'America/Sao_Paulo' });
  await ensureDefaultStatuses(db, (key) => en.defaults[key]);
  return db;
}

type User = ReturnType<typeof userEvent.setup>;

async function openPanel(user: User) {
  await screen.findByRole('region', { name: /November 7/ });
  await user.click(screen.getByRole('button', { name: /^Filters/ }));
  return screen.getByRole('group', { name: 'Timeline filters' });
}

const rowTitles = () =>
  within(screen.getByRole('region', { name: /November 7/ }))
    .queryAllByRole('listitem')
    .map((row) => row.querySelector('.entry__title')?.textContent);

async function saveAs(user: User, panel: HTMLElement, name: string) {
  await user.click(within(panel).getByRole('button', { name: /^Save as (new )?view$/ }));
  await user.type(screen.getByLabelText(text.form.name), name);
  await user.click(screen.getByRole('button', { name: text.form.save }));
}

describe('Timeline: saved views', () => {
  afterEach(() => localStorage.removeItem(LOCALE_STORAGE_KEY));

  it('saves what is on screen and stores it', async () => {
    const user = userEvent.setup();
    const db = await setup();
    renderApp(<TimelineView now={NOW} />, db);
    const panel = await openPanel(user);

    expect(within(panel).getByText(text.empty)).toBeInTheDocument();
    await user.click(within(panel).getByRole('checkbox', { name: 'Home' }));
    await user.click(
      within(panel).getByRole('radio', { name: en.timeline.filters.layouts.separate }),
    );
    await saveAs(user, panel, 'Only school');

    await waitFor(async () => expect(await db.savedViews.count()).toBe(1));
    const [saved] = await db.savedViews.toArray();
    expect(saved).toMatchObject({
      name: 'Only school',
      agendaIds: [school.id],
      layout: 'separate',
    });
    expect(await screen.findByText('View: Only school')).toBeInTheDocument();
  });

  it('applies a view and shows it as changed after an edit', async () => {
    const user = userEvent.setup();
    const db = await setup();
    await db.savedViews.put(
      createSavedView({ name: 'Study', filter: { ...emptyFilter(), tagIds: [study.id] } }),
    );
    renderApp(<TimelineView now={NOW} />, db);
    const panel = await openPanel(user);

    await user.selectOptions(within(panel).getByLabelText(text.select), 'Study');
    expect(rowTitles()).toEqual(['Exam']);
    expect(screen.getByText('View: Study')).toBeInTheDocument();
    expect(within(panel).getByRole('checkbox', { name: 'Study' })).toBeChecked();

    await user.click(within(panel).getByRole('checkbox', { name: 'Study' }));
    expect(screen.getByText(`View: Study (${text.changed})`)).toBeInTheDocument();
    expect(rowTitles()).toEqual(['Dishes', 'Exam']);

    await user.click(within(panel).getByRole('button', { name: /^Go back to the saved/ }));
    expect(rowTitles()).toEqual(['Exam']);
    expect(screen.getByText('View: Study')).toBeInTheDocument();
  });

  it('updates the view with what is on screen', async () => {
    const user = userEvent.setup();
    const db = await setup();
    const view = createSavedView({ name: 'Mine' });
    await db.savedViews.put(view);
    renderApp(<TimelineView now={NOW} />, db);
    const panel = await openPanel(user);

    await user.selectOptions(within(panel).getByLabelText(text.select), 'Mine');
    const update = within(panel).getByRole('button', { name: /^Update the view/ });
    expect(update).toBeDisabled();

    await user.click(within(panel).getByRole('checkbox', { name: 'Home' }));
    await user.click(update);
    await waitFor(async () =>
      expect((await db.savedViews.get(view.id))?.agendaIds).toEqual([school.id]),
    );
    expect(await screen.findByText('View: Mine')).toBeInTheDocument();
  });

  it('renames a view and refuses a name another view has', async () => {
    const user = userEvent.setup();
    const db = await setup();
    const first = createSavedView({ name: 'First', order: 0 });
    await db.savedViews.bulkPut([first, createSavedView({ name: 'Second', order: 1 })]);
    renderApp(<TimelineView now={NOW} />, db);
    const panel = await openPanel(user);

    await user.selectOptions(within(panel).getByLabelText(text.select), 'First');
    await user.click(within(panel).getByRole('button', { name: /^Rename the view/ }));
    const field = screen.getByLabelText(text.form.name);
    await user.clear(field);
    await user.type(field, ' second ');
    await user.click(screen.getByRole('button', { name: text.form.save }));
    expect(await screen.findByText(text.form.nameTaken)).toBeInTheDocument();

    await user.clear(field);
    await user.type(field, 'Renamed');
    await user.click(screen.getByRole('button', { name: text.form.save }));
    await waitFor(async () => expect((await db.savedViews.get(first.id))?.name).toBe('Renamed'));
  });

  it('refuses an empty name', async () => {
    const user = userEvent.setup();
    renderApp(<TimelineView now={NOW} />, await setup());
    const panel = await openPanel(user);

    await user.click(within(panel).getByRole('button', { name: text.saveFirst }));
    await user.click(screen.getByRole('button', { name: text.form.save }));
    expect(await screen.findByText(text.form.nameRequired)).toBeInTheDocument();
  });

  it('deletes only after asking, and keeps the controls', async () => {
    const user = userEvent.setup();
    const db = await setup();
    const view = createSavedView({ name: 'Doomed', filter: { ...emptyFilter(), text: 'exam' } });
    await db.savedViews.put(view);
    renderApp(<TimelineView now={NOW} />, db);
    const panel = await openPanel(user);

    await user.selectOptions(within(panel).getByLabelText(text.select), 'Doomed');
    await user.click(within(panel).getByRole('button', { name: /^Delete the view/ }));
    await user.click(within(panel).getByRole('button', { name: text.cancel }));
    expect((await db.savedViews.get(view.id))?.deletedAt).toBeNull();

    await user.click(within(panel).getByRole('button', { name: /^Delete the view/ }));
    await user.click(within(panel).getByRole('button', { name: text.confirmAction }));
    await waitFor(async () => expect((await db.savedViews.get(view.id))?.deletedAt).not.toBeNull());
    await waitFor(() => expect(screen.queryByText(/^View: /)).not.toBeInTheDocument());
    // The sieves stay as they were
    expect(rowTitles()).toEqual(['Exam']);
  });

  it('moves the picked view up and down the list', async () => {
    const user = userEvent.setup();
    const db = await setup();
    const a = createSavedView({ name: 'A', order: 0 });
    const b = createSavedView({ name: 'B', order: 1 });
    await db.savedViews.bulkPut([a, b]);
    renderApp(<TimelineView now={NOW} />, db);
    const panel = await openPanel(user);

    await user.selectOptions(within(panel).getByLabelText(text.select), 'B');
    expect(within(panel).getByRole('button', { name: /^Move the view B down/ })).toBeDisabled();
    await user.click(within(panel).getByRole('button', { name: /^Move the view B up/ }));
    await waitFor(async () => expect((await db.savedViews.get(b.id))?.order).toBe(0));
    expect((await db.savedViews.get(a.id))?.order).toBe(1);
    await waitFor(() => {
      const names = within(within(panel).getByLabelText(text.select))
        .getAllByRole('option')
        .map((option) => option.textContent);
      expect(names).toEqual([text.none, 'B', 'A']);
    });
  });

  it('remembers the filters and the view when the tab changes', async () => {
    const user = userEvent.setup();
    const db = await setup();
    await db.savedViews.put(
      createSavedView({ name: 'Study', filter: { ...emptyFilter(), tagIds: [study.id] } }),
    );
    renderApp(<AppShell />, db);
    await screen.findByRole('region', { name: /^Today|November/ }).catch(() => undefined);
    await user.click(await screen.findByRole('button', { name: /^Filters/ }));
    const panel = screen.getByRole('group', { name: 'Timeline filters' });
    await user.selectOptions(within(panel).getByLabelText(text.select), 'Study');

    await user.click(screen.getByRole('tab', { name: 'Kanban' }));
    await user.click(screen.getByRole('tab', { name: 'Timeline' }));

    expect(await screen.findByText('View: Study')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Filters \(1\)/ })).toBeInTheDocument();
  });
});

function emptyFilter() {
  return { tagIds: [], kinds: [], periods: [], text: '', dueWithinDays: null };
}
