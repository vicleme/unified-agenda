import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createAgenda, createItem, createTag, isActive } from '../../src/core';
import { LOCALE_STORAGE_KEY } from '../../src/ui/i18n/locale';
import { TagsSection } from '../../src/ui/TagsSection';
import { renderApp } from '../helpers';
import { openTestDb } from '../storage/helpers';

async function twoAgendas(db: ReturnType<typeof openTestDb>) {
  const college = createAgenda({ name: 'College', color: '#3b5bdb', order: 0 });
  const home = createAgenda({ name: 'Home', color: '#2f9e44', order: 1 });
  await db.agendas.bulkPut([college, home]);
  return { college, home };
}

describe('TagsSection', () => {
  it('shows the empty state and creates a global tag with a color', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    renderApp(<TagsSection />, db);
    expect(await screen.findByText(/No tags yet/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'New tag' }));
    await user.type(screen.getByLabelText('Name'), '  Statistics ');
    await user.click(screen.getByRole('radio', { name: 'Green' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Statistics')).toBeInTheDocument();
    expect(screen.getByText('All agendas')).toBeInTheDocument();
    const saved = await db.tags.toArray();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      name: 'Statistics',
      color: '#2f9e44',
      parentId: null,
      agendaIds: [],
    });
  });

  it('asks for a name and saves nothing without one', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    renderApp(<TagsSection />, db);
    await user.click(await screen.findByRole('button', { name: 'New tag' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter a name for the tag.')).toBeInTheDocument();
    expect(await db.tags.count()).toBe(0);
  });

  it('restricts a tag to some agendas and shows them in the list', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    const { college } = await twoAgendas(db);
    renderApp(<TagsSection />, db);

    await user.click(await screen.findByRole('button', { name: 'New tag' }));
    await user.type(screen.getByLabelText('Name'), 'Exams');
    await user.click(screen.getByRole('checkbox', { name: 'College' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Only in College')).toBeInTheDocument();
    expect((await db.tags.toArray())[0]?.agendaIds).toEqual([college.id]);
  });

  it('puts a sub-tag under its parent, indented, and limits its agendas to the parent', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    const { college } = await twoAgendas(db);
    const parent = createTag({ name: 'Exams', color: '#3b5bdb', agendaIds: [college.id] });
    await db.tags.put(parent);
    renderApp(<TagsSection />, db);

    await user.click(await screen.findByRole('button', { name: 'New tag' }));
    await user.type(screen.getByLabelText('Name'), 'Finals');
    await user.selectOptions(screen.getByLabelText('Inside tag'), parent.id);
    expect(screen.getByRole('checkbox', { name: 'Home' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'College' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText('Finals');
    const finals = (await db.tags.toArray()).find((tag) => tag.name === 'Finals');
    // Global under a restricted parent: it takes the parent's agendas, and the person is told
    expect(finals).toMatchObject({ parentId: parent.id, agendaIds: [college.id] });
    expect(screen.getByRole('status')).toHaveTextContent('Finals');
  });

  it('narrowing a parent also narrows its children and says so', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    const { college } = await twoAgendas(db);
    const parent = createTag({ name: 'Work', color: '#3b5bdb' });
    const child = createTag({ name: 'Reports', color: '#3b5bdb', parentId: parent.id });
    await db.tags.bulkPut([parent, child]);
    renderApp(<TagsSection />, db);

    await user.click(await screen.findByRole('button', { name: 'Edit Work' }));
    await user.click(screen.getByRole('checkbox', { name: 'College' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => {
      const saved = (await db.tags.toArray()).find((tag) => tag.id === child.id);
      expect(saved?.agendaIds).toEqual([college.id]);
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Reports');
  });

  it('cannot move a tag inside itself or its own sub-tags', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    const parent = createTag({ name: 'Work', color: '#3b5bdb' });
    const child = createTag({ name: 'Reports', color: '#3b5bdb', parentId: parent.id });
    await db.tags.bulkPut([parent, child]);
    renderApp(<TagsSection />, db);

    await user.click(await screen.findByRole('button', { name: 'Edit Work' }));
    const options = screen.getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(['None (top level)']);
  });

  it('offers to make a tag global when it covers every agenda', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    const { college, home } = await twoAgendas(db);
    const tag = createTag({
      name: 'Everywhere',
      color: '#3b5bdb',
      agendaIds: [college.id, home.id],
    });
    await db.tags.put(tag);
    renderApp(<TagsSection />, db);

    await user.click(await screen.findByRole('button', { name: 'Make Everywhere global' }));
    await waitFor(async () => expect((await db.tags.get(tag.id))?.agendaIds).toEqual([]));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Make Everywhere global' })).toBeNull(),
    );
  });

  it('confirms a deletion with the counts, then removes the tag from items', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    const parent = createTag({ name: 'Work', color: '#3b5bdb' });
    const child = createTag({ name: 'Reports', color: '#3b5bdb', parentId: parent.id });
    const item = createItem({
      kind: 'task',
      title: 'Report',
      agendaId: 'a',
      statusId: 's',
      tagIds: [child.id],
    });
    await db.tags.bulkPut([parent, child]);
    await db.items.put(item);
    renderApp(<TagsSection />, db);

    await user.click(await screen.findByRole('button', { name: 'Delete Work' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Delete "Work"? It will be taken off 1 item.');
    expect(dialog).toHaveTextContent('1 sub-tag will be deleted too.');
    await user.click(screen.getByRole('button', { name: 'Delete tag' }));

    await waitFor(async () => expect((await db.tags.toArray()).filter(isActive)).toHaveLength(0));
    expect((await db.items.get(item.id))?.tagIds).toEqual([]);
    expect(await screen.findByText(/No tags yet/)).toBeInTheDocument();
  });

  it('keeps everything when the deletion is cancelled', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    await db.tags.put(createTag({ name: 'Work', color: '#3b5bdb' }));
    renderApp(<TagsSection />, db);
    await user.click(await screen.findByRole('button', { name: 'Delete Work' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('No items carry it.');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect((await db.tags.toArray()).filter(isActive)).toHaveLength(1);
  });

  it('speaks Portuguese', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'pt-BR');
    const db = openTestDb();
    renderApp(<TagsSection />, db);
    expect(await screen.findByRole('button', { name: 'Nova etiqueta' })).toBeInTheDocument();
    expect(await screen.findByText(/Nenhuma etiqueta ainda/)).toBeInTheDocument();
    window.localStorage.removeItem(LOCALE_STORAGE_KEY);
  });
});
