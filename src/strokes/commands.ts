import type { Stroke } from '../types';
import type { IndexedStroke, StrokeStore } from './store';

export interface Command {
  readonly label: string;
  execute(store: StrokeStore): void;
  undo(store: StrokeStore): void;
}

export class AddStrokeCommand implements Command {
  readonly label = 'Draw';
  private readonly stroke: Stroke;

  constructor(stroke: Stroke) {
    this.stroke = stroke;
  }

  execute(store: StrokeStore): void {
    store.add(this.stroke);
  }

  undo(store: StrokeStore): void {
    store.remove([this.stroke.id]);
  }
}

/**
 * Removes strokes and optionally adds replacements. One class serves both erasers:
 * stroke eraser = remove ids, add nothing; pixel eraser = remove originals, add fragments.
 * The command records what it removed (with indices) while executing, so redo and undo
 * always work from the real state, not from stale constructor arguments.
 */
export class EraseStrokesCommand implements Command {
  readonly label = 'Erase';
  private readonly removeIds: readonly string[];
  private readonly added: readonly Stroke[];
  private removed: IndexedStroke[] = [];

  constructor(removeIds: readonly string[], added: readonly Stroke[] = []) {
    this.removeIds = removeIds;
    this.added = added;
  }

  execute(store: StrokeStore): void {
    this.removed = store.remove(this.removeIds);
    for (const stroke of this.added) store.add(stroke);
  }

  undo(store: StrokeStore): void {
    store.remove(this.added.map((s) => s.id));
    store.insert(this.removed); // original positions: undo restores the exact draw order
  }
}

export class ClearCommand implements Command {
  readonly label = 'Clear';
  private removed: IndexedStroke[] = [];

  execute(store: StrokeStore): void {
    this.removed = store.clear();
  }

  undo(store: StrokeStore): void {
    store.insert(this.removed);
  }
}

/** Several commands that undo/redo as one step. */
export class CompositeCommand implements Command {
  readonly label: string;
  private readonly commands: readonly Command[];

  constructor(label: string, commands: readonly Command[]) {
    this.label = label;
    this.commands = commands;
  }

  execute(store: StrokeStore): void {
    for (const command of this.commands) command.execute(store);
  }

  undo(store: StrokeStore): void {
    for (const command of [...this.commands].reverse()) command.undo(store);
  }
}