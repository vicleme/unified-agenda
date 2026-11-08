import { isPlainDate } from './plainDate';
import { isValidTimeZone } from './zone';
import type { Schedule, Timestamp } from './types';

export type ScheduleIssue = 'invalidDate' | 'invalidInstant' | 'endBeforeStart' | 'invalidTimeZone';

export function timestampToMs(value: Timestamp): number {
  return Date.parse(value);
}

export function msToTimestamp(ms: number): Timestamp {
  return new Date(ms).toISOString();
}

export function isTimestamp(value: unknown): value is Timestamp {
  return typeof value === 'string' && /Z$/.test(value) && !Number.isNaN(Date.parse(value));
}

export function validateSchedule(schedule: Schedule): ScheduleIssue[] {
  const issues: ScheduleIssue[] = [];

  if (schedule.allDay) {
    if (
      !isPlainDate(schedule.start) ||
      (schedule.end !== undefined && !isPlainDate(schedule.end))
    ) {
      issues.push('invalidDate');
    } else if (schedule.end !== undefined && schedule.end < schedule.start) {
      issues.push('endBeforeStart');
    }
    return issues;
  }

  if (!isTimestamp(schedule.start) || (schedule.end !== undefined && !isTimestamp(schedule.end))) {
    issues.push('invalidInstant');
  } else if (
    schedule.end !== undefined &&
    timestampToMs(schedule.end) < timestampToMs(schedule.start)
  ) {
    issues.push('endBeforeStart');
  }
  if (schedule.timeZone !== undefined && !isValidTimeZone(schedule.timeZone)) {
    issues.push('invalidTimeZone');
  }
  return issues;
}
