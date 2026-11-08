import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createAgenda, createItem } from '../../src/core';
import { exportBackup, serializeBackup } from '../../src/storage';
import { BackupSection } from '../../src/ui/BackupSection';
import { readFileText } from '../../src/ui/backupValues';
import { renderApp } from '../helpers';
import { fill, openTestDb, sampleData } from '../storage/helpers';

/** The text of a backup made from a database that holds the sample data. */
async function sampleBackupText() {
  const source = openTestDb();
  await fill(source, sampleData());
  return serializeBackup(await exportBackup(source, { now: () => '2026-11-07T12:00:00.000Z' }));
}

function chooseFile(text: string, name = 'backup.json') {
  const input = screen.getByLabelText('Backup file');
  return userEvent.setup().upload(input, new File([text], name, { type: 'application/json' }));
}

describe('BackupSection export', () => {
  it('downloads one file named after the day, with all the data', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    await fill(db, sampleData());

    const blobs: Blob[] = [];
    URL.createObjectURL = (blob: Blob | MediaSource) => {
      blobs.push(blob as Blob);
      return 'blob:test';
    };
    URL.revokeObjectURL = () => undefined;
    const names: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });

    renderApp(<BackupSection />, db);
    await user.click(screen.getByRole('button', { name: 'Download backup' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      /^Backup saved as unified-agenda-\d{4}-\d{2}-\d{2}\.json\.$/,
    );
    expect(names).toHaveLength(1);
    expect(names[0]).toMatch(/^unified-agenda-\d{4}-\d{2}-\d{2}\.json$/);
    expect(blobs).toHaveLength(1);
    const file = JSON.parse(await readFileText(blobs[0]!));
    expect(file.format).toBe('unified-agenda-backup');
    expect(file.data.items).toHaveLength(2);
    click.mockRestore();
  });
});

describe('BackupSection import', () => {
  it('lists each problem of a bad file and changes nothing', async () => {
    const db = openTestDb();
    renderApp(<BackupSection />, db);

    await chooseFile('this is not json', 'bad.json');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('"bad.json" cannot be imported. Nothing was changed.');
    expect(alert).toHaveTextContent('This is not a JSON file.');
    expect(screen.queryByRole('button', { name: 'Import' })).not.toBeInTheDocument();
    expect(await db.agendas.count()).toBe(0);
  });

  it('shows the path of a wrong field', async () => {
    const db = openTestDb();
    const file = JSON.parse(await sampleBackupText());
    file.data.items[0].title = 42;
    renderApp(<BackupSection />, db);

    await chooseFile(JSON.stringify(file));

    expect(await screen.findByRole('alert')).toHaveTextContent('data.items[0].title');
  });

  it('cuts a long list of problems and says how many are left', async () => {
    const db = openTestDb();
    const file = JSON.parse(await sampleBackupText());
    file.data.items = Array.from({ length: 30 }, () => ({ nothing: true }));
    renderApp(<BackupSection />, db);

    await chooseFile(JSON.stringify(file));

    const alert = await screen.findByRole('alert');
    expect(alert.querySelectorAll('li')).toHaveLength(20);
    expect(alert.textContent).toMatch(/more problems are not shown/);
  });

  it('suggests replacing on an empty app and imports without asking again', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    const text = await sampleBackupText();
    renderApp(<BackupSection />, db);

    await chooseFile(text);

    expect(await screen.findByRole('radio', { name: 'Replace' })).toBeChecked();
    expect(screen.getByText(/replacing is suggested/)).toBeInTheDocument();
    expect(screen.getByText(/1 agenda, 2 items/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Import' }));

    expect(
      await screen.findByText(/Import finished\. Added: \d+\. Updated: 0\. Unchanged: 0\./),
    ).toBeInTheDocument();
    expect(await db.agendas.count()).toBe(1);
    expect(await db.items.count()).toBe(2);
  });

  it('merges by default when the app already has data, keeping what is there', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    const local = createAgenda({ name: 'Home', color: '#e03131' });
    await db.agendas.put(local);
    const text = await sampleBackupText();
    renderApp(<BackupSection />, db);

    await chooseFile(text);

    expect(await screen.findByRole('radio', { name: 'Merge' })).toBeChecked();
    expect(screen.queryByText(/replacing is suggested/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Import' }));

    expect(await screen.findByText(/Import finished/)).toBeInTheDocument();
    expect(await db.agendas.count()).toBe(2);
    expect(await db.agendas.get(local.id)).toBeDefined();
  });

  it('asks before replacing a device that has data, and cancel changes nothing', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    const local = createAgenda({ name: 'Home', color: '#e03131' });
    await db.agendas.put(local);
    await db.items.put(createItem({ kind: 'event', title: 'Mine', agendaId: local.id }));
    const text = await sampleBackupText();
    renderApp(<BackupSection />, db);

    await chooseFile(text);
    await user.click(await screen.findByRole('radio', { name: 'Replace' }));
    await user.click(screen.getByRole('button', { name: 'Import' }));

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Replace everything on this device');
    expect(await db.agendas.count()).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await db.agendas.get(local.id)).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Import' }));
    await user.click(screen.getByRole('button', { name: 'Replace everything' }));

    expect(await screen.findByText(/Import finished/)).toBeInTheDocument();
    expect(await db.agendas.get(local.id)).toBeUndefined();
    expect(await db.agendas.count()).toBe(1);
  });

  it('refuses a replace whose file points outside itself and says where', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    const file = JSON.parse(await sampleBackupText());
    file.data.agendas = [];
    renderApp(<BackupSection />, db);

    await chooseFile(JSON.stringify(file));
    await user.click(await screen.findByRole('button', { name: 'Import' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Nothing was changed.');
    expect(alert).toHaveTextContent('agendaId: This points to something that is not in the file.');
    await waitFor(async () => expect(await db.items.count()).toBe(0));
  });
});
