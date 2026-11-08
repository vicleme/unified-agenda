import type { Id } from '../core';
import { DEFAULT_CONTROLS, type TimelineControls } from '../filters';

/**
 * What the Timeline remembers while the app is open: the controls (sieves, shown agendas, layout)
 * and which saved view they came from, if any. It lives in the shell, above the Timeline, so it
 * survives a switch to another tab or to the Manage area, which unmount the Timeline.
 */
export interface TimelineMemory {
  controls: TimelineControls;
  /** The saved view the controls started from. Null when the person set them by hand. */
  viewId: Id | null;
}

export const INITIAL_TIMELINE_MEMORY: TimelineMemory = {
  controls: DEFAULT_CONTROLS,
  viewId: null,
};
