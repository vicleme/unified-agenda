import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_SETTINGS, createAgenda, createItem, createTag } from '../../src/core';
import { ensureDefaultStatuses, saveSettings } from '../../src/storage';
import { en } from '../../src/ui/i18n/messages/en';
import { ItemsSection } from '../../src/ui/ItemsSection';
import { LOCALE_STORAGE_KEY } from '../../src/ui/i18n/locale';
import { renderApp, settleApp } from '../helpers';
import { openTestDb } from '../storage/helpers';

async function dbWithAgenda(name = 'College') {
  const db = openTestDb();
  const agenda = createAgenda({ name, color: '#3b5bdb' });
  await db.agendas.put(agenda);
  await saveSettings(db, { ...DEFAULT_SETTINGS, displayTimeZone: 'America/Sao_Paulo' });
  // The starting statuses, created before the screen opens, so the provider does not repeat them
  await ensureDefaultStatuses(db, (key) => en.defaults[key]);
  return { db, agenda };
}

/** The starting statuses are created in English by the provider on the first open. */
async function waitForStatuses(db: ReturnType<typeof openTestDb>) {
  await waitFor(async () => expect(await db.statuses.count()).toBeGreaterThan(0));
  const statuses = await db.statuses.toArray();
  const groups = await db.statusGroups.toArray();
  return { statuses, groups };
}

async function anyStatus(db: ReturnType<typeof openTestDb>) {
  const { statuses, groups } = await waitForStatuses(db);
  const planned = groups.find((group) => group.role === 'planned')!;
  return statuses
    .filter((status) => status.groupId === planned.id)
    .sort((a, b) => a.order - b.order)[0]!;
}

async function anyStatusName(db: ReturnType<typeof openTestDb>) {
  return (await anyStatus(db)).name;
}

async function doneStatus(db: ReturnType<typeof openTestDb>) {
  const { statuses, groups } = await waitForStatuses(db);
  const done = groups.find((group) => group.role === 'done')!;
  return statuses.find((status) => status.groupId === done.id)!;
}

