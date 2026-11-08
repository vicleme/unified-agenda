import {
  DEFAULT_SETTINGS,
  isValidPeriodBounds,
  isValidTimeZone,
  type PeriodBounds,
  type Settings,
} from '../core';
import type { AgendaDatabase } from './db';

const SETTINGS_KEY = 'settings';

export function isValidSettings(settings: Settings): boolean {
  return (
    (settings.displayTimeZone === 'auto' || isValidTimeZone(settings.displayTimeZone)) &&
    isValidPeriodBounds(settings.periodBounds)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Builds usable settings from anything stored, replacing each bad part with its default. */
export function normalizeSettings(raw: unknown): Settings {
  if (!isRecord(raw))
    return { ...DEFAULT_SETTINGS, periodBounds: { ...DEFAULT_SETTINGS.periodBounds } };

  const zone = raw.displayTimeZone;
  const displayTimeZone =
    typeof zone === 'string' && (zone === 'auto' || isValidTimeZone(zone))
      ? zone
      : DEFAULT_SETTINGS.displayTimeZone;

  const bounds = raw.periodBounds;
  let periodBounds: PeriodBounds = { ...DEFAULT_SETTINGS.periodBounds };
  if (isRecord(bounds)) {
    const candidate = {
      morningStart: bounds.morningStart,
      afternoonStart: bounds.afternoonStart,
      eveningStart: bounds.eveningStart,
    } as PeriodBounds;
    if (isValidPeriodBounds(candidate)) periodBounds = candidate;
  }
  return { displayTimeZone, periodBounds };
}

export async function loadSettings(db: AgendaDatabase): Promise<Settings> {
  const record = await db.meta.get(SETTINGS_KEY);
  return normalizeSettings(record?.value);
}

/** Saves the settings. Throws a RangeError for a zone or period bounds that are not valid. */
export async function saveSettings(db: AgendaDatabase, settings: Settings): Promise<void> {
  if (!isValidSettings(settings)) throw new RangeError('Invalid settings');
  await db.meta.put({ key: SETTINGS_KEY, value: settings });
}

export { SETTINGS_KEY };
