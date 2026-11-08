import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import {
  addDays,
  buildOverdueStrip,
  buildTimelineRange,
  comparePlainDates,
  daysBetween,
  defaultDoneStatusId,
  doneStatusIds,
  isPlainDate,
  msToTimestamp,
  type Agenda,
  type AgendaGroup,
  type Id,
  type Item,
  type PeriodBounds,
  type PlainDate,
  type SavedView,
  type Status,
  type StatusGroup,
  type Tag,
  type TimelineDay,
} from '../core';
import {
  ALL_AGENDAS,
  EMPTY_FILTER,
  applyDayFilters,
  applyOverdueFilter,
  createLayoutPlan,
  dropUnavailableTags,
  filterByAgendas,
  controlsFromView,
  filterItems,
  isAgendaSelectionActive,
  isFilterActive,
  isViewCurrent,
  sortSavedViews,
  type AgendaLayout,
  type AgendaSelection,
} from '../filters';
import { useData } from './data/useData';
import { formatCount, formatDate } from './format';
import { useI18n } from './i18n/useI18n';
import { TimelineDayBlock, type TimelineShared } from './TimelineDayBlock';
import { TimelineFilters } from './TimelineFilters';
import { activeFilterCount } from './timelineFilterValues';
import type { TimelineMemory } from './timelineMemory';

/** Days around today when the screen opens, and how many more each load adds on one side. */
const DAYS_BEFORE = 7;
const DAYS_AFTER = 20;
const STEP = 14;
/** How close to an end of the page (in pixels) the scroll has to get before more days load. */
const EDGE = 600;
/** The "back to top" button appears once the page is scrolled this many pixels. */
const TOP_BUTTON_AFTER = 300;
/**
 * On opening, the page only scrolls to today when today starts lower than this (in pixels from
 * the top of the page). Closer than that, scrolling would only hide the header and the folded
 * earlier days to put today a few pixels higher, so the page stays at the top.
 */
const OPEN_SCROLL_MIN = 400;
/** How long the "marked as done" message (with Undo) stays on screen, in milliseconds. */
const UNDO_VISIBLE_MS = 8000;
/** The date picker accepts only this span, so a typo can not ask for thousands of days. */
const MIN_DATE = '1970-01-01';
const MAX_DATE = '2100-12-31';

interface TimelineScrollerProps {
  items: Item[];
  agendas: Agenda[];
  /** The agenda groups, for the agenda selection. */
  agendaGroups: AgendaGroup[];
  statuses: Status[];
  statusGroups: StatusGroup[];
  /** Every active tag, for the tag filter. */
  tags: Tag[];
  /** The saved views, for the filter panel. */
  savedViews: SavedView[];
  /**
   * The filters, the agenda selection, the layout and the active view. They belong to the shell
   * above, so they are still there after a trip to another tab.
   */
  memory: TimelineMemory;
  onMemoryChange: Dispatch<SetStateAction<TimelineMemory>>;
  /** Where the day periods start, for the period filter. */
  bounds: PeriodBounds;
  zone: string;
  /** The current instant, read once when the screen opened. */
  nowMs: number;
  today: PlainDate;
}

/** A piece of the list: a day with content (or today), or several empty days in a row. */
type Segment = { kind: 'day'; day: TimelineDay } | { kind: 'run'; days: TimelineDay[] };

/** Groups consecutive empty days (never today) into one folded run. */
function toSegments(days: TimelineDay[], today: PlainDate): Segment[] {
  const segments: Segment[] = [];
  for (const day of days) {
    const foldable = day.empty && day.date !== today;
    const last = segments[segments.length - 1];
    if (foldable && last?.kind === 'run') last.days.push(day);
    else if (foldable) segments.push({ kind: 'run', days: [day] });
    else segments.push({ kind: 'day', day });
  }
  return segments;
}

/**
 * The scrolling Timeline. It starts a week before today and three weeks ahead, and adds 14 days
 * on one side when the page scroll gets near that end (or when the person taps the button at the
 * end). Empty days in a row fold into one line. No list virtualization: the page scrolls as a
 * whole, blocks have different heights, and folding keeps the number of blocks small.
 *
 * Adding days above would push everything down and make the page jump. Analogy: adding pages to
 * the front of a notebook while you are reading, so the screen keeps your page by adding the
 * height that was inserted back to the scroll position.
 */
