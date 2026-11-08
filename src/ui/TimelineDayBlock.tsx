import { Fragment } from 'react';
import type {
  Agenda,
  AgendaGroup,
  Id,
  Item,
  OpenTask,
  OverdueEntry,
  TimelineDay,
  TimelineEntry,
} from '../core';
import { arrangeDayWithOverdue, type CombinedSection, type LayoutPlan } from '../filters';
import { formatCount, formatDate, formatDayHeading, formatTime } from './format';
import { useI18n } from './i18n/useI18n';
import { entryTimeText, openTaskDueText } from './timelineValues';

/** What every day block needs. Built once by the view and shared by all the days. */
export interface TimelineShared {
  agendas: ReadonlyMap<Id, Agenda>;
  groups: ReadonlyMap<Id, AgendaGroup>;
  itemsById: ReadonlyMap<Id, Item>;
  statusNames: ReadonlyMap<Id, string>;
  zone: string;
  /** Marks a task as done. Absent when there is no done status, so no button is drawn. */
  onDone?: (item: Item) => void;
}

interface TimelineDayBlockProps {
  day: TimelineDay;
  /** 0 for today, 1 for tomorrow, anything else shows no badge. */
  offset: number;
  /** The overdue strip. Only today's block receives it. */
  overdue?: OverdueEntry[];
  /** How the day is dealt into sections (one list, one per agenda or one per group). */
  plan: LayoutPlan;
  shared: TimelineShared;
}

/** The agenda of an item: a small color dot and the name. The color is the user's own data. */
function AgendaLabel({ item, shared }: { item: Item; shared: TimelineShared }) {
  const agenda = shared.agendas.get(item.agendaId);
  if (!agenda) return null;
  return (
    <span className="entry__agenda">
      <span
        className="entry__swatch"
        style={{ backgroundColor: agenda.color }}
        aria-hidden="true"
      />
      {agenda.name}
    </span>
  );
}

function Row({
  time,
  title,
  meta,
  marks = [],
  emphasis = false,
  danger = false,
  action,
}: {
  time: string;
  title: string;
  meta: React.ReactNode;
  marks?: string[];
  emphasis?: boolean;
  danger?: boolean;
  action?: React.ReactNode;
}) {
  const classes = ['entry'];
  if (emphasis) classes.push('entry--emphasis');
  if (danger) classes.push('entry--danger');
  return (
    <li className={classes.join(' ')}>
      <span className="entry__time">{time}</span>
      <div className="entry__main">
        <span className="entry__title">{title}</span>
        <span className="entry__meta">{meta}</span>
        {marks.map((mark) => (
          <span key={mark} className="entry__mark">
            {mark}
          </span>
        ))}
      </div>
      {action}
    </li>
  );
}

/**
 * One page of the paper planner: the heading, the strip of overdue tasks (today only), the strip
 * of open tasks, then the whole-day items and the timed items in time order.
 */
