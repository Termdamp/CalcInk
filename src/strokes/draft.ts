import { createEmitter, type Emitter } from '../emitter';
import type { Point, Stroke } from '../types';

/** Samples closer than this (CSS px) to the previous one are dropped: pure jitter. */
const MIN_POINT_DISTANCE = 0.5;

export interface DraftEvents {
  /** The current in-progress stroke, or null when there is none. */
  change: Stroke | null;
}

/** The stroke being drawn right now. Deliberately mutable: it's the hot path. */
export interface Draft {
  readonly current: Stroke | null;
  begin(point: Point, width: number): void;
  append(points: readonly Point[]): void;
  /** Ends the gesture and hands the finished stroke to the caller (who commits it via history). */
  finish(): Stroke | null;
  cancel(): void;
  on: Emitter<DraftEvents>['on'];
}

export function createDraft(makeId: () => string): Draft {
  let active: Stroke | null = null;
  const events = createEmitter<DraftEvents>();

  return {
    get current() {
      return active;
    },
    begin(point, width) {
      active = { id: makeId(), points: [point], width };
      events.emit('change', active);
    },
    append(points) {
      const stroke = active;
      if (!stroke) return;
      let added = false;
      for (const p of points) {
        const last = stroke.points[stroke.points.length - 1];
        if (last && (p.x - last.x) ** 2 + (p.y - last.y) ** 2 < MIN_POINT_DISTANCE ** 2) continue;
        stroke.points.push(p);
        added = true;
      }
      if (added) events.emit('change', stroke);
    },
    finish() {
      const done = active;
      if (!done) return null;
      active = null; // from here on the draft never touches this stroke again
      events.emit('change', null);
      return done;
    },
    cancel() {
      if (!active) return;
      active = null;
      events.emit('change', null);
    },
    on: events.on,
  };
}