import {
  buildOverdueStrip,
  buildTimelineDay,
  createAgenda,
  createAgendaGroup,
  softDelete,
  type Agenda,
  type AgendaGroup,
  type Item,
} from '../../src/core';
import {
  arrangeDay,
  arrangeDayWithOverdue,
  arrangeOverdue,
  createLayoutPlan,
  isAgendaLayout,
  type DaySection,
} from '../../src/filters';
import { testContext } from '../core/helpers';
import { SP, event, task } from './helpers';

const ctx = testContext();
const none = new Set<string>();

function agenda(name: string, order: number): Agenda {
  return createAgenda({ name, color: '#3b5bdb', order }, ctx);
}
function group(name: string, members: Agenda[], order: number): AgendaGroup {
  return createAgendaGroup({ name, agendaIds: members.map((a) => a.id), order }, ctx);
}

const school = agenda('School', 1);
const freelance = agenda('Freelance', 2);
const home = agenda('Home', 3);
const agendas = [home, freelance, school];
const work = group('Work', [school, freelance], 1);
const personal = group('Personal', [home], 2);

// São Paulo is UTC-3, so 09:00 there is 12:00Z
const at = (hour: number) => new Date(Date.UTC(2026, 10, 9, hour + 3)).toISOString();
const timed = (title: string, agendaId: string, hour: number): Item =>
  event(title, { agendaId, schedule: { allDay: false, start: at(hour), end: at(hour + 1) } });

const items = [
  timed('Home lunch', home.id, 12),
  timed('Class', school.id, 9),
  timed('Client call', freelance.id, 10),
  event('School holiday', { agendaId: school.id, schedule: { allDay: true, start: '2026-11-09' } }),
  task('Home paper', { agendaId: home.id, due: { allDay: true, date: '2026-11-09' } }),
];
const day = buildTimelineDay(items, '2026-11-09', SP, none);

const titlesOf = (section: DaySection) => [
  ...section.day.allDay.map((entry) => entry.item.title),
  ...section.day.timed.map((entry) => entry.item.title),
  ...section.day.open.map((entry) => entry.item.title),
];
const summary = (sections: DaySection[]) =>
  sections.map((section) => [section.info.key, titlesOf(section)]);

describe('isAgendaLayout', () => {
  it('accepts only the three layouts', () => {
    expect(['mixed', 'separate', 'grouped'].every(isAgendaLayout)).toBe(true);
    expect(isAgendaLayout('tabs')).toBe(false);
    expect(isAgendaLayout(null)).toBe(false);
  });
});

describe('arrangeDay: mixed', () => {
  const plan = createLayoutPlan('mixed', agendas, [work, personal]);

  it('returns the day itself, untouched, as the only section', () => {
    const sections = arrangeDay(day, plan);
    expect(sections).toHaveLength(1);
    expect(sections[0]!.info).toMatchObject({ key: 'all', kind: 'all' });
    expect(sections[0]!.day).toBe(day);
  });

  it('returns no section for an empty day', () => {
    const empty = buildTimelineDay([], '2026-11-09', SP, none);
    expect(arrangeDay(empty, plan)).toEqual([]);
  });
});

describe('arrangeDay: separate', () => {
  const plan = createLayoutPlan('separate', agendas, [work, personal]);

  it('makes one section per agenda, in agenda order, keeping the time order inside', () => {
    expect(summary(arrangeDay(day, plan))).toEqual([
      [`agenda:${school.id}`, ['School holiday', 'Class']],
      [`agenda:${freelance.id}`, ['Client call']],
      [`agenda:${home.id}`, ['Home lunch', 'Home paper']],
    ]);
  });

  it('describes each section by its agenda', () => {
    const [first] = arrangeDay(day, plan);
    expect(first!.info).toEqual({
      key: `agenda:${school.id}`,
      kind: 'agenda',
      agendaId: school.id,
      groupId: null,
    });
  });

  it('drops sections with nothing and keeps the structure of each part', () => {
    const onlyHome = buildTimelineDay(
      items.filter((item) => item.agendaId === home.id),
      '2026-11-09',
      SP,
      none,
    );
    const sections = arrangeDay(onlyHome, plan);
    expect(sections).toHaveLength(1);
    expect(sections[0]!.day.timed).toHaveLength(1);
    expect(sections[0]!.day.open).toHaveLength(1);
    expect(sections[0]!.day.allDay).toEqual([]);
    expect(sections[0]!.day.date).toBe('2026-11-09');
    expect(sections[0]!.day.empty).toBe(false);
  });

  it('ignores deleted agendas when ordering, and puts an unknown agenda last', () => {
    const stray = timed('Stray', 'missing', 8);
    const homeItem = items.find((item) => item.agendaId === home.id)!;
    const schoolItem = items.find((item) => item.agendaId === school.id)!;
    const strayDay = buildTimelineDay([stray, homeItem, schoolItem], '2026-11-09', SP, none);
    const sections = arrangeDay(
      strayDay,
      createLayoutPlan('separate', [softDelete(school, ctx), home], []),
    );
    expect(sections.map((section) => section.info.key)).toEqual([
      `agenda:${home.id}`,
      `agenda:${school.id}`,
      'agenda:missing',
    ]);
    expect(sections.at(-1)!.info.agendaId).toBe('missing');
  });
});

