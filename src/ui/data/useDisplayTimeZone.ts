import { useEffect, useState } from 'react';
import { resolveTimeZone } from '../../core';
import { loadSettings } from '../../storage';
import { useData } from './useData';

/**
 * The real time zone name to show dates in: the one chosen in the settings, or the device zone
 * when the setting is `auto`. It is `null` until the settings have been read, so a screen can
 * wait instead of showing a time in the wrong zone for a moment.
 */
export function useDisplayTimeZone(): string | null {
  const { db, revision } = useData();
  const [zone, setZone] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSettings(db)
      .then((settings) => {
        if (!cancelled) setZone(resolveTimeZone(settings.displayTimeZone));
      })
      .catch(() => {
        // Unreadable settings: fall back to the device zone
        if (!cancelled) setZone(resolveTimeZone('auto'));
      });
    return () => {
      cancelled = true;
    };
  }, [db, revision]);

  return zone;
}
