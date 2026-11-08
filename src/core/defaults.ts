import { createStatus, createStatusGroup, defaultContext, type Context } from './entities';
import { DEFAULT_PERIOD_BOUNDS } from './dayPeriod';
import type { Settings, Status, StatusGroup, StatusRole } from './types';

export const DEFAULT_SETTINGS: Settings = {
  displayTimeZone: 'auto',
  periodBounds: DEFAULT_PERIOD_BOUNDS,
};

export type DefaultStatusKey =
  'idealized' | 'paused' | 'scheduled' | 'started' | 'inProgress' | 'done' | 'delivered';

export type DefaultGroupKey = StatusRole;

const LAYOUT: { group: DefaultGroupKey; statuses: DefaultStatusKey[] }[] = [
  { group: 'planned', statuses: ['idealized', 'paused', 'scheduled'] },
  { group: 'started', statuses: ['started', 'inProgress'] },
  { group: 'done', statuses: ['done', 'delivered'] },
];

/**
 * The starting Kanban groups and columns. The core does not know any language, so the caller
 * supplies the visible names.
 */
export function createDefaultStatuses(
  label: (key: DefaultGroupKey | DefaultStatusKey) => string,
  ctx: Context = defaultContext,
): { groups: StatusGroup[]; statuses: Status[] } {
  const groups: StatusGroup[] = [];
  const statuses: Status[] = [];

  LAYOUT.forEach((entry, groupIndex) => {
    const group = createStatusGroup(
      { name: label(entry.group), role: entry.group, order: groupIndex },
      ctx,
    );
    groups.push(group);
    entry.statuses.forEach((key, index) => {
      statuses.push(createStatus({ name: label(key), groupId: group.id, order: index }, ctx));
    });
  });

  return { groups, statuses };
}
