import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createAgenda, createItem, DEFAULT_SETTINGS } from '../../src/core';
import { loadSettings, saveSettings, SETTINGS_KEY } from '../../src/storage';
import { ItemsSection } from '../../src/ui/ItemsSection';
import { SettingsSection } from '../../src/ui/SettingsSection';
import { renderApp } from '../helpers';
import { openTestDb } from '../storage/helpers';

function setHour(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe('SettingsSection', () => {
  it('starts on automatic with the default hours', async () => {
    const db = openTestDb();
    renderApp(<SettingsSection />, db);

    expect(await screen.findByRole('radio', { name: 'Automatic' })).toBeChecked();
    expect(screen.getByText(/Uses the time zone of this device/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Time zone name')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Morning starts at (hour)')).toHaveValue('6');
    expect(screen.getByLabelText('Afternoon starts at (hour)')).toHaveValue('12');
    expect(screen.getByLabelText('Evening starts at (hour)')).toHaveValue('18');
  });

  it('shows what is already saved', async () => {
    const db = openTestDb();
    await saveSettings(db, {
      displayTimeZone: 'Asia/Tokyo',
      periodBounds: { morningStart: 5, afternoonStart: 13, eveningStart: 19 },
    });
    renderApp(<SettingsSection />, db);

    expect(await screen.findByRole('radio', { name: 'Choose one' })).toBeChecked();
    expect(screen.getByLabelText('Time zone name')).toHaveValue('Asia/Tokyo');
    expect(screen.getByLabelText('Morning starts at (hour)')).toHaveValue('5');
  });

  it('saves a chosen zone and new hours', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    renderApp(<SettingsSection />, db);

    await user.click(await screen.findByRole('radio', { name: 'Choose one' }));
    await user.type(screen.getByLabelText('Time zone name'), 'Asia/Tokyo');
    setHour('Morning starts at (hour)', '7');
    setHour('Evening starts at (hour)', '20');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Settings saved.');
    expect(await loadSettings(db)).toEqual({
      displayTimeZone: 'Asia/Tokyo',
      periodBounds: { morningStart: 7, afternoonStart: 12, eveningStart: 20 },
    });
  });

  it('goes back to automatic', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    await saveSettings(db, { ...DEFAULT_SETTINGS, displayTimeZone: 'Asia/Tokyo' });
    renderApp(<SettingsSection />, db);

    await user.click(await screen.findByRole('radio', { name: 'Automatic' }));
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect((await loadSettings(db)).displayTimeZone).toBe('auto');
  });

  it('refuses a zone that does not exist and saves nothing', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    renderApp(<SettingsSection />, db);

    await user.click(await screen.findByRole('radio', { name: 'Choose one' }));
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a time zone name.');

    await user.type(screen.getByLabelText('Time zone name'), 'Mars/Olympus');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(screen.getByRole('alert')).toHaveTextContent('This time zone is not valid.');
    expect(screen.getByLabelText('Time zone name')).toHaveAttribute('aria-invalid', 'true');
    expect(await db.meta.get(SETTINGS_KEY)).toBeUndefined();
  });

  it('refuses an hour that is not a whole number from 1 to 23', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    renderApp(<SettingsSection />, db);
    await screen.findByLabelText('Morning starts at (hour)');

    setHour('Morning starts at (hour)', '');
    setHour('Afternoon starts at (hour)', '24');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(2);
    alerts.forEach((alert) => expect(alert).toHaveTextContent('Enter a whole hour from 1 to 23.'));
    expect(await db.meta.get(SETTINGS_KEY)).toBeUndefined();
  });

  it('refuses hours that are out of order', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    renderApp(<SettingsSection />, db);
    await screen.findByLabelText('Morning starts at (hour)');

    setHour('Afternoon starts at (hour)', '5');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Each period must start later');
    expect(await db.meta.get(SETTINGS_KEY)).toBeUndefined();

    setHour('Afternoon starts at (hour)', '13');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByRole('status')).toBeInTheDocument();
  });

  it('changes the times shown in the item lists when the zone changes', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    await saveSettings(db, { ...DEFAULT_SETTINGS, displayTimeZone: 'America/Sao_Paulo' });
    const agenda = createAgenda({ name: 'College', color: '#3b5bdb' });
    await db.agendas.put(agenda);
    await db.items.put(
      createItem({
        kind: 'event',
        title: 'Class',
        agendaId: agenda.id,
        schedule: { allDay: false, start: '2026-11-10T17:00:00.000Z' },
      }),
    );
    renderApp(
      <>
        <SettingsSection />
        <ItemsSection />
      </>,
      db,
    );

    expect(await screen.findByText(/2:00\s?PM/)).toBeInTheDocument();

    const form = screen.getByRole('form', { name: 'Settings' });
    await user.click(within(form).getByRole('radio', { name: 'Choose one' }));
    await user.type(within(form).getByLabelText('Time zone name'), 'x');
    await user.clear(within(form).getByLabelText('Time zone name'));
    await user.type(within(form).getByLabelText('Time zone name'), 'Asia/Tokyo');
    await user.click(within(form).getByRole('button', { name: 'Save settings' }));

    expect(await screen.findByText(/2:00\s?AM/)).toBeInTheDocument();
    expect(screen.queryByText(/2:00\s?PM/)).not.toBeInTheDocument();
  });
});
