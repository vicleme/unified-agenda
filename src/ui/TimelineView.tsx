import { useState, type Dispatch, type SetStateAction } from 'react';
import { localDate } from '../core';
import {
  useAgendaGroups,
  useAgendas,
  useItems,
  useSavedViews,
  useStatusGroups,
  useStatuses,
  useTags,
} from './data/useEntityList';
import { useDisplayTimeZone } from './data/useDisplayTimeZone';
import { usePeriodBounds } from './data/usePeriodBounds';
import { useI18n } from './i18n/useI18n';
import { TimelineScroller } from './TimelineScroller';
import { INITIAL_TIMELINE_MEMORY, type TimelineMemory } from './timelineMemory';

interface TimelineViewProps {
  /** The current instant in milliseconds. Only tests pass it, to fix the clock. */
  now?: number;
  /**
   * The filters, agenda selection, layout and active saved view. The shell passes them so they
   * outlive this screen. Without them (tests) the screen keeps its own.
   */
  memory?: TimelineMemory;
  onMemoryChange?: Dispatch<SetStateAction<TimelineMemory>>;
}

/**
 * The Timeline screen: reads the data and waits until everything is loaded, then hands it to the
 * scrolling list. The day logic comes from the `core`, so this screen only reads and draws.
 */
export function TimelineView({ now, memory, onMemoryChange }: TimelineViewProps) {
  const { t } = useI18n();
  const agendas = useAgendas();
  const agendaGroups = useAgendaGroups();
  const items = useItems();
  const statuses = useStatuses();
  const statusGroups = useStatusGroups();
  const tags = useTags();
  const savedViews = useSavedViews();
  const zone = useDisplayTimeZone();
  const bounds = usePeriodBounds();
  // The clock is read once, when the screen opens. Today is fixed until the screen opens again.
  const [openedAt] = useState(() => Date.now());
  const [ownMemory, setOwnMemory] = useState(INITIAL_TIMELINE_MEMORY);

  const lists = [agendas, agendaGroups, items, statuses, statusGroups, tags, savedViews];
  // The zone and the period hours are read first, so a day is never cut or filtered wrongly
  if (zone === null || bounds === null || lists.some((list) => list.loading)) return null;

  if (lists.some((list) => list.failed)) {
    return (
      <p role="alert" className="field__error">
        {t.timeline.loadFailed}
      </p>
    );
  }

  const nowMs = now ?? openedAt;
  return (
    <TimelineScroller
      items={items.data}
      agendas={agendas.data}
      agendaGroups={agendaGroups.data}
      statuses={statuses.data}
      statusGroups={statusGroups.data}
      tags={tags.data}
      savedViews={savedViews.data}
      memory={memory ?? ownMemory}
      onMemoryChange={onMemoryChange ?? setOwnMemory}
      bounds={bounds}
      zone={zone}
      nowMs={nowMs}
      today={localDate(nowMs, zone)}
    />
  );
}
