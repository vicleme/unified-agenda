import { DEFAULT_SETTINGS } from '../../src/core';
import {
  buildSettings,
  settingsToValues,
  type SettingsFormValues,
} from '../../src/ui/settingsValues';

const base: SettingsFormValues = {
  zoneMode: 'auto',
  timeZone: '',
  morningStart: '6',
  afternoonStart: '12',
  eveningStart: '18',
};

describe('settingsToValues', () => {
  it('shows the default settings as automatic with the default hours', () => {
    expect(settingsToValues(DEFAULT_SETTINGS)).toEqual(base);
  });

  it('shows a chosen zone as custom', () => {
    const values = settingsToValues({ ...DEFAULT_SETTINGS, displayTimeZone: 'Asia/Tokyo' });
    expect(values).toMatchObject({ zoneMode: 'custom', timeZone: 'Asia/Tokyo' });
  });
});

describe('buildSettings', () => {
  it('builds automatic settings from the default form', () => {
    expect(buildSettings(base)).toEqual({ ok: true, settings: DEFAULT_SETTINGS });
  });

  it('builds a chosen zone and new hours, cutting spaces', () => {
    const result = buildSettings({
      ...base,
      zoneMode: 'custom',
      timeZone: ' Asia/Tokyo ',
      morningStart: ' 7',
      eveningStart: '20 ',
    });
    expect(result).toEqual({
      ok: true,
      settings: {
        displayTimeZone: 'Asia/Tokyo',
        periodBounds: { morningStart: 7, afternoonStart: 12, eveningStart: 20 },
      },
    });
  });

  it('ignores the zone text while the mode is automatic', () => {
    const result = buildSettings({ ...base, timeZone: 'not a zone' });
    expect(result.ok).toBe(true);
  });

  it('asks for a zone name when custom is chosen with nothing typed', () => {
    expect(buildSettings({ ...base, zoneMode: 'custom', timeZone: '  ' })).toEqual({
      ok: false,
      errors: { timeZone: 'timeZoneRequired' },
    });
  });

  it('refuses a zone that does not exist', () => {
    expect(buildSettings({ ...base, zoneMode: 'custom', timeZone: 'Mars/Olympus' })).toEqual({
      ok: false,
      errors: { timeZone: 'invalidTimeZone' },
    });
  });

  it.each(['', 'abc', '6.5', '0', '24', '-3', '100'])('refuses the hour "%s"', (text) => {
    const result = buildSettings({ ...base, morningStart: text });
    expect(result).toEqual({ ok: false, errors: { morningStart: 'hourInvalid' } });
  });

  it('refuses hours that are not in order, once each one is a valid hour', () => {
    expect(buildSettings({ ...base, afternoonStart: '5' })).toEqual({
      ok: false,
      errors: { periods: 'periodOrder' },
    });
    expect(buildSettings({ ...base, afternoonStart: '18' })).toEqual({
      ok: false,
      errors: { periods: 'periodOrder' },
    });
  });

  it('does not report the order while an hour is still invalid', () => {
    const result = buildSettings({ ...base, morningStart: 'x', afternoonStart: '5' });
    expect(result).toEqual({ ok: false, errors: { morningStart: 'hourInvalid' } });
  });
});
