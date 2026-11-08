import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createAgenda, createAgendaGroup } from '../../src/core';
import { AgendaGroupsSection } from '../../src/ui/AgendaGroupsSection';
import { AgendasSection } from '../../src/ui/AgendasSection';
import { LOCALE_STORAGE_KEY } from '../../src/ui/i18n/locale';
import { renderApp } from '../helpers';
import { openTestDb } from '../storage/helpers';

const school = createAgenda({ name: 'School', color: '#3b5bdb', order: 0 });
const home = createAgenda({ name: 'Home', color: '#2f9e44', order: 1 });
const health = createAgenda({ name: 'Health', color: '#e03131', order: 2 });

async function dbWithAgendas() {
  const db = openTestDb();
  await db.agendas.bulkPut([school, home, health]);
  return db;
}

describe('AgendaGroupsSection', () => {
  it('shows the empty state and creates a group with the ticked agendas', async () => {
    const user = userEvent.setup();
    const db = await dbWithAgendas();
    renderApp(<AgendaGroupsSection />, db);
    expect(await screen.findByText(/No groups yet/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'New group' }));
    await user.type(screen.getByLabelText('Name'), '  Personal  ');
    // Ticked in the opposite order, saved in the order of the agendas
    await user.click(screen.getByRole('checkbox', { name: 'Health' }));
    await user.click(screen.getByRole('checkbox', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Personal')).toBeInTheDocument();
    expect(screen.getByText('Home, Health')).toBeInTheDocument();
    const saved = await db.agendaGroups.toArray();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ name: 'Personal', agendaIds: [home.id, health.id], order: 0 });
  });

  it('asks for a name and saves nothing without one', async () => {
    const user = userEvent.setup();
    const db = await dbWithAgendas();
    renderApp(<AgendaGroupsSection />, db);

    await user.click(await screen.findByRole('button', { name: 'New group' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name for the group.');
    expect(await db.agendaGroups.count()).toBe(0);
  });

  it('lets a group start with no agenda, and says so', async () => {
    const user = userEvent.setup();
    const db = await dbWithAgendas();
    renderApp(<AgendaGroupsSection />, db);

    await user.click(await screen.findByRole('button', { name: 'New group' }));
    await user.type(screen.getByLabelText('Name'), 'Empty');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('No agendas')).toBeInTheDocument();
  });

  it('points to creating an agenda first when there is none', async () => {
    const user = userEvent.setup();
    renderApp(<AgendaGroupsSection />, openTestDb());

    await user.click(await screen.findByRole('button', { name: 'New group' }));
    expect(screen.getByText('Create an agenda first to put it in a group.')).toBeInTheDocument();
  });

  it('edits the name and the agendas of a group', async () => {
    const user = userEvent.setup();
    const db = await dbWithAgendas();
    const group = createAgendaGroup({ name: 'Persnal', agendaIds: [home.id] });
    await db.agendaGroups.put(group);
    renderApp(<AgendaGroupsSection />, db);

    await user.click(await screen.findByRole('button', { name: 'Edit Persnal' }));
    expect(screen.getByLabelText('Name')).toHaveValue('Persnal');
    expect(screen.getByRole('checkbox', { name: 'Home' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'School' })).not.toBeChecked();

    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Personal');
    await user.click(screen.getByRole('checkbox', { name: 'Home' }));
    await user.click(screen.getByRole('checkbox', { name: 'School' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Personal')).toBeInTheDocument();
    expect(await db.agendaGroups.get(group.id)).toMatchObject({
      name: 'Personal',
      agendaIds: [school.id],
    });
  });

  it('moves a group up and down, with the first and last buttons off', async () => {
    const user = userEvent.setup();
    const db = await dbWithAgendas();
    const a = createAgendaGroup({ name: 'Alpha', order: 0 });
    const b = createAgendaGroup({ name: 'Beta', order: 1 });
    await db.agendaGroups.bulkPut([a, b]);
    renderApp(<AgendaGroupsSection />, db);

    expect(await screen.findByRole('button', { name: 'Move Alpha up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Beta down' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Move Beta up' }));
    await waitFor(async () => expect((await db.agendaGroups.get(b.id))?.order).toBe(0));
    expect((await db.agendaGroups.get(a.id))?.order).toBe(1);
    await waitFor(() => expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Beta'));
  });

  it('deletes a group after the confirmation and keeps the agendas', async () => {
    const user = userEvent.setup();
    const db = await dbWithAgendas();
    const group = createAgendaGroup({ name: 'Personal', agendaIds: [home.id] });
    await db.agendaGroups.put(group);
    renderApp(<AgendaGroupsSection />, db);

    await user.click(await screen.findByRole('button', { name: 'Delete Personal' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent(
      'Delete the group "Personal"? The agendas and their items stay.',
    );

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect((await db.agendaGroups.get(group.id))?.deletedAt).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Delete Personal' }));
    await user.click(await screen.findByRole('button', { name: 'Delete group' }));

    await waitFor(() => expect(screen.queryByText('Personal')).not.toBeInTheDocument());
    expect((await db.agendaGroups.get(group.id))?.deletedAt).not.toBeNull();
    expect(await db.agendas.count()).toBe(3);
    expect((await db.agendas.get(home.id))?.deletedAt).toBeNull();
  });

  it('speaks Portuguese when the language is Portuguese', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'pt-BR');
    const db = await dbWithAgendas();
    renderApp(<AgendaGroupsSection />, db);
    expect(await screen.findByText(/Nenhum grupo ainda/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Novo grupo' })).toBeInTheDocument();
    localStorage.removeItem(LOCALE_STORAGE_KEY);
  });
});

describe('AgendasSection: order', () => {
  it('moves an agenda down and renumbers the agendas', async () => {
    const user = userEvent.setup();
    const db = await dbWithAgendas();
    renderApp(<AgendasSection />, db);

    expect(await screen.findByRole('button', { name: 'Move School up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Health down' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Move School down' }));
    await waitFor(async () => expect((await db.agendas.get(school.id))?.order).toBe(1));
    expect((await db.agendas.get(home.id))?.order).toBe(0);
    expect((await db.agendas.get(health.id))?.order).toBe(2);
    await waitFor(() => expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Home'));
  });
});
