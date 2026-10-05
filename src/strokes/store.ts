import { createEmitter, type Emitter } from '../emitter';
import type { Stroke } from '../types';
import { deserializeStrokes, serializeStrokes, type DeserializeResult } from './serialize';

/** A stroke plus the position it occupied, so undo can put it back exactly where it was. */
export interface IndexedStroke {
  readonly stroke: Stroke;
  readonly index: number;
}

export interface StoreChange {
  readonly added: readonly Stroke[];
  readonly removed: readonly Stroke[];
  /** True when nothing was removed and everything added went to the end: cheap incremental repaint. */
  readonly append: boolean;
}

export interface StoreEvents {
  change: StoreChange;
}

export interface StrokeStore {
  /** Committed strokes in draw order. A NEW array instance after every change. */
  readonly strokes: readonly Stroke[];
  get(id: string): Stroke | undefined;
  /** Appends a stroke (freezing it). Ignored if the id already exists. */
  add(stroke: Stroke): void;
  /** Removes strokes by id; returns what was removed with original indices. */
  remove(ids: readonly string[]): IndexedStroke[];
  /** Re-inserts strokes at their recorded indices (the inverse of remove/clear). */
  insert(entries: readonly IndexedStroke[]): void;
  clear(): IndexedStroke[];
  /** Replaces the whole document (open file). Callers should also reset history. */
  load(strokes: readonly Stroke[]): void;
  serialize(): string;
  /** Replaces the document from JSON. On failure the document is untouched. */
  restore(json: string): DeserializeResult;
  on: Emitter<StoreEvents>['on'];
}

function freezeStroke(stroke: Stroke): void {
  if (Object.isFrozen(stroke)) return;
  for (const point of stroke.points) Object.freeze(point);
  Object.freeze(stroke.points);
  Object.freeze(stroke);
}

export function createStrokeStore(): StrokeStore {
  let strokes: readonly Stroke[] = [];
  const byId = new Map<string, Stroke>();
  const events = createEmitter<StoreEvents>();

  const add = (stroke: Stroke): void => {
    if (byId.has(stroke.id)) return;
    freezeStroke(stroke);
    strokes = [...strokes, stroke];
    byId.set(stroke.id, stroke);
    events.emit('change', { added: [stroke], removed: [], append: true });
  };

  const remove = (ids: readonly string[]): IndexedStroke[] => {
    const wanted = new Set(ids);
    const entries: IndexedStroke[] = [];
    const kept: Stroke[] = [];
    strokes.forEach((stroke, index) => {
      if (wanted.has(stroke.id)) entries.push({ stroke, index });
      else kept.push(stroke);
    });
    if (entries.length === 0) return entries;
    strokes = kept;
    for (const { stroke } of entries) byId.delete(stroke.id);
    events.emit('change', {
      added: [],
      removed: entries.map((e) => e.stroke),
      append: false,
    });
    return entries;
  };

  const insert = (entries: readonly IndexedStroke[]): void => {
    // Ascending order matters: each insertion assumes all lower indices are already in place.
    const sorted = [...entries].sort((a, b) => a.index - b.index);
    const next = [...strokes];
    const added: Stroke[] = [];
    let append = true;
    for (const { stroke, index } of sorted) {
      if (byId.has(stroke.id)) continue;
      const at = Math.min(index, next.length);
      if (at !== next.length) append = false;
      next.splice(at, 0, stroke);
      byId.set(stroke.id, stroke);
      added.push(stroke);
    }
    if (added.length === 0) return;
    strokes = next;
    events.emit('change', { added, removed: [], append });
  };

  const clear = (): IndexedStroke[] => {
    const entries = strokes.map((stroke, index) => ({ stroke, index }));
    if (entries.length === 0) return entries;
    const removed = strokes;
    strokes = [];
    byId.clear();
    events.emit('change', { added: [], removed, append: false });
    return entries;
  };

  const load = (next: readonly Stroke[]): void => {
    const removed = strokes;
    const unique: Stroke[] = [];
    byId.clear();
    for (const stroke of next) {
      if (byId.has(stroke.id)) continue;
      freezeStroke(stroke);
      byId.set(stroke.id, stroke);
      unique.push(stroke);
    }
    strokes = unique;
    events.emit('change', { added: unique, removed, append: false });
  };

  return {
    get strokes() {
      return strokes;
    },
    get: (id) => byId.get(id),
    add,
    remove,
    insert,
    clear,
    load,
    serialize: () => serializeStrokes(strokes),
    restore(json) {
      const result = deserializeStrokes(json);
      if (result.ok) load(result.strokes);
      return result;
    },
    on: events.on,
  };
}