export function TimelineScroller({
  items,
  agendas,
  agendaGroups,
  statuses,
  statusGroups,
  tags,
  savedViews,
  memory,
  onMemoryChange,
  bounds,
  zone,
  nowMs,
  today,
}: TimelineScrollerProps) {
  const { t, locale } = useI18n();
  const { repos, notify } = useData();
  const [range, setRange] = useState(() => ({
    from: addDays(today, -DAYS_BEFORE),
    to: addDays(today, DAYS_AFTER),
  }));
  const [expanded, setExpanded] = useState<ReadonlySet<PlainDate>>(new Set());
  // Page height and scroll position before days were added above, to keep the screen in place
  const anchor = useRef<{ height: number; top: number } | null>(null);
  // Set when this screen moved the scroll itself, so that move does not count as the person's
  const ignoreScroll = useRef(false);
  // The day to bring into view once it is on the page. Opens on today.
  const pendingTarget = useRef<PlainDate | null>(today);
  const opening = useRef(true);
  const [scrolled, setScrolled] = useState(false);
  // The last task marked as done, kept for a moment so a stray tap can be undone
  const [justDone, setJustDone] = useState<{
    id: Id;
    title: string;
    previousStatusId: Id | null;
  } | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  // The sieves, the shown agendas (null is all) and the layout (how each day is dealt into
  // sections, which hides nothing, so it is not a filter and not counted) come from the shell
  const { filter, selection, layout } = memory.controls;
  // The tags the last change took out of the filter, shown once in the panel
  const [droppedTagNames, setDroppedTagNames] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersButton = useRef<HTMLButtonElement>(null);

  const doneIds = useMemo(() => doneStatusIds(statuses, statusGroups), [statuses, statusGroups]);
  const activeView = useMemo(
    () => sortSavedViews(savedViews).find((view) => view.id === memory.viewId) ?? null,
    [savedViews, memory.viewId],
  );
  const viewChanged = activeView !== null && !isViewCurrent(activeView, memory.controls, agendas);
  const agendasOn = isAgendaSelectionActive(selection, agendas);
  const filterOn = isFilterActive(filter) || agendasOn;
  const filterCount = activeFilterCount(filter, agendasOn);
  // Tag, type and text sieves cut the items first (the whole list is passed, so inherited tags
  // find their parents). The period and "due within" sieves then cut each built day.
  const shown = useMemo(
    () =>
      filterByAgendas(
        isFilterActive(filter) ? filterItems(items, filter, tags) : items,
        selection,
        agendas,
      ),
    [items, filter, tags, selection, agendas],
  );
  const days = useMemo(
    () =>
      buildTimelineRange(shown, range.from, range.to, zone, doneIds).map((day) =>
        applyDayFilters(day, filter, zone, bounds),
      ),
    [shown, range, zone, doneIds, filter, bounds],
  );
  const overdue = useMemo(
    () =>
      applyOverdueFilter(
        buildOverdueStrip(shown, msToTimestamp(nowMs), today, zone, doneIds),
        filter,
      ),
    [shown, nowMs, today, zone, doneIds, filter],
  );
  const plan = useMemo(
    () => createLayoutPlan(layout, agendas, agendaGroups),
    [layout, agendas, agendaGroups],
  );
  const nothingMatches = filterOn && overdue.length === 0 && days.every((day) => day.empty);
  const segments = useMemo(() => toSegments(days, today), [days, today]);
  const doneStatusId = useMemo(
    () => defaultDoneStatusId(statuses, statusGroups),
    [statuses, statusGroups],
  );

  /** Changes some of the controls. The active view stays, and shows as changed. */
  function changeControls(patch: Partial<TimelineMemory['controls']>) {
    onMemoryChange((current) => ({ ...current, controls: { ...current.controls, ...patch } }));
  }

  /** Changes the shown agendas and takes out of the tag filter the tags that no longer apply. */
  function changeSelection(next: AgendaSelection) {
    const result = dropUnavailableTags(filter, tags, next, agendas);
    changeControls({ selection: next, filter: result.filter });
    setDroppedTagNames(result.dropped.map((tag) => tag.name));
  }

  function clearFilters() {
    changeControls({ filter: EMPTY_FILTER, selection: ALL_AGENDAS });
    setDroppedTagNames([]);
  }

  /** Sets every control to the view's and makes it the active one. */
  function applyView(view: SavedView) {
    onMemoryChange({ controls: controlsFromView(view), viewId: view.id });
    setDroppedTagNames([]);
  }

  /** Gives the task the done status. It leaves the strips on the next read, and Undo can bring it back. */
  const markDone = useCallback(
    async (item: Item) => {
      if (doneStatusId === null) return;
      setSaveFailed(false);
      try {
        await repos.items.update(item.id, { statusId: doneStatusId });
        notify();
        setJustDone({ id: item.id, title: item.title, previousStatusId: item.statusId });
      } catch {
        setSaveFailed(true);
      }
    },
    [doneStatusId, repos, notify],
  );

  async function undoDone() {
    if (!justDone) return;
    setSaveFailed(false);
    try {
      await repos.items.update(justDone.id, { statusId: justDone.previousStatusId });
      notify();
      setJustDone(null);
    } catch {
      setSaveFailed(true);
    }
  }

  // The message goes away by itself, and a newer "done" restarts the count
  useEffect(() => {
    if (!justDone) return;
    const timer = setTimeout(() => setJustDone(null), UNDO_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [justDone]);

  const shared: TimelineShared = useMemo(
    () => ({
      agendas: new Map(agendas.map((agenda) => [agenda.id, agenda])),
      groups: new Map(agendaGroups.map((group) => [group.id, group])),
      itemsById: new Map(items.map((item) => [item.id, item])),
      statusNames: new Map(statuses.map((status) => [status.id, status.name])),
      zone,
      onDone: doneStatusId === null ? undefined : markDone,
    }),
    [agendas, agendaGroups, items, statuses, zone, doneStatusId, markDone],
  );

  const scrollToElement = useCallback((element: HTMLElement) => {
    const before = window.scrollY;
    element.scrollIntoView?.({ block: 'start' });
    if (window.scrollY !== before) ignoreScroll.current = true;
  }, []);

  /**
   * Brings a day to the top of the screen. A day already on the page is scrolled to right away.
   * Otherwise the day is asked for and reached after the next draw: a day inside the loaded range
   * but folded is opened (its run opens, because the run is open when any of its days is), and a
   * day outside the range replaces the range with the days around it. Replacing, not stretching,
   * keeps a jump to a far date cheap.
   */
  const goTo = useCallback(
    (date: PlainDate) => {
      const element = document.getElementById(`timeline-block-${date}`);
      if (element) {
        scrollToElement(element);
        return;
      }
      pendingTarget.current = date;
      setExpanded((current) => (current.has(date) ? current : new Set(current).add(date)));
      setRange((current) =>
        comparePlainDates(date, current.from) >= 0 && comparePlainDates(date, current.to) <= 0
          ? current
          : { from: addDays(date, -DAYS_BEFORE), to: addDays(date, DAYS_AFTER) },
      );
    },
    [scrollToElement],
  );

  // Brings the asked-for day into view (and opens on today the first time, when it is far down)
  useLayoutEffect(() => {
    const target = pendingTarget.current;
    if (!target) return;
    const element = document.getElementById(`timeline-block-${target}`);
    if (!element) return;
    pendingTarget.current = null;
    // The first time (opening the screen), stay at the top when today is already near it
    const isOpening = opening.current;
    opening.current = false;
    if (isOpening && element.getBoundingClientRect().top + window.scrollY < OPEN_SCROLL_MIN) return;
    scrollToElement(element);
  }, [range, expanded, scrollToElement]);

  function closeFilters() {
    setFiltersOpen(false);
    filtersButton.current?.focus();
  }

  function backToTop() {
    const before = window.scrollY;
    window.scrollTo(0, 0);
    if (before !== 0) ignoreScroll.current = true;
  }

  function pickDate(value: string) {
    // An unfinished or out of span date (typed by hand) is ignored
    if (isPlainDate(value) && value >= MIN_DATE && value <= MAX_DATE) goTo(value);
  }

  const extend = useCallback((side: 'before' | 'after') => {
    if (side === 'before') {
      anchor.current = {
        height: document.documentElement.scrollHeight,
        top: window.scrollY,
      };
    }
    setRange((current) =>
      side === 'before'
        ? { ...current, from: addDays(current.from, -STEP) }
        : { ...current, to: addDays(current.to, STEP) },
    );
  }, []);

  // After days were added above, put the page back where the person was
  useLayoutEffect(() => {
    const saved = anchor.current;
    if (!saved) return;
    anchor.current = null;
    const added = document.documentElement.scrollHeight - saved.height;
    if (added !== 0) {
      ignoreScroll.current = true;
      window.scrollTo(0, saved.top + added);
    }
  }, [range.from]);

  // Near an end of the page: load more. Only a real scroll loads, so a short page (everything
  // folded) does not keep loading by itself, and the two buttons cover that case.
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > TOP_BUTTON_AFTER);
      if (ignoreScroll.current) {
        ignoreScroll.current = false;
        return;
      }
      const page = document.documentElement;
      if (window.scrollY < EDGE) extend('before');
      if (page.scrollHeight - window.scrollY - window.innerHeight < EDGE) extend('after');
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [extend]);

  function toggleRun(run: TimelineDay[], open: boolean) {
    setExpanded((current) => {
      const next = new Set(current);
      for (const day of run) {
        if (open) next.add(day.date);
        else next.delete(day.date);
      }
      return next;
    });
  }

  function runLabel(run: TimelineDay[]): string {
    const first = formatDate(locale, run[0]!.date);
    const last = formatDate(locale, run[run.length - 1]!.date);
    return run.length === 1
      ? first
      : t.items.range.replace('{start}', first).replace('{end}', last);
  }

  function block(day: TimelineDay) {
    const offset = daysBetween(today, day.date);
    return (
      <TimelineDayBlock
        key={day.date}
        day={day}
        offset={offset}
        overdue={offset === 0 ? overdue : undefined}
        plan={plan}
        shared={shared}
      />
    );
  }

  return (
    <div className="timeline">
      <div className="timeline__bar">
        <input
          type="date"
          className="timeline__date"
          aria-label={t.timeline.goToDate}
          min={MIN_DATE}
          max={MAX_DATE}
          onChange={(event) => pickDate(event.target.value)}
        />
        <button
          ref={filtersButton}
          type="button"
          className="button"
          aria-expanded={filtersOpen}
          aria-controls="timeline-filters"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          {filterOn ? `${t.timeline.filters.toggle} (${filterCount})` : t.timeline.filters.toggle}
        </button>
        <button type="button" className="button" onClick={() => goTo(today)}>
          {t.timeline.goToToday}
        </button>
        {scrolled && (
          <button type="button" className="button" onClick={backToTop}>
            {t.timeline.backToTop}
          </button>
        )}
        {filtersOpen && (
          <TimelineFilters
            filter={filter}
            tags={tags}
            agendas={agendas}
            groups={agendaGroups}
            selection={selection}
            layout={layout}
            savedViews={savedViews}
            activeViewId={memory.viewId}
            droppedTagNames={droppedTagNames}
            activeCount={filterCount}
            onChange={(next) => {
              changeControls({ filter: next });
              setDroppedTagNames([]);
            }}
            onSelectionChange={changeSelection}
            onLayoutChange={(next: AgendaLayout) => changeControls({ layout: next })}
            onApplyView={applyView}
            onActiveViewChange={(id) => onMemoryChange((current) => ({ ...current, viewId: id }))}
            onClear={clearFilters}
            onClose={closeFilters}
          />
        )}
      </div>

      {activeView && (
        <p className="timeline__filter-state">
          <span role="status">
            {t.timeline.filters.views.state.replace('{name}', activeView.name)}
            {viewChanged && ` (${t.timeline.filters.views.changed})`}
          </span>
        </p>
      )}

      {filterOn && (
        <p className="timeline__filter-state">
          <span role="status">
            {nothingMatches ? t.timeline.filters.noMatch : t.timeline.filters.activeNotice}
          </span>
          <button type="button" className="button" onClick={clearFilters}>
            {t.timeline.filters.clear}
          </button>
        </p>
      )}

      {/* A toast above the tab bar, always in the page so a screen reader announces its text */}
      <div className="timeline__notice" role="status">
        {justDone && (
          <>
            <span>{t.timeline.markedDone.replace('{name}', justDone.title)}</span>
            <button
              type="button"
              className="button"
              aria-label={t.timeline.undoNamed.replace('{name}', justDone.title)}
              onClick={() => void undoDone()}
            >
              {t.timeline.undo}
            </button>
          </>
        )}
      </div>
      {saveFailed && (
        <p role="alert" className="field__error timeline__notice">
          {t.timeline.saveFailed}
        </p>
      )}

      <button type="button" className="button timeline__more" onClick={() => extend('before')}>
        {t.timeline.earlier}
      </button>

      {segments.map((segment) => {
        if (segment.kind === 'day') return block(segment.day);
        const open = segment.days.some((day) => expanded.has(day.date));
        const label = runLabel(segment.days);
        return (
          <div key={`run-${segment.days[0]!.date}`} className="timeline__run">
            <button
              type="button"
              className="timeline__fold"
              aria-expanded={open}
              onClick={() => toggleRun(segment.days, !open)}
            >
              {open
                ? t.timeline.hideRun.replace('{range}', label)
                : `${label} · ${formatCount(locale, segment.days.length, t.timeline.emptyDays)}`}
            </button>
            {open && segment.days.map((day) => block(day))}
          </div>
        );
      })}

      <button type="button" className="button timeline__more" onClick={() => extend('after')}>
        {t.timeline.later}
      </button>
    </div>
  );
}