describe('ItemsSection', () => {
  it('asks for an agenda first when there is none', async () => {
    const db = openTestDb();
    renderApp(<ItemsSection />, db);
    expect(await screen.findByText(/Create an agenda first/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New event' })).not.toBeInTheDocument();
    await settleApp(db);
  });

  it('shows the empty state of the chosen agenda', async () => {
    const { db } = await dbWithAgenda();
    renderApp(<ItemsSection />, db);
    expect(await screen.findByText('No items in this agenda yet.')).toBeInTheDocument();
  });

  it('creates a timed event on the display time zone, with place, notes and a link', async () => {
    const user = userEvent.setup();
    const { db, agenda } = await dbWithAgenda();
    renderApp(<ItemsSection />, db);

    await user.click(await screen.findByRole('button', { name: 'New event' }));
    await user.type(screen.getByLabelText('Title'), '  Statistics class  ');
    await user.click(screen.getByRole('radio', { name: 'At a time' }));
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-11-10' } });
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '14:00' } });
    fireEvent.change(screen.getByLabelText('End time (optional)'), { target: { value: '16:00' } });
    await user.type(screen.getByLabelText('Location'), 'Room 2');
    await user.type(screen.getByLabelText('Notes'), 'Bring the calculator');
    await user.click(screen.getByRole('button', { name: 'Add link' }));
    await user.type(screen.getByLabelText('Link 1 name'), 'Portal');
    await user.type(screen.getByLabelText('Link 1 address'), 'https://example.com');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Statistics class')).toBeInTheDocument();
    const saved = await db.items.toArray();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      kind: 'event',
      title: 'Statistics class',
      agendaId: agenda.id,
      parentId: null,
      order: 0,
      location: 'Room 2',
      notes: 'Bring the calculator',
      links: [{ label: 'Portal', url: 'https://example.com' }],
      schedule: {
        allDay: false,
        start: '2026-11-10T17:00:00.000Z',
        end: '2026-11-10T19:00:00.000Z',
      },
    });
    expect(screen.getByText(/Event/)).toHaveTextContent('Room 2');
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('creates a whole-day event and an event with no date', async () => {
    const user = userEvent.setup();
    const { db } = await dbWithAgenda();
    renderApp(<ItemsSection />, db);

    await user.click(await screen.findByRole('button', { name: 'New event' }));
    await user.type(screen.getByLabelText('Title'), 'Holiday');
    await user.click(screen.getByRole('radio', { name: 'All day' }));
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-11-15' } });
    expect(screen.queryByLabelText('Start time')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Holiday')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'New event' }));
    await user.type(screen.getByLabelText('Title'), 'Idea');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Idea')).toBeInTheDocument();

    const saved = await db.items.toArray();
    const holiday = saved.find((item) => item.title === 'Holiday');
    const idea = saved.find((item) => item.title === 'Idea');
    expect(holiday?.schedule).toEqual({ allDay: true, start: '2026-11-15' });
    expect(holiday?.order).toBe(0);
    expect(idea?.schedule).toBeNull();
    expect(idea?.order).toBe(1);
    expect(screen.getByText(/No date/)).toBeInTheDocument();
  });

  it('shows a message on each field and saves nothing while there are problems', async () => {
    const user = userEvent.setup();
    const { db } = await dbWithAgenda();
    renderApp(<ItemsSection />, db);

    await user.click(await screen.findByRole('button', { name: 'New event' }));
    await user.click(screen.getByRole('radio', { name: 'At a time' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Enter a title.')).toBeInTheDocument();
    expect(screen.getByText('Choose the start date.')).toBeInTheDocument();
    expect(await db.items.count()).toBe(0);

    await user.type(screen.getByLabelText('Title'), 'Class');
    expect(screen.queryByText('Enter a title.')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-11-10' } });
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '14:00' } });
    fireEvent.change(screen.getByLabelText('End time (optional)'), { target: { value: '13:00' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('The end cannot come before the start.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Time zone (optional)'));
    await user.type(screen.getByLabelText('Time zone (optional)'), 'Mars/Base');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText(/This time zone is not valid/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add link' }));
    await user.type(screen.getByLabelText('Link 1 address'), 'example.com');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText(/full address starting with http/)).toBeInTheDocument();
    expect(await db.items.count()).toBe(0);
  });

  it('edits an event: the form opens with its values and the change is saved', async () => {
    const user = userEvent.setup();
    const { db, agenda } = await dbWithAgenda();
    const event = createItem({
      kind: 'event',
      title: 'Clas',
      agendaId: agenda.id,
      location: 'Room 1',
      schedule: {
        allDay: false,
        start: '2026-11-10T17:00:00.000Z',
        end: '2026-11-10T19:00:00.000Z',
      },
    });
    await db.items.put(event);
    renderApp(<ItemsSection />, db);

    await user.click(await screen.findByRole('button', { name: 'Edit Clas' }));
    expect(screen.getByLabelText('Title')).toHaveValue('Clas');
    expect(screen.getByRole('radio', { name: 'At a time' })).toBeChecked();
    expect(screen.getByLabelText('Start date')).toHaveValue('2026-11-10');
    expect(screen.getByLabelText('Start time')).toHaveValue('14:00');
    expect(screen.getByLabelText('End time (optional)')).toHaveValue('16:00');
    expect(screen.getByLabelText('Location')).toHaveValue('Room 1');

    await user.type(screen.getByLabelText('Title'), 's');
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '15:00' } });
    fireEvent.change(screen.getByLabelText('End time (optional)'), { target: { value: '17:00' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Class')).toBeInTheDocument();
    const saved = await db.items.get(event.id);
    expect(saved).toMatchObject({
      title: 'Class',
      createdAt: event.createdAt,
      schedule: { start: '2026-11-10T18:00:00.000Z', end: '2026-11-10T20:00:00.000Z' },
    });
    expect(await db.items.count()).toBe(1);
  });

  it('can turn a dated event into one with no date', async () => {
    const user = userEvent.setup();
    const { db, agenda } = await dbWithAgenda();
    const event = createItem({
      kind: 'event',
      title: 'Trip',
      agendaId: agenda.id,
      schedule: { allDay: true, start: '2026-12-01' },
    });
    await db.items.put(event);
    renderApp(<ItemsSection />, db);

    await user.click(await screen.findByRole('button', { name: 'Edit Trip' }));
    await user.click(screen.getByRole('radio', { name: 'No date' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => expect((await db.items.get(event.id))?.schedule).toBeNull());
  });

  it('says how many items go away and only deletes after the confirmation', async () => {
    const user = userEvent.setup();
    const { db, agenda } = await dbWithAgenda();
    const parent = createItem({ kind: 'event', title: 'Congress', agendaId: agenda.id });
    const child = createItem({
      kind: 'event',
      title: 'Talk',
      agendaId: agenda.id,
      parentId: parent.id,
    });
    const other = createItem({ kind: 'event', title: 'Lunch', agendaId: agenda.id, order: 1 });
    await db.items.bulkPut([parent, child, other]);
    renderApp(<ItemsSection />, db);

    // Only the top level is listed in this step
    expect(await screen.findByText('Congress')).toBeInTheDocument();
    expect(screen.queryByText('Talk')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete Congress' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Delete "Congress"? 2 items in total will be deleted');

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect((await db.items.get(parent.id))?.deletedAt).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Delete Congress' }));
    await user.click(await screen.findByRole('button', { name: 'Delete item' }));

    await waitFor(() => expect(screen.queryByText('Congress')).not.toBeInTheDocument());
    expect((await db.items.get(parent.id))?.deletedAt).not.toBeNull();
    expect((await db.items.get(child.id))?.deletedAt).not.toBeNull();
    expect((await db.items.get(other.id))?.deletedAt).toBeNull();
    expect(screen.getByText('Lunch')).toBeInTheDocument();
  });

  it('asks plainly when deleting a single item', async () => {
    const user = userEvent.setup();
    const { db, agenda } = await dbWithAgenda();
    await db.items.put(createItem({ kind: 'event', title: 'Lunch', agendaId: agenda.id }));
    renderApp(<ItemsSection />, db);

    await user.click(await screen.findByRole('button', { name: 'Delete Lunch' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Delete "Lunch"?');
    expect(screen.getByRole('alertdialog')).not.toHaveTextContent('items in total');
  });

  it('lists the items of the chosen agenda only', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    const first = createAgenda({ name: 'College', color: '#3b5bdb' });
    const second = createAgenda({ name: 'Home', color: '#2f9e44', order: 1 });
    await db.agendas.bulkPut([first, second]);
    await db.items.bulkPut([
      createItem({ kind: 'event', title: 'Exam', agendaId: first.id }),
      createItem({ kind: 'event', title: 'Laundry', agendaId: second.id }),
    ]);
    renderApp(<ItemsSection />, db);

    expect(await screen.findByText('Exam')).toBeInTheDocument();
    expect(screen.queryByText('Laundry')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Agenda'), 'Home');
    expect(await screen.findByText('Laundry')).toBeInTheDocument();
    expect(screen.queryByText('Exam')).not.toBeInTheDocument();
  });

  it('lists a task with its status and delivery, and lets it be edited', async () => {
    const user = userEvent.setup();
    const { db, agenda } = await dbWithAgenda();
    const status = await anyStatus(db);
    await db.items.put(
      createItem({
        kind: 'task',
        title: 'Paper',
        agendaId: agenda.id,
        statusId: status.id,
        from: '2026-11-03',
        due: { allDay: true, date: '2026-11-24' },
      }),
    );
    renderApp(<ItemsSection />, db);

    expect(await screen.findByText('Paper')).toBeInTheDocument();
    expect(screen.getByText(/Task/)).toHaveTextContent(`${status.name}`);
    expect(screen.getByText(/Task/)).toHaveTextContent('from Nov 3, 2026');
    expect(screen.getByText(/Task/)).toHaveTextContent('Due Nov 24, 2026');

    await user.click(screen.getByRole('button', { name: 'Edit Paper' }));
    expect(screen.getByLabelText('Title')).toHaveValue('Paper');
    expect(screen.getByRole('radio', { name: 'On a day' })).toBeChecked();
    expect(screen.getByLabelText('Due date')).toHaveValue('2026-11-24');
    expect(screen.getByLabelText('Start day (optional)')).toHaveValue('2026-11-03');
  });

  it('creates a task with a start day and a timed delivery on the display clock', async () => {
    const user = userEvent.setup();
    const { db, agenda } = await dbWithAgenda();
    renderApp(<ItemsSection />, db);

    await user.click(await screen.findByRole('button', { name: 'New task' }));
    // The first planned status is already chosen
    await waitFor(() => expect(screen.getByLabelText('Status')).not.toHaveValue(''));
    await user.type(screen.getByLabelText('Title'), 'Final paper');
    await user.click(screen.getByRole('radio', { name: 'At a time' }));
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-11-24' } });
    fireEvent.change(screen.getByLabelText('Due time'), { target: { value: '23:59' } });
    fireEvent.change(screen.getByLabelText('Start day (optional)'), {
      target: { value: '2026-11-03' },
    });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Final paper')).toBeInTheDocument();
    const saved = await db.items.toArray();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      kind: 'task',
      title: 'Final paper',
      agendaId: agenda.id,
      parentId: null,
      from: '2026-11-03',
      due: { allDay: false, at: '2026-11-25T02:59:00.000Z' },
      schedule: null,
    });
    expect(saved[0]!.statusId).not.toBeNull();
  });

  it('shows a message on each task field and saves nothing while there are problems', async () => {
    const user = userEvent.setup();
    const { db } = await dbWithAgenda();
    renderApp(<ItemsSection />, db);

    await user.click(await screen.findByRole('button', { name: 'New task' }));
    await waitFor(() => expect(screen.getByLabelText('Status')).not.toHaveValue(''));
    await user.selectOptions(screen.getByLabelText('Status'), '');
    fireEvent.change(screen.getByLabelText('Start day (optional)'), {
      target: { value: '2026-11-03' },
    });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Enter a title.')).toBeInTheDocument();
    expect(screen.getByText('Choose a status for the task.')).toBeInTheDocument();
    expect(screen.getByText('Add a due date to use a start day.')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'On a day' }));
    await user.type(screen.getByLabelText('Title'), 'Paper');
    await user.selectOptions(screen.getByLabelText('Status'), await anyStatusName(db));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Choose the due date.')).toBeInTheDocument();
    expect(await db.items.count()).toBe(0);
  });

  it('adds a subtask inside a task, folded until opened, and shows the progress', async () => {
    const user = userEvent.setup();
    const { db, agenda } = await dbWithAgenda();
    const todo = await anyStatus(db);
    const done = await doneStatus(db);
    const parent = createItem({
      kind: 'task',
      title: 'Project',
      agendaId: agenda.id,
      statusId: todo.id,
    });
    const first = createItem({
      kind: 'task',
      title: 'Write intro',
      agendaId: agenda.id,
      parentId: parent.id,
      statusId: done.id,
    });
    const second = createItem({
      kind: 'task',
      title: 'Write end',
      agendaId: agenda.id,
      parentId: parent.id,
      statusId: todo.id,
      order: 1,
    });
    await db.items.bulkPut([parent, first, second]);
    renderApp(<ItemsSection />, db);

    expect(await screen.findByText('Project')).toBeInTheDocument();
    expect(screen.getByText('Progress: 1 of 2 (50%)')).toBeInTheDocument();
    // Folded: the sub-items are not drawn
    expect(screen.queryByText('Write intro')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show what is inside Project' }));
    expect(screen.getByText('Write intro')).toBeInTheDocument();
    expect(screen.getByText('Write end')).toBeInTheDocument();
    // A leaf task has no progress line of its own
    expect(screen.getAllByText(/^Progress:/)).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Add subtask to Project' }));
    expect(screen.getByText('Inside "Project"')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Status')).not.toHaveValue(''));
    await user.type(screen.getByLabelText('Title'), 'Review');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Review')).toBeInTheDocument();
    const saved = (await db.items.toArray()).find((item) => item.title === 'Review');
    expect(saved).toMatchObject({ kind: 'task', parentId: parent.id, order: 2 });
    expect(await screen.findByText('Progress: 1 of 3 (33%)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide what is inside Project' }));
    expect(screen.queryByText('Review')).not.toBeInTheDocument();
  });

  it('adds a work block inside a task, starting as a timed event', async () => {
    const user = userEvent.setup();
    const { db, agenda } = await dbWithAgenda();
    const status = await anyStatus(db);
    const task = createItem({
      kind: 'task',
      title: 'Paper',
      agendaId: agenda.id,
      statusId: status.id,
    });
    await db.items.put(task);
    renderApp(<ItemsSection />, db);

    await user.click(await screen.findByRole('button', { name: 'Add work block to Paper' }));
    expect(screen.getByRole('form', { name: 'New work block' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'At a time' })).toBeChecked();
    await user.type(screen.getByLabelText('Title'), 'Writing time');
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-11-10' } });
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '14:00' } });
    fireEvent.change(screen.getByLabelText('End time (optional)'), { target: { value: '16:00' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Writing time')).toBeInTheDocument();
    const block = (await db.items.toArray()).find((item) => item.title === 'Writing time');
    expect(block).toMatchObject({
      kind: 'event',
      parentId: task.id,
      schedule: { allDay: false, start: '2026-11-10T17:00:00.000Z' },
    });
    // Events never count in the progress of the task
    expect(screen.queryByText(/^Progress:/)).not.toBeInTheDocument();
  });

  it('moves an item inside another and back to the top level', async () => {
    const user = userEvent.setup();
    const { db, agenda } = await dbWithAgenda();
    const status = await anyStatus(db);
    const project = createItem({
      kind: 'task',
      title: 'Project',
      agendaId: agenda.id,
      statusId: status.id,
    });
    const note = createItem({
      kind: 'task',
      title: 'Loose task',
      agendaId: agenda.id,
      statusId: status.id,
      order: 1,
    });
    await db.items.bulkPut([project, note]);
    renderApp(<ItemsSection />, db);

    await user.click(await screen.findByRole('button', { name: 'Move Loose task' }));
    const target = screen.getByLabelText('New place');
    expect(screen.getByRole('button', { name: 'Move' })).toBeDisabled();
    // The item itself is not offered as a place
    expect(within(target).queryByRole('option', { name: 'Loose task' })).not.toBeInTheDocument();
    await user.selectOptions(target, 'Project');
    await user.click(screen.getByRole('button', { name: 'Move' }));

    await waitFor(async () => expect((await db.items.get(note.id))?.parentId).toBe(project.id));
    // The new parent opens by itself, so the moved item is not hidden in a fold
    expect(
      await screen.findByRole('button', { name: 'Hide what is inside Project' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Loose task')).toBeInTheDocument();
    expect(screen.queryByLabelText('New place')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Move Loose task' }));
    await user.selectOptions(screen.getByLabelText('New place'), 'Top level of this agenda');
    await user.click(screen.getByRole('button', { name: 'Move' }));
    await waitFor(async () => expect((await db.items.get(note.id))?.parentId).toBeNull());
    // Back at the top level, so the project has nothing inside it anymore
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Hide what is inside Project' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('does not offer an item or what is inside it as a new place', async () => {
    const user = userEvent.setup();
    const { db, agenda } = await dbWithAgenda();
    const status = await anyStatus(db);
    const top = createItem({
      kind: 'task',
      title: 'Top',
      agendaId: agenda.id,
      statusId: status.id,
    });
    const mid = createItem({
      kind: 'task',
      title: 'Middle',
      agendaId: agenda.id,
      statusId: status.id,
      parentId: top.id,
    });
    const deep = createItem({
      kind: 'task',
      title: 'Deep',
      agendaId: agenda.id,
      statusId: status.id,
      parentId: mid.id,
    });
    const other = createItem({
      kind: 'task',
      title: 'Other',
      agendaId: agenda.id,
      statusId: status.id,
      order: 1,
    });
    await db.items.bulkPut([top, mid, deep, other]);
    renderApp(<ItemsSection />, db);

    await user.click(await screen.findByRole('button', { name: 'Move Top' }));
    const target = screen.getByLabelText('New place');
    const names = within(target)
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(names).toEqual(['Top level of this agenda', 'Other']);
  });

  it('lets a task from another agenda stay out of the list', async () => {
    const db = openTestDb();
    const first = createAgenda({ name: 'College', color: '#3b5bdb' });
    const second = createAgenda({ name: 'Home', color: '#2f9e44', order: 1 });
    await db.agendas.bulkPut([first, second]);
    await db.items.bulkPut([
      createItem({ kind: 'task', title: 'Essay', agendaId: first.id, statusId: 'x' }),
      createItem({ kind: 'task', title: 'Dishes', agendaId: second.id, statusId: 'x' }),
    ]);
    renderApp(<ItemsSection />, db);
    expect(await screen.findByText('Essay')).toBeInTheDocument();
    expect(screen.queryByText('Dishes')).not.toBeInTheDocument();
  });

  it('works in Portuguese', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'pt-BR');
    const user = userEvent.setup();
    const { db, agenda } = await dbWithAgenda('Faculdade');
    await db.items.put(
      createItem({
        kind: 'event',
        title: 'Prova',
        agendaId: agenda.id,
        schedule: { allDay: true, start: '2026-11-12', end: '2026-11-13' },
      }),
    );
    renderApp(<ItemsSection />, db);

    expect(await screen.findByText('Prova')).toBeInTheDocument();
    expect(screen.getByText(/dia inteiro/)).toBeInTheDocument();
    expect(screen.getByText(/até/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Novo evento' }));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByText('Digite um título.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Com horário' })).toBeInTheDocument();
  });

  it('works in Portuguese for tasks', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'pt-BR');
    const user = userEvent.setup();
    const { db, agenda } = await dbWithAgenda('Faculdade');
    const status = await anyStatus(db);
    await db.items.put(
      createItem({
        kind: 'task',
        title: 'Trabalho',
        agendaId: agenda.id,
        statusId: status.id,
        due: { allDay: true, date: '2026-11-24' },
      }),
    );
    renderApp(<ItemsSection />, db);

    expect(await screen.findByText('Trabalho')).toBeInTheDocument();
    expect(screen.getByText(/Tarefa/)).toHaveTextContent('Entrega');
    await user.click(screen.getByRole('button', { name: 'Nova tarefa' }));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByText('Digite um título.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Sem entrega' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Mover Trabalho' })).toBeInTheDocument();
  });
});

describe('ItemsSection: tags', () => {
  async function setup() {
    const { db, agenda } = await dbWithAgenda();
    const other = createAgenda({ name: 'Home', color: '#2f9e44', order: 1 });
    await db.agendas.put(other);
    const stats = createTag({ name: 'Statistics', color: '#3b5bdb' });
    const exams = createTag({ name: 'Exams', color: '#e03131', agendaIds: [agenda.id] });
    const chores = createTag({ name: 'Chores', color: '#2f9e44', agendaIds: [other.id] });
    await db.tags.bulkPut([stats, exams, chores]);
    const status = await anyStatus(db);
    return { db, agenda, other, stats, exams, chores, status };
  }

  it('offers only the tags valid in the agenda and saves the chosen ones on a new task', async () => {
    const user = userEvent.setup();
    const { db, stats } = await setup();
    renderApp(<ItemsSection />, db);

    await user.click(await screen.findByRole('button', { name: 'New task' }));
    expect(screen.getByRole('checkbox', { name: 'Statistics' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Exams' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Chores' })).not.toBeInTheDocument();
    // A top-level item has nothing to inherit from
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Title'), 'Paper');
    await user.click(screen.getByRole('checkbox', { name: 'Statistics' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => expect(await db.items.count()).toBe(1));
    expect((await db.items.toArray())[0]).toMatchObject({ tagIds: [stats.id], inheritTags: true });
    expect(await screen.findByText('Statistics')).toBeInTheDocument();
  });

  it('shows the inheritance switch on a sub-item, with the inherited tags and where from', async () => {
    const user = userEvent.setup();
    const { db, agenda, stats, status } = await setup();
    const parent = createItem({
      kind: 'task',
      title: 'Report',
      agendaId: agenda.id,
      statusId: status.id,
      tagIds: [stats.id],
    });
    await db.items.put(parent);
    renderApp(<ItemsSection />, db);

    await user.click(await screen.findByRole('button', { name: 'Add work block to Report' }));
    const sw = screen.getByRole('switch', { name: 'Inherit the tags of "Report"' });
    expect(sw).toBeChecked();
    expect(screen.getByText('Statistics (from Report)')).toBeInTheDocument();

    await user.click(sw);
    expect(screen.queryByText('Statistics (from Report)')).not.toBeInTheDocument();
  });

  it('saves a block with the switch off, and its row does not show the parent tag', async () => {
    const user = userEvent.setup();
    const { db, agenda, stats, status } = await setup();
    const parent = createItem({
      kind: 'task',
      title: 'Report',
      agendaId: agenda.id,
      statusId: status.id,
      tagIds: [stats.id],
    });
    await db.items.put(parent);
    renderApp(<ItemsSection />, db);

    await user.click(await screen.findByRole('button', { name: 'Add work block to Report' }));
    await user.type(screen.getByLabelText('Title'), 'Study');
    await user.type(screen.getByLabelText('Start date'), '2026-11-09');
    await user.type(screen.getByLabelText('Start time'), '09:00');
    await user.click(screen.getByRole('switch'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => expect(await db.items.count()).toBe(2));
    const block = (await db.items.toArray()).find((item) => item.title === 'Study');
    expect(block).toMatchObject({ parentId: parent.id, inheritTags: false, tagIds: [] });
  });

  it('shows an inherited tag dimmed on the row of an open sub-item', async () => {
    const user = userEvent.setup();
    const { db, agenda, stats, status } = await setup();
    const parent = createItem({
      kind: 'task',
      title: 'Report',
      agendaId: agenda.id,
      statusId: status.id,
      tagIds: [stats.id],
    });
    const child = createItem({
      kind: 'task',
      title: 'Buy ink',
      agendaId: agenda.id,
      statusId: status.id,
      parentId: parent.id,
    });
    await db.items.bulkPut([parent, child]);
    renderApp(<ItemsSection />, db);

    await user.click(await screen.findByRole('button', { name: 'Show what is inside Report' }));
    const row = (await screen.findByText('Buy ink')).closest('.list__row') as HTMLElement;
    expect(within(row).getByText('Statistics (from Report)')).toHaveClass('chip--inherited');
    expect(within(row).getByText('Statistics (from Report)')).toBeInTheDocument();
  });

  it('keeps a tag that is no longer valid in the agenda visible so it can be removed', async () => {
    const user = userEvent.setup();
    const { db, agenda, chores, status } = await setup();
    const item = createItem({
      kind: 'task',
      title: 'Odd',
      agendaId: agenda.id,
      statusId: status.id,
      tagIds: [chores.id],
    });
    await db.items.put(item);
    renderApp(<ItemsSection />, db);

    await user.click(await screen.findByRole('button', { name: 'Edit Odd' }));
    const box = screen.getByRole('checkbox', { name: /Chores/ });
    expect(box).toBeChecked();
    expect(screen.getByText('(not valid in this agenda)')).toBeInTheDocument();
    await user.click(box);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await db.items.get(item.id))?.tagIds).toEqual([]));
  });
});