export function TimelineDayBlock({
  day,
  offset,
  overdue = [],
  plan,
  shared,
}: TimelineDayBlockProps) {
  const { t, locale } = useI18n();
  const headingId = `timeline-day-${day.date}`;

  /** What goes under the title: where it is inside, its place and its agenda. */
  function entryMeta(entry: TimelineEntry) {
    const parent = entry.item.parentId ? shared.itemsById.get(entry.item.parentId) : undefined;
    const parts: string[] = [];
    if (parent) parts.push(t.items.insideOf.replace('{name}', parent.title));
    if (entry.item.location) parts.push(entry.item.location);
    return (
      <>
        <AgendaLabel item={entry.item} shared={shared} />
        {parts.length > 0 && <span>{parts.join(' · ')}</span>}
      </>
    );
  }

  function entryMarks(entry: TimelineEntry): string[] {
    const marks: string[] = [];
    if (entry.continuesFromPrevious) marks.push(t.timeline.continuesFrom);
    if (entry.continuesToNext) marks.push(t.timeline.continuesTo);
    return marks;
  }

  function openMeta(open: OpenTask) {
    const status =
      open.item.statusId !== null
        ? (shared.statusNames.get(open.item.statusId) ?? t.items.noStatus)
        : t.items.noStatus;
    return (
      <>
        <AgendaLabel item={open.item} shared={shared} />
        <span>{status}</span>
      </>
    );
  }

  /** The left text of an overdue row: the delivery day, or the hour when it was due today. */
  function overdueTimeText(entry: OverdueEntry): string {
    const due = entry.item.due;
    if (entry.daysLate === 0 && due && !due.allDay) {
      return t.timeline.dueAt.replace('{time}', formatTime(locale, due.at, shared.zone));
    }
    return t.timeline.dueOn.replace('{date}', formatDate(locale, entry.dueDate));
  }

  /** The "Done" button of a task row (open and overdue strips). Events have none. */
  function doneButton(item: Item) {
    if (!shared.onDone) return undefined;
    const onDone = shared.onDone;
    return (
      <button
        type="button"
        className="button entry__action"
        aria-label={t.timeline.markDoneNamed.replace('{name}', item.title)}
        onClick={() => onDone(item)}
      >
        {t.timeline.markDone}
      </button>
    );
  }

  /** The title of a section: the agenda (with its dot), the group, or "No group". */
  function sectionTitle(section: CombinedSection) {
    const { kind, agendaId, groupId } = section.info;
    if (kind === 'agenda') {
      const agenda = agendaId ? shared.agendas.get(agendaId) : undefined;
      return (
        <>
          {agenda && (
            <span
              className="entry__swatch"
              style={{ backgroundColor: agenda.color }}
              aria-hidden="true"
            />
          )}
          {agenda?.name ?? t.timeline.ungrouped}
        </>
      );
    }
    if (kind === 'group') return shared.groups.get(groupId ?? '')?.name ?? t.timeline.ungrouped;
    return t.timeline.ungrouped;
  }

  /** The strips and lists of one section. `Strip` is the heading level under the section title. */
  function sectionBody(section: CombinedSection, Strip: 'h3' | 'h4') {
    const part = section.day;
    // A task already in the overdue strip is not listed again as open in today's block
    const overdueIds = new Set(section.overdue.map((entry) => entry.item.id));
    const openTasks = part.open.filter((open) => !overdueIds.has(open.item.id));
    return (
      <>
        {section.overdue.length > 0 && (
          <div className="strip strip--overdue">
            <Strip className="strip__title">{t.timeline.overdue}</Strip>
            <ul className="entries">
              {section.overdue.map((entry) => (
                <Row
                  key={entry.item.id}
                  danger
                  time={overdueTimeText(entry)}
                  title={entry.item.title}
                  meta={
                    <>
                      <AgendaLabel item={entry.item} shared={shared} />
                      <span>
                        {entry.daysLate === 0
                          ? t.timeline.lateToday
                          : formatCount(locale, entry.daysLate, t.timeline.lateDays)}
                      </span>
                    </>
                  }
                  action={doneButton(entry.item)}
                />
              ))}
            </ul>
          </div>
        )}

        {openTasks.length > 0 && (
          <div className="strip">
            <Strip className="strip__title">{t.timeline.open}</Strip>
            <ul className="entries">
              {openTasks.map((open) => (
                <Row
                  key={open.item.id}
                  emphasis={open.isDueDay}
                  time={openTaskDueText(locale, open, shared.zone, t.timeline)}
                  title={open.item.title}
                  meta={openMeta(open)}
                  action={doneButton(open.item)}
                />
              ))}
            </ul>
          </div>
        )}

        {(part.allDay.length > 0 || part.timed.length > 0) && (
          <ul className="entries">
            {part.allDay.map((entry) => (
              <Row
                key={entry.item.id}
                time={entryTimeText(locale, entry, shared.zone, t.timeline, t.items.range)}
                title={entry.item.title}
                meta={entryMeta(entry)}
                marks={entryMarks(entry)}
              />
            ))}
            {part.timed.map((entry) => (
              <Row
                key={entry.item.id}
                time={entryTimeText(locale, entry, shared.zone, t.timeline, t.items.range)}
                title={entry.item.title}
                meta={entryMeta(entry)}
                marks={entryMarks(entry)}
              />
            ))}
          </ul>
        )}
      </>
    );
  }

  const sections = arrangeDayWithOverdue(day, overdue, plan);
  const sectioned = plan.layout !== 'mixed';

  const badge = offset === 0 ? t.timeline.today : offset === 1 ? t.timeline.tomorrow : null;

  return (
    <section
      className={offset === 0 ? 'day day--today' : 'day'}
      id={`timeline-block-${day.date}`}
      aria-labelledby={headingId}
    >
      <header className="day__header">
        <h2 id={headingId} className="day__heading">
          {formatDayHeading(locale, day.date)}
        </h2>
        {badge && <span className="day__badge">{badge}</span>}
      </header>

      {sections.map((section) => {
        if (!sectioned) {
          return <Fragment key={section.info.key}>{sectionBody(section, 'h3')}</Fragment>;
        }
        const titleId = `timeline-section-${day.date}-${section.info.key}`;
        return (
          <div
            key={section.info.key}
            className="day__section"
            role="group"
            aria-labelledby={titleId}
          >
            <h3 id={titleId} className="day__section-title">
              {sectionTitle(section)}
            </h3>
            {sectionBody(section, 'h4')}
          </div>
        );
      })}

      {sections.length === 0 && <p className="day__empty">{t.timeline.nothing}</p>}
    </section>
  );
}
