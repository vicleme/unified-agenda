import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createAgenda } from '../../src/core';
import { renderApp } from '../helpers';
import { openTestDb } from '../storage/helpers';
import { AppShell } from '../../src/ui/AppShell';
import { LOCALE_STORAGE_KEY } from '../../src/ui/i18n/locale';
import { THEME_STORAGE_KEY } from '../../src/ui/theme';

describe('AppShell', () => {
  it('starts on the timeline and switches views by tap', async () => {
    const user = userEvent.setup();
    renderApp(<AppShell />, openTestDb());

    expect(screen.getByRole('tab', { name: 'Timeline' })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('tab', { name: 'Kanban' }));
    expect(screen.getByRole('tab', { name: 'Kanban' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent(/Kanban board/);
  });

  it('changes and remembers the theme', async () => {
    const user = userEvent.setup();
    renderApp(<AppShell />, openTestDb());

    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    await user.click(screen.getByRole('radio', { name: 'Auto' }));
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('restores the stored theme on load', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    renderApp(<AppShell />, openTestDb());
    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('AppShell language', () => {
  it('follows the browser language in auto mode', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['pt-BR', 'en']);
    renderApp(<AppShell />, openTestDb());

    expect(screen.getByRole('tab', { name: 'Linha do Tempo' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('pt-BR');
    vi.restoreAllMocks();
  });

  it('switches the whole interface and remembers the choice', async () => {
    const user = userEvent.setup();
    renderApp(<AppShell />, openTestDb());
    expect(screen.getByRole('tab', { name: 'Calendar' })).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'pt-BR');

    expect(screen.getByRole('tab', { name: 'Calendário' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Escuro' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Idioma' })).toHaveValue('pt-BR');
    expect(document.documentElement.lang).toBe('pt-BR');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('pt-BR');
  });

  it('keeps each language named in its own language', async () => {
    renderApp(<AppShell />, openTestDb());
    expect(screen.getByRole('option', { name: 'Português' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument();
  });
});

describe('AppShell manage area', () => {
  it('opens the manage area, shows live counts and goes back to the views', async () => {
    const user = userEvent.setup();
    const db = openTestDb();
    await db.agendas.put(createAgenda({ name: 'College', color: '#3b5bdb' }));
    renderApp(<AppShell />, db);

    await user.click(screen.getByRole('button', { name: 'Manage' }));
    expect(screen.getByRole('button', { name: 'Manage' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('tab', { name: 'Timeline' })).toHaveAttribute('aria-selected', 'false');
    expect(await screen.findByText('1 agenda')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Items' }));
    expect(await screen.findByText('No items')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Kanban' }));
    expect(screen.getByRole('button', { name: 'Manage' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('tabpanel')).toHaveTextContent(/Kanban board/);
  });

  it('shows the counts in Portuguese, with a text of its own for zero', async () => {
    const user = userEvent.setup();
    renderApp(<AppShell />, openTestDb());
    await user.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'pt-BR');

    await user.click(screen.getByRole('button', { name: 'Gerenciar' }));
    expect(await screen.findByText('Nenhuma agenda')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Itens' }));
    expect(await screen.findByText('Nenhum item')).toBeInTheDocument();
  });
});
