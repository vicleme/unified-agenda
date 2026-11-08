import { createAgenda, createSavedView, softDelete } from '../../src/core';
import {
  DEFAULT_CONTROLS,
  controlsFromView,
  isViewCurrent,
  nextViewOrder,
  snapshotControls,
  sortSavedViews,
  viewNameProblem,
  type TimelineControls,
} from '../../src/filters';

const a = createAgenda({ name: 'A', color: '#111111', order: 0 });
const b = createAgenda({ name: 'B', color: '#222222', order: 1 });
const agendas = [a, b];

const controls = (patch: Partial<TimelineControls> = {}): TimelineControls => ({
  ...DEFAULT_CONTROLS,
  ...patch,
});

describe('snapshotControls and controlsFromView', () => {
  it('round trips every control', () => {
    const start = controls({
      filter: {
        tagIds: ['t1'],
        kinds: ['task'],
        periods: ['morning'],
        text: 'x',
        dueWithinDays: 3,
      },
      selection: [a.id],
      layout: 'separate',
    });
    const view = createSavedView({ name: 'V', ...snapshotControls(start) });
    expect(controlsFromView(view)).toEqual(start);
  });

  it('keeps "every agenda" as null', () => {
    const view = createSavedView({ name: 'V', ...snapshotControls(DEFAULT_CONTROLS) });
    expect(view.agendaIds).toBeNull();
    expect(controlsFromView(view).selection).toBeNull();
  });

  it('copies the lists, so later changes do not leak into the view', () => {
    const start = controls({ selection: [a.id] });
    const snap = snapshotControls(start);
    (start.selection as string[]).push(b.id);
    expect(snap.agendaIds).toEqual([a.id]);
    const view = createSavedView({ name: 'V', ...snap });
    const back = controlsFromView(view);
    (back.selection as string[]).push(b.id);
    expect(view.agendaIds).toEqual([a.id]);
  });
});

describe('isViewCurrent', () => {
  const saved = createSavedView({
    name: 'V',
    ...snapshotControls(
      controls({
        filter: { tagIds: ['t1', 't2'], kinds: [], periods: [], text: 'x', dueWithinDays: null },
        selection: [a.id],
      }),
    ),
  });

  it('is true for the controls it was saved from', () => {
    expect(isViewCurrent(saved, controlsFromView(saved), agendas)).toBe(true);
  });

  it('ignores the order of the lists and spaces around the text', () => {
    const same = controls({
      filter: { tagIds: ['t2', 't1'], kinds: [], periods: [], text: ' x ', dueWithinDays: null },
      selection: [a.id],
    });
    expect(isViewCurrent(saved, same, agendas)).toBe(true);
  });

  it('notices a change in each group of controls', () => {
    const base = controlsFromView(saved);
    expect(isViewCurrent(saved, { ...base, layout: 'grouped' }, agendas)).toBe(false);
    expect(isViewCurrent(saved, { ...base, selection: null }, agendas)).toBe(false);
    expect(
      isViewCurrent(saved, { ...base, filter: { ...base.filter, kinds: ['event'] } }, agendas),
    ).toBe(false);
    expect(
      isViewCurrent(saved, { ...base, filter: { ...base.filter, dueWithinDays: 2 } }, agendas),
    ).toBe(false);
  });

  it('treats null and a list of every agenda as the same thing on screen', () => {
    const all = createSavedView({ name: 'All', ...snapshotControls(DEFAULT_CONTROLS) });
    expect(isViewCurrent(all, controls({ selection: [a.id, b.id] }), agendas)).toBe(true);
  });

  it('treats an invalid due limit as no limit', () => {
    const plain = createSavedView({ name: 'P', ...snapshotControls(DEFAULT_CONTROLS) });
    const odd = controls({ filter: { ...DEFAULT_CONTROLS.filter, dueWithinDays: -1 } });
    expect(isViewCurrent(plain, odd, agendas)).toBe(true);
  });
});

describe('listing and names', () => {
  const v = (name: string, order: number) => createSavedView({ name, order });

  it('sorts by order then name, and leaves out deleted views', () => {
    const gone = softDelete(v('Gone', 0));
    const list = sortSavedViews([v('Z', 1), v('B', 0), v('A', 0), gone]);
    expect(list.map((view) => view.name)).toEqual(['A', 'B', 'Z']);
  });

  it('puts a new view after the last one', () => {
    expect(nextViewOrder([])).toBe(0);
    expect(nextViewOrder([v('A', 0), v('B', 4)])).toBe(5);
  });

  it('refuses empty and repeated names, ignoring case and spaces', () => {
    const views = [v('Work', 0), softDelete(v('Old', 1))];
    expect(viewNameProblem('   ', views)).toBe('empty');
    expect(viewNameProblem(' work ', views)).toBe('duplicate');
    expect(viewNameProblem('Old', views)).toBeNull();
    expect(viewNameProblem('Home', views)).toBeNull();
  });

  it('lets a view keep its own name when renaming', () => {
    const own = v('Work', 0);
    expect(viewNameProblem('WORK', [own], own.id)).toBeNull();
  });
});
