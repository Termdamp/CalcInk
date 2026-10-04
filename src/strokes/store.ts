import type { Point, Stroke } from '../types';

/** Samples closer than this (CSS px) to the previous one are dropped: pure jitter. */
const MIN_POINT_DISTANCE = 0.5;

export interface StrokeStore {
  /** Committed strokes. A new array instance on every commit, so changes are detectable by reference. */
  readonly strokes: readonly Stroke[];
  /** The stroke being drawn right now (mutated in place for speed), or null. */
  readonly activeStroke: Stroke | null;
  begin(point: Point, width: number): void;
  append(points: readonly Point[]): void;
  end(): void;
  cancel(): void;
  subscribe(listener: () => void): () => void;
}

export function createStrokeStore(): StrokeStore {
  let committed: readonly Stroke[] = [];
  let active: Stroke | null = null;
  let counter = 0;
  // NOT crypto.randomUUID(): it only exists in secure contexts, and http://192.168.x.x
  // (your phone test!) is not one.
  const idPrefix = Date.now().toString(36);
  const listeners = new Set<() => void>();

  const notify = (): void => {
    for (const listener of listeners) listener();
  };

  const end = (): void => {
    if (!active) return;
    committed = [...committed, active];
    active = null;
    notify();
  };

  const begin = (point: Point, width: number): void => {
    end(); // defensive: never leave two strokes open
    counter += 1;
    active = { id: `${idPrefix}-${counter}`, points: [point], width };
    notify();
  };

  const append = (points: readonly Point[]): void => {
    const stroke = active;
    if (!stroke) return;
    let added = false;
    for (const p of points) {
      const last = stroke.points[stroke.points.length - 1];
      if (last && (p.x - last.x) ** 2 + (p.y - last.y) ** 2 < MIN_POINT_DISTANCE ** 2) continue;
      stroke.points.push(p);
      added = true;
    }
    if (added) notify(); // one notification per batch, not per sample
  };

  const cancel = (): void => {
    if (!active) return;
    active = null;
    notify();
  };

  return {
    get strokes() {
      return committed;
    },
    get activeStroke() {
      return active;
    },
    begin,
    append,
    end,
    cancel,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}