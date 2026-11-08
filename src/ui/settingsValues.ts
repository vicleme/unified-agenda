import { isValidPeriodBounds, isValidTimeZone, type Settings } from '../core';

/** What the settings form holds: plain text, converted to and from `Settings` here. */
export interface SettingsFormValues {
  zoneMode: 'auto' | 'custom';
  timeZone: string;
  morningStart: string;
  afternoonStart: string;
  eveningStart: string;
}

export type SettingsIssue = 'timeZoneRequired' | 'invalidTimeZone' | 'hourInvalid' | 'periodOrder';

export interface SettingsErrors {
  timeZone?: SettingsIssue;
  morningStart?: SettingsIssue;
  afternoonStart?: SettingsIssue;
  eveningStart?: SettingsIssue;
  /** The three hours are fine one by one but are not in order. */
  periods?: SettingsIssue;
}

export type BuildSettingsResult =
  { ok: true; settings: Settings } | { ok: false; errors: SettingsErrors };

const HOUR_FIELDS = ['morningStart', 'afternoonStart', 'eveningStart'] as const;

export function settingsToValues(settings: Settings): SettingsFormValues {
  const custom = settings.displayTimeZone !== 'auto';
  return {
    zoneMode: custom ? 'custom' : 'auto',
    timeZone: custom ? settings.displayTimeZone : '',
    morningStart: String(settings.periodBounds.morningStart),
    afternoonStart: String(settings.periodBounds.afternoonStart),
    eveningStart: String(settings.periodBounds.eveningStart),
  };
}

/** Reads one hour typed by the person: a whole number from 1 to 23, or null. */
function parseHour(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,2}$/.test(trimmed)) return null;
  const hour = Number(trimmed);
  return hour >= 1 && hour <= 23 ? hour : null;
}

/**
 * Checks the form and builds the settings. The form checks what only it can see (empty or
 * non-numeric text), then `isValidPeriodBounds` and `isValidTimeZone` from the core decide the
 * rest, so the form and the stored data never disagree.
 */
export function buildSettings(values: SettingsFormValues): BuildSettingsResult {
  const errors: SettingsErrors = {};

  let displayTimeZone = 'auto';
  if (values.zoneMode === 'custom') {
    const zone = values.timeZone.trim();
    if (zone === '') errors.timeZone = 'timeZoneRequired';
    else if (!isValidTimeZone(zone)) errors.timeZone = 'invalidTimeZone';
    else displayTimeZone = zone;
  }

  const hours: Record<(typeof HOUR_FIELDS)[number], number> = {
    morningStart: 0,
    afternoonStart: 0,
    eveningStart: 0,
  };
  for (const field of HOUR_FIELDS) {
    const hour = parseHour(values[field]);
    if (hour === null) errors[field] = 'hourInvalid';
    else hours[field] = hour;
  }

  const hoursOk = HOUR_FIELDS.every((field) => !errors[field]);
  if (hoursOk && !isValidPeriodBounds(hours)) errors.periods = 'periodOrder';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, settings: { displayTimeZone, periodBounds: hours } };
}
