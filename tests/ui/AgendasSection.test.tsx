import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createAgenda, createItem } from '../../src/core';
import { AgendasSection } from '../../src/ui/AgendasSection';
import { LOCALE_STORAGE_KEY } from '../../src/ui/i18n/locale';
import { renderApp } from '../helpers';
import { openTestDb } from '../storage/helpers';

describe('AgendasSection', () => {
  it('shows the empty state and creates an agenda with a chosen color', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    renderApp(<AgendasSection />, db);
    expect(await screen.findByText(/No agendas yet/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'New agenda' }));
    await user.type(screen.getByLabelText('Name'), '  College  ');
    await user.click(screen.getByRole('radio', { name: 'Red' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('College')).toBeInTheDocument();
    expect(screen.getByText('No items')).toBeInTheDocument();
    const saved = await db.agendas.toArray();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ name: 'College', color: '#e03131', order: 0 });
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('gives each new agenda the next position', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    await db.agendas.put(createAgenda({ name: 'First', color: '#3b5bdb', order: 4 }));
    renderApp(<AgendasSection />, db);

    await user.click(await screen.findByRole('button', { name: 'New agenda' }));
    await user.type(screen.getByLabelText('Name'), 'Second');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => expect(await db.agendas.count()).toBe(2));
    const second = (await db.agendas.toArray()).find((agenda) => agenda.name === 'Second');
    expect(second?.order).toBe(5);
  });

  it('asks for a name and saves nothing without one', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    renderApp(<AgendasSection />, db);

    await user.click(await screen.findByRole('button', { name: 'New agenda' }));
    await user.type(screen.getByLabelText('Name'), '   ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name for the agenda.');
    expect(await db.agendas.count()).toBe(0);

    await user.type(screen.getByLabelText('Name'), 'Home');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('edits the name and the color of an agenda', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    const agenda = createAgenda({ name: 'Colege', color: '#3b5bdb' });
    await db.agendas.put(agenda);
    renderApp(<AgendasSection />, db);

    await user.click(await screen.findByRole('button', { name: 'Edit Colege' }));
    expect(screen.getByLabelText('Name')).toHaveValue('Colege');
    expect(screen.getByRole('radio', { name: 'Blue' })).toHaveAttribute('aria-checked', 'true');

    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'College');
    await user.click(screen.getByRole('radio', { name: 'Green' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('College')).toBeInTheDocument();
    const saved = await db.agendas.get(agenda.id);
    expect(saved).toMatchObject({ name: 'College', color: '#2f9e44' });
    expect(saved!.updatedAt >= agenda.updatedAt).toBe(true);
  });

  it('cancels a form without saving', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    renderApp(<AgendasSection />, db);

    await user.click(await screen.findByRole('button', { name: 'New agenda' }));
    await user.type(screen.getByLabelText('Name'), 'Draft');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(await db.agendas.count()).toBe(0);
  });

  it('says how many items go away, and only deletes after the confirmation', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    const agenda = createAgenda({ name: 'College', color: '#3b5bdb' });
    const parent = createItem({ kind: 'event', title: 'Class', agendaId: agenda.id });
    const child = createItem({
      kind: 'event',
      title: 'Lab',
      agendaId: agenda.id,
      parentId: parent.id,
    });
    await db.agendas.put(agenda);
    await db.items.bulkPut([parent, child]);
    renderApp(<AgendasSection />, db);

    await user.click(await screen.findByRole('button', { name: 'Delete College' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Delete "College"? 2 items in it will be deleted too.');

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect((await db.agendas.get(agenda.id))?.deletedAt).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Delete College' }));
    await user.click(await screen.findByRole('button', { name: 'Delete agenda' }));

    await waitFor(() => expect(screen.queryByText('College')).not.toBeInTheDocument());
    expect((await db.agendas.get(agenda.id))?.deletedAt).not.toBeNull();
    expect((await db.items.get(parent.id))?.deletedAt).not.toBeNull();
    expect((await db.items.get(child.id))?.deletedAt).not.toBeNull();
    expect(await screen.findByText(/No agendas yet/)).toBeInTheDocument();
  });

  it('uses the singular and the zero text in the confirmation', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    const full = createAgenda({ name: 'Full', color: '#3b5bdb' });
    const empty = createAgenda({ name: 'Empty', color: '#3b5bdb', order: 1 });
    await db.agendas.bulkPut([full, empty]);
    await db.items.put(createItem({ kind: 'event', title: 'One', agendaId: full.id }));
    renderApp(<AgendasSection />, db);

    await user.click(await screen.findByRole('button', { name: 'Delete Full' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      'Delete "Full"? 1 item in it will be deleted too.',
    );

    await user.click(screen.getByRole('button', { name: 'Delete Empty' }));
    await waitFor(() =>
      expect(screen.getByRole('alertdialog')).toHaveTextContent(
        'Delete "Empty"? No items will be deleted.',
      ),
    );
  });

  it('works in Portuguese', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'pt-BR');
    const user = userEvent.setup();
    const db = openTestDb();
    await db.agendas.put(createAgenda({ name: 'Faculdade', color: '#3b5bdb' }));
    renderApp(<AgendasSection />, db);

    expect(await screen.findByText('Nenhum item')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Excluir Faculdade' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      'Excluir "Faculdade"? Nenhum item será excluído.',
    );
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.click(screen.getByRole('button', { name: 'Nova agenda' }));
    expect(screen.getByRole('radio', { name: 'Vermelho' })).toBeInTheDocument();
  });
});
