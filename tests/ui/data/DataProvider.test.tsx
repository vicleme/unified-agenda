import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createAgenda } from '../../../src/core';
import { useData } from '../../../src/ui/data/useData';
import { useAgendas } from '../../../src/ui/data/useEntityList';
import { renderApp, settleApp } from '../../helpers';
import { openTestDb } from '../../storage/helpers';

function Probe() {
  const { data, loading } = useAgendas();
  const { db, notify } = useData();
  return (
    <div>
      <p data-testid="count">{loading ? 'loading' : data.length}</p>
      <button
        type="button"
        onClick={async () => {
          await db.agendas.put(createAgenda({ name: 'Extra', color: '#000000' }));
          notify();
        }}
      >
        add
      </button>
    </div>
  );
}

describe('DataProvider', () => {
  afterEach(() => vi.restoreAllMocks());

  it('creates the starting Kanban groups in the active language', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['pt-BR']);
    const db = openTestDb();
    renderApp(<div />, db);

    await waitFor(async () => expect(await db.statusGroups.count()).toBe(3));
    const names = (await db.statusGroups.toArray()).map((group) => group.name);
    expect(names).toEqual(expect.arrayContaining(['Planejado', 'Em curso', 'Concluído']));
    expect(await db.statuses.count()).toBe(7);
  });

  it('does not create the groups twice when the language changes', async () => {
    const db = openTestDb();
    renderApp(<div />, db);
    await waitFor(async () => expect(await db.statusGroups.count()).toBe(3));
    expect(await db.statuses.count()).toBe(7);
  });

  it('reads the list again after notify', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    await db.agendas.put(createAgenda({ name: 'First', color: '#3b5bdb' }));
    renderApp(<Probe />, db);

    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));
    await user.click(screen.getByRole('button', { name: 'add' }));
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('2'));
  });

  it('hides deleted agendas from the list', async () => {
    const db = openTestDb();
    const agenda = createAgenda({ name: 'Gone', color: '#3b5bdb' });
    await db.agendas.put({ ...agenda, deletedAt: agenda.createdAt });
    renderApp(<Probe />, db);
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'));
    await settleApp(db);
  });
});
