import { useEffect, useState } from 'react';
import { DEFAULT_PERIOD_BOUNDS, type PeriodBounds } from '../../core';
import { loadSettings } from '../../storage';
import { useData } from './useData';

/**
 * The hours where the morning, the afternoon and the evening start, as chosen in the settings.
 * It is `null` until the settings have been read, so a screen can wait instead of filtering by
 * the wrong periods for a moment. Unreadable settings fall back to the default hours.
 */
export function usePeriodBounds(): PeriodBounds | null {
  const { db, revision } = useData();
  const [bounds, setBounds] = useState<PeriodBounds | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSettings(db)
      .then((settings) => {
        if (!cancelled) setBounds(settings.periodBounds);
      })
      .catch(() => {
        if (!cancelled) setBounds(DEFAULT_PERIOD_BOUNDS);
      });
    return () => {
      cancelled = true;
    };
  }, [db, revision]);

  return bounds;
}