describe('arrangeDay: grouped', () => {
  it('makes one section per group, in group order', () => {
    const plan = createLayoutPlan('grouped', agendas, [personal, work]);
    expect(summary(arrangeDay(day, plan))).toEqual([
      [`group:${work.id}`, ['School holiday', 'Class', 'Client call']],
      [`group:${personal.id}`, ['Home lunch', 'Home paper']],
    ]);
  });

  it('puts agendas that are in no group into a last section', () => {
    const plan = createLayoutPlan('grouped', agendas, [work]);
    const sections = arrangeDay(day, plan);
    expect(sections.map((section) => section.info.key)).toEqual([`group:${work.id}`, 'ungrouped']);
    expect(titlesOf(sections[1]!)).toEqual(['Home lunch', 'Home paper']);
    expect(sections[1]!.info.kind).toBe('ungrouped');
  });

  it('sends an agenda in two groups to the first group only, so nothing shows twice', () => {
    const both = group('Both', [school, home], 0);
    const plan = createLayoutPlan('grouped', agendas, [work, both]);
    const sections = arrangeDay(day, plan);
    expect(sections.map((section) => section.info.groupId)).toEqual([both.id, work.id]);
    const all = sections.flatMap(titlesOf);
    expect(all).toHaveLength(new Set(all).size);
    expect(titlesOf(sections[0]!)).toEqual(['School holiday', 'Class', 'Home lunch', 'Home paper']);
    expect(titlesOf(sections[1]!)).toEqual(['Client call']);
  });

  it('ignores deleted groups', () => {
    const plan = createLayoutPlan('grouped', agendas, [softDelete(work, ctx), personal]);
    expect(arrangeDay(day, plan).map((section) => section.info.key)).toEqual([
      `group:${personal.id}`,
      'ungrouped',
    ]);
  });
});

describe('arrangeOverdue', () => {
  const now = '2026-11-09T15:00:00.000Z';
  const late = [
    task('Late home', { agendaId: home.id, due: { allDay: true, date: '2026-11-05' } }),
    task('Late school', { agendaId: school.id, due: { allDay: true, date: '2026-11-03' } }),
  ];
  const strip = buildOverdueStrip(late, now, '2026-11-09', SP, none);

  it('returns nothing for an empty strip, in every layout', () => {
    for (const layout of ['mixed', 'separate', 'grouped'] as const) {
      expect(arrangeOverdue([], createLayoutPlan(layout, agendas, [work]))).toEqual([]);
    }
  });

  it('returns the strip itself in mixed', () => {
    const [section] = arrangeOverdue(strip, createLayoutPlan('mixed', agendas, []));
    expect(section!.entries).toBe(strip);
  });

  it('deals the strip into sections, keeping the oldest delivery first inside each', () => {
    const separate = arrangeOverdue(strip, createLayoutPlan('separate', agendas, []));
    expect(separate.map((s) => [s.info.key, s.entries.map((e) => e.item.title)])).toEqual([
      [`agenda:${school.id}`, ['Late school']],
      [`agenda:${home.id}`, ['Late home']],
    ]);

    const grouped = arrangeOverdue(strip, createLayoutPlan('grouped', agendas, [work]));
    expect(grouped.map((s) => s.info.key)).toEqual([`group:${work.id}`, 'ungrouped']);
  });
});

describe('arrangeDayWithOverdue', () => {
  const now = '2026-11-09T15:00:00.000Z';
  const late = [
    task('Late home', { agendaId: home.id, due: { allDay: true, date: '2026-11-05' } }),
    task('Late freelance', { agendaId: freelance.id, due: { allDay: true, date: '2026-11-03' } }),
  ];
  const strip = buildOverdueStrip(late, now, '2026-11-09', SP, none);
  const keys = (plan: ReturnType<typeof createLayoutPlan>, d = day, o = strip) =>
    arrangeDayWithOverdue(d, o, plan).map((section) => section.info.key);

  it('keeps the day and the strip whole in mixed', () => {
    const [only, ...rest] = arrangeDayWithOverdue(
      day,
      strip,
      createLayoutPlan('mixed', agendas, []),
    );
    expect(rest).toEqual([]);
    expect(only!.day).toBe(day);
    expect(only!.overdue).toBe(strip);
  });

  it('puts the day and the strip of each agenda in the same section, in plan order', () => {
    const sections = arrangeDayWithOverdue(day, strip, createLayoutPlan('separate', agendas, []));
    expect(sections.map((s) => s.info.key)).toEqual([
      `agenda:${school.id}`,
      `agenda:${freelance.id}`,
      `agenda:${home.id}`,
    ]);
    const freelanceSection = sections[1]!;
    expect(titlesOf(freelanceSection)).toEqual(['Client call']);
    expect(freelanceSection.overdue.map((e) => e.item.title)).toEqual(['Late freelance']);
    expect(sections[0]!.overdue).toEqual([]);
  });

  it('gives a section to an agenda that only has an overdue task', () => {
    const onlySchool = buildTimelineDay(
      items.filter((item) => item.agendaId === school.id),
      '2026-11-09',
      SP,
      none,
    );
    const sections = arrangeDayWithOverdue(
      onlySchool,
      strip,
      createLayoutPlan('separate', agendas, []),
    );
    const home = sections.find(
      (s) => s.info.key.startsWith('agenda:') && s.overdue.length > 0 && s.day.timed.length === 0,
    );
    expect(home).toBeDefined();
    expect(home!.day.allDay).toEqual([]);
    expect(home!.day.date).toBe('2026-11-09');
  });

  it('works with an empty day and a strip, and returns nothing when both are empty', () => {
    const empty = buildTimelineDay([], '2026-11-09', SP, none);
    for (const layout of ['mixed', 'separate', 'grouped'] as const) {
      const plan = createLayoutPlan(layout, agendas, [work]);
      expect(arrangeDayWithOverdue(empty, [], plan)).toEqual([]);
      expect(keys(plan, empty).length).toBeGreaterThan(0);
    }
    const grouped = createLayoutPlan('grouped', agendas, [work]);
    expect(keys(grouped, empty)).toEqual([`group:${work.id}`, 'ungrouped']);
  });
});
