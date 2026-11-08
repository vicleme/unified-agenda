import {
  THEME_STORAGE_KEY,
  applyThemeMode,
  parseThemeMode,
  readStoredThemeMode,
  storeThemeMode,
} from '../../src/ui/theme';

describe('parseThemeMode', () => {
  it('accepts the three modes', () => {
    expect(parseThemeMode('auto')).toBe('auto');
    expect(parseThemeMode('light')).toBe('light');
    expect(parseThemeMode('dark')).toBe('dark');
  });

  it('falls back to auto for anything else', () => {
    expect(parseThemeMode('sepia')).toBe('auto');
    expect(parseThemeMode(null)).toBe('auto');
    expect(parseThemeMode(42)).toBe('auto');
  });
});

describe('applyThemeMode', () => {
  it('sets the attribute for explicit modes', () => {
    applyThemeMode('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    applyThemeMode('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('removes the attribute for auto, so the device decides', () => {
    applyThemeMode('dark');
    applyThemeMode('auto');
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});

describe('stored mode', () => {
  it('round-trips through localStorage', () => {
    storeThemeMode('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(readStoredThemeMode()).toBe('dark');
  });

  it('ignores a corrupted stored value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'banana');
    expect(readStoredThemeMode()).toBe('auto');
  });

  it('survives blocked storage', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readStoredThemeMode()).toBe('auto');
    spy.mockRestore();
  });
});
