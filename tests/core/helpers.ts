import { createStatus, createStatusGroup, type Context } from '../../src/core';
import type { Status, StatusGroup } from '../../src/core';

/** A fixed clock and predictable ids (id-1, id-2, ...), so results can be compared exactly. */
export function testContext(
  startMs = Date.UTC(2026, 10, 7, 12, 0, 0),
): Context & { tick: () => void } {
  let counter = 0;
  let nowMs = startMs;
  return {
    now: () => new Date(nowMs).toISOString(),
    newId: () => `id-${++counter}`,
    tick: () => {
      nowMs += 1000;
    },
  };
}

export function testStatuses(ctx: Context): {
  groups: StatusGroup[];
  planned: Status;
  started: Status;
  done: Status;
} {
  const plannedGroup = createStatusGroup({ name: 'Planned', role: 'planned' }, ctx);
  const startedGroup = createStatusGroup({ name: 'Started', role: 'started' }, ctx);
  const doneGroup = createStatusGroup({ name: 'Done', role: 'done' }, ctx);
  return {
    groups: [plannedGroup, startedGroup, doneGroup],
    planned: createStatus({ name: 'Scheduled', groupId: plannedGroup.id }, ctx),
    started: createStatus({ name: 'In progress', groupId: startedGroup.id }, ctx),
    done: createStatus({ name: 'Done', groupId: doneGroup.id }, ctx),
  };
}